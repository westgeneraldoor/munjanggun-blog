function decodeHtmlEntities(value) {
  return String(value || '')
    .replace(/&amp;/g, '&')
    .replace(/&#38;/g, '&');
}

function urlFromHref(href) {
  try {
    return new URL(decodeHtmlEntities(href), 'https://search.naver.com');
  } catch (err) {
    return null;
  }
}

function parseBlogLink(href) {
  const text = decodeHtmlEntities(href);
  if (!/blog\.naver\.com/i.test(text)) return null;

  const url = urlFromHref(text);
  if (!url || !/blog\.naver\.com$/i.test(url.hostname)) return null;

  const pathname = decodeURIComponent(url.pathname || '');
  const directPostMatch = pathname.match(/^\/([a-zA-Z0-9_]+)\/(\d+)(?:\/)?$/);
  const queryBlogId = url.searchParams.get('blogId') || url.searchParams.get('blogid') || '';
  const queryPostId = url.searchParams.get('logNo') || url.searchParams.get('logno') || '';
  const homeMatch = pathname.match(/^\/([a-zA-Z0-9_]+)(?:\/)?$/);

  const blogId = (directPostMatch && directPostMatch[1])
    || queryBlogId
    || (homeMatch && homeMatch[1])
    || '';
  const postId = (directPostMatch && directPostMatch[2]) || queryPostId || '';

  if (!blogId || ['PostView', 'PostList', 'NBlogTop', 'prologue'].includes(blogId)) return null;
  if (blogId.length < 3) return null;

  return {
    blogId,
    postId,
    href: text,
  };
}

function collectUniquePostResults(links) {
  const results = [];
  const seen = new Set();

  links.forEach((link) => {
    const href = typeof link === 'string' ? link : link.href;
    const parsed = parseBlogLink(href);
    if (!parsed || !parsed.postId) return;

    const key = `${parsed.blogId}|${parsed.postId}`;
    if (seen.has(key)) return;
    seen.add(key);

    results.push({
      blogId: parsed.blogId,
      postId: parsed.postId,
      href: parsed.href,
      title: typeof link === 'string'
        ? ''
        : String(link.title || '').replace(/새 창 열림\s*$/, '').trim().substring(0, 80),
    });
  });

  return results;
}

function findAccountRank(results, blogId) {
  const index = results.findIndex((item) => item.blogId === blogId);
  return index === -1 ? 0 : index + 1;
}

function collectAccountMatches(results, blogId, postNoByPostId = new Map()) {
  return results.flatMap((item, index) => {
    if (item.blogId !== blogId) return [];
    return [{
      rank: index + 1,
      url: `https://blog.naver.com/${item.blogId}/${item.postId}`,
      logNo: item.postId,
      postNo: postNoByPostId.get(item.postId) || '',
      title: item.title || '',
    }];
  });
}

function groupTargetsByKeyword(targets) {
  const groups = new Map();
  targets.forEach((target) => {
    const group = groups.get(target.keyword) || [];
    group.push(target);
    groups.set(target.keyword, group);
  });
  return [...groups].map(([keyword, groupedTargets]) => ({ keyword, targets: groupedTargets }));
}

function evaluateTargetRanking(searchResults, target, blogId) {
  const accountRank = findAccountRank(searchResults, blogId);
  const targetIndex = target.postId
    ? searchResults.findIndex((item) => item.blogId === blogId && item.postId === target.postId)
    : -1;

  if (targetIndex >= 0) {
    const item = searchResults[targetIndex];
    return {
      rank: targetIndex + 1,
      accountRank,
      title: item.title,
      matchedTitle: item.title,
      matchedUrl: item.href,
      matchType: 'url',
      totalFound: searchResults.length,
      note: '',
    };
  }

  return {
    rank: 0,
    accountRank,
    title: '',
    matchedTitle: '',
    matchedUrl: '',
    matchType: target.postId ? 'url_not_found' : 'account_fallback',
    totalFound: searchResults.length,
    note: target.postId
      ? `target URL not found in TOP ${searchResults.length}`
      : `TOP ${searchResults.length} account fallback`,
  };
}

function findRankingEvidenceIssues(record) {
  if (!Array.isArray(record.queryEvidence)) return [];

  const issues = [];
  const evidenceByKeyword = new Map();
  record.queryEvidence.forEach((evidence) => {
    if (evidenceByKeyword.has(evidence.keyword)) {
      issues.push(`duplicate queryEvidence: ${evidence.keyword}`);
      return;
    }
    evidenceByKeyword.set(evidence.keyword, evidence);
  });

  const rankingKeywords = new Set((record.rankings || []).map((ranking) => ranking.keyword));
  rankingKeywords.forEach((keyword) => {
    if (!evidenceByKeyword.has(keyword)) issues.push(`missing queryEvidence: ${keyword}`);
  });
  evidenceByKeyword.forEach((_, keyword) => {
    if (!rankingKeywords.has(keyword)) issues.push(`orphan queryEvidence: ${keyword}`);
  });

  (record.rankings || []).forEach((ranking) => {
    const evidence = evidenceByKeyword.get(ranking.keyword);
    if (!evidence) return;
    if (ranking.totalFound !== evidence.totalFound) {
      issues.push(`totalFound mismatch: ${ranking.keyword} (${ranking.totalFound} != ${evidence.totalFound})`);
    }

    if (evidence.error) {
      if (evidence.totalFound !== 0 || (evidence.accountMatches || []).length !== 0) {
        issues.push(`failed query evidence is not empty: ${ranking.keyword}`);
      }
      if (ranking.rank !== -1 || ranking.accountRank !== 0 || ranking.totalFound !== 0) {
        issues.push(`failed query ranking mismatch: ${ranking.keyword}|${ranking.postId || '-'}`);
      }
      return;
    }

    if (ranking.rank === -1) {
      issues.push(`error ranking without evidence error: ${ranking.keyword}|${ranking.postId || '-'}`);
    }
    const expectedAccountRank = (evidence.accountMatches || []).reduce(
      (lowest, match) => (lowest === 0 || match.rank < lowest ? match.rank : lowest),
      0,
    );
    if (ranking.accountRank !== expectedAccountRank) {
      issues.push(`accountRank mismatch: ${ranking.keyword} (${ranking.accountRank} != ${expectedAccountRank})`);
    }

    if (!ranking.postId) return;
    const targetMatch = (evidence.accountMatches || []).find((match) => String(match.logNo) === String(ranking.postId));
    if (ranking.rank > 0 && (!targetMatch || targetMatch.rank !== ranking.rank)) {
      issues.push(`rank support missing: ${ranking.keyword}|${ranking.postId}|${ranking.rank}`);
    }
    if (ranking.rank === 0 && targetMatch) {
      issues.push(`not-found contradicted by evidence: ${ranking.keyword}|${ranking.postId}|${targetMatch.rank}`);
    }
  });

  return issues;
}

function formatRankingTrendLabel(result) {
  const postNo = String((result && result.postNo) || '').trim();
  const keyword = String((result && result.keyword) || '').trim();
  return postNo ? `${postNo} · ${keyword}` : keyword;
}

function formatHistoryRecordLabels(records) {
  const dateCounts = new Map();
  records.forEach((record) => dateCounts.set(record.date, (dateCounts.get(record.date) || 0) + 1));
  return records.map((record) => {
    if ((dateCounts.get(record.date) || 0) < 2) return record.date;
    const timestamp = new Date(record.timestamp);
    if (Number.isNaN(timestamp.getTime())) return record.date;
    const kstTime = new Date(timestamp.getTime() + (9 * 60 * 60 * 1000)).toISOString().slice(11, 16);
    return `${record.date} ${kstTime} KST`;
  });
}

module.exports = {
  parseBlogLink,
  collectUniquePostResults,
  findAccountRank,
  collectAccountMatches,
  groupTargetsByKeyword,
  evaluateTargetRanking,
  findRankingEvidenceIssues,
  formatRankingTrendLabel,
  formatHistoryRecordLabels,
};
