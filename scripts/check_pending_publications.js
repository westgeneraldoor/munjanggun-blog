const fs = require('fs');
const path = require('path');
const { registryRows, postingEntries } = require('./lib/posting_registry');
const { findMatchingPublicCandidates, plainText } = require('./lib/pending_publication_guard');

const BLOG_ID = 'doorgeneral';

function notBeforeDateFor(postNo, entries) {
  const number = Number(postNo);
  if (!Number.isFinite(number)) return '';
  return entries
    .filter((entry) => Number(entry.postNo) < number && /^\d{4}-\d{2}-\d{2}$/.test(entry.publishedAt || ''))
    .map((entry) => entry.publishedAt)
    .sort()
    .at(-1) || '';
}

function pendingRows() {
  const entries = postingEntries();
  return registryRows().flatMap((row) => {
    const state = String(row['콘텐츠/URL 상태'] || '').trim();
    const file = String(row.파일 || '').trim();
    const title = String(row['포스팅 제목'] || '').trim();
    if (!/URL등록대기/.test(state) || !file || !title) return [];
    return [{
      postNo: String(row['#'] || '').trim(),
      file,
      title,
      targetKeywords: String(row['타겟 키워드'] || '').trim(),
      notBeforeDate: notBeforeDateFor(row['#'], entries),
    }];
  });
}

function queriesFor(pending) {
  const keywords = String(pending.targetKeywords || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
    .slice(0, 3);
  return keywords.length > 0 ? keywords : [pending.title];
}

function parseInitialState(html) {
  const match = String(html || '').match(/window\.__INITIAL_STATE__\s*=\s*(\{[\s\S]*?\});\s*window\.__REACT_QUERY_STATE__/);
  if (!match) throw new Error('공개 모바일 검색 결과의 초기 상태를 읽지 못했습니다. UI 변경 여부를 확인하세요.');
  const state = JSON.parse(match[1]);
  const items = state && state.search && state.search.inBlogPostList
    && state.search.inBlogPostList.data && state.search.inBlogPostList.data.items;
  return Array.isArray(items) ? items : [];
}

async function fetchCandidates(query) {
  const url = new URL('https://m.blog.naver.com/PostSearchList.nhn');
  url.searchParams.set('blogId', BLOG_ID);
  url.searchParams.set('orderType', 'recent');
  url.searchParams.set('periodType', 'all');
  url.searchParams.set('searchText', query);

  const response = await fetch(url, {
    headers: { 'user-agent': 'Mozilla/5.0 (compatible; MunjanggunBlogOps/1.0)' },
  });
  if (!response.ok) throw new Error(`공개 모바일 검색 요청 실패: ${response.status} ${query}`);
  return parseInitialState(await response.text());
}

function publicUrl(logNo) {
  return `https://blog.naver.com/${BLOG_ID}/${logNo}`;
}

async function main() {
  const pending = pendingRows();
  if (pending.length === 0) {
    console.log('CLEAR: URL등록대기 원고가 없습니다.');
    return;
  }

  const findings = [];
  for (const entry of pending) {
    const byLogNo = new Map();
    for (const query of queriesFor(entry)) {
      const candidates = await fetchCandidates(query);
      candidates.forEach((candidate) => byLogNo.set(String(candidate.logNo), candidate));
    }
    const matches = findMatchingPublicCandidates(entry, [...byLogNo.values()]);
    matches.forEach((candidate) => findings.push({ entry, candidate }));
  }

  if (findings.length === 0) {
    console.log(`CLEAR: URL등록대기 ${pending.length}건에서 공개 후보를 찾지 못했습니다.`);
    return;
  }

  findings.forEach(({ entry, candidate }) => {
    const publishedAt = Number.isFinite(Number(candidate.addDate))
      ? new Date(Number(candidate.addDate)).toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' })
      : '미확인';
    console.log(`POTENTIAL_PUBLICATION post=${entry.postNo} file=${entry.file}`);
    console.log(`  title=${plainText(candidate.title)}`);
    console.log(`  url=${publicUrl(candidate.logNo)} published_at=${publishedAt} KST matched=${candidate.matchedTokens.join(',')}`);
  });
  process.exitCode = 2;
}

main().catch((error) => {
  console.error(`FAIL: ${error.message}`);
  process.exitCode = 1;
});

module.exports = {
  fetchCandidates,
  notBeforeDateFor,
  parseInitialState,
  pendingRows,
};
