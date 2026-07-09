const { paths } = require('./paths');
const { readJsonFile } = require('./file_store');

const REGISTRY_SOURCE_PATH = paths.docsStrategy('POSTING_REGISTRY.json');

function plainUrl(value) {
  const text = String(value || '');
  const linkMatch = text.match(/\]\((https:\/\/blog\.naver\.com\/doorgeneral\/\d+[^)]*)\)/);
  if (linkMatch) return linkMatch[1];
  const urlMatch = text.match(/https:\/\/blog\.naver\.com\/doorgeneral\/\d+\S*/);
  return urlMatch ? urlMatch[0] : null;
}

function postIdFromUrl(url) {
  const match = String(url || '').match(/blog\.naver\.com\/doorgeneral\/(\d+)/);
  return match ? match[1] : '';
}

function normalizePostNo(value) {
  const match = String(value || '').trim().match(/^(\d{3}(?:-\d+)?)/);
  return match ? match[1] : '';
}

function postNosFromValue(value) {
  return [...String(value || '').matchAll(/\d{3}(?:-\d+)?/g)].map((match) => match[0]);
}

function rowObject(header, row) {
  const object = {};
  header.forEach((column, index) => {
    object[column] = row[index] || '';
  });
  return object;
}

function tableBlocks(source) {
  return (source.blocks || []).filter((block) => block.type === 'table' && Array.isArray(block.header));
}

function registryRows(sourcePath = REGISTRY_SOURCE_PATH) {
  const source = readJsonFile(sourcePath, null);
  if (!source || !Array.isArray(source.blocks)) return [];
  return tableBlocks(source).flatMap((block) => block.rows.map((row) => rowObject(block.header, row)));
}

function postingEntries(sourcePath = REGISTRY_SOURCE_PATH) {
  const rows = registryRows(sourcePath);
  const byKey = new Map();

  rows.forEach((row) => {
    const postNo = normalizePostNo(row['#'] || row['글']);
    const url = plainUrl(row.URL || row.url || row['메모']);
    if (!postNo || !url) return;

    const postId = postIdFromUrl(url);
    const key = `${postNo}|${postId || url}`;
    if (byKey.has(key)) return;

    byKey.set(key, {
      postNo,
      file: row['파일'] || '',
      hub: row['허브'] || '',
      targetKeywords: row['타겟 키워드'] || '',
      title: row['포스팅 제목'] || row['포스트 제목'] || '',
      url,
      postId,
      publishedAt: row['발행일'] || row['발행일(TOP20 작성일 기준)'] || '',
      summary: row['소재 요약'] || row['다룬 소재 (중복 방지용)'] || row['메모'] || '',
    });
  });

  return [...byKey.values()];
}

function trackingKeywordRows(sourcePath = REGISTRY_SOURCE_PATH) {
  const source = readJsonFile(sourcePath, null);
  if (!source || !Array.isArray(source.blocks)) return [];
  const table = tableBlocks(source).find((block) => block.header.includes('글') && block.header.includes('추적 키워드'));
  if (!table) return [];

  return table.rows.map((row) => {
    const object = rowObject(table.header, row);
    return {
      postNo: normalizePostNo(object['글']),
      keywords: String(object['추적 키워드'] || '')
        .split(',')
        .map((keyword) => keyword.trim())
        .filter(Boolean),
    };
  });
}

function buildTrackingTargets(configKeywords, sourcePath = REGISTRY_SOURCE_PATH) {
  const entries = postingEntries(sourcePath);
  const entriesByNo = new Map(entries.map((entry) => [entry.postNo, entry]));
  const keywordToPostNos = new Map();

  trackingKeywordRows(sourcePath).forEach((row) => {
    row.keywords.forEach((keyword) => {
      const values = keywordToPostNos.get(keyword) || [];
      if (row.postNo && !values.includes(row.postNo)) values.push(row.postNo);
      keywordToPostNos.set(keyword, values);
    });
  });

  return configKeywords.map((item) => {
    const explicitPostNos = [
      ...postNosFromValue(item.postNo || item.post_no || item.registryId || ''),
      ...postNosFromValue(item.hub || ''),
    ].filter((postNo, index, values) => postNo && values.indexOf(postNo) === index);
    const keywordPostNos = keywordToPostNos.get(item.keyword) || [];
    const intersection = explicitPostNos.find((postNo) => keywordPostNos.includes(postNo) && entriesByNo.has(postNo));
    const explicitMatch = explicitPostNos.find((postNo) => entriesByNo.has(postNo));
    const keywordMatch = keywordPostNos.find((postNo) => entriesByNo.has(postNo));

    if (!explicitMatch && keywordPostNos.filter((postNo) => entriesByNo.has(postNo)).length > 1) {
      throw new Error(`Ambiguous tracking keyword mapping: ${item.keyword}. Add postNo to config/tracking_keywords.json.`);
    }

    const postNo = intersection || explicitMatch || keywordMatch || '';
    const entry = postNo ? entriesByNo.get(postNo) : null;
    const postUrl = item.targetUrl || item.postUrl || (entry && entry.url) || '';
    const postId = item.postId || postIdFromUrl(postUrl);
    return {
      ...item,
      trackingId: item.trackingId || (postId ? `${item.keyword}|${postId}` : item.keyword),
      postNo,
      postUrl,
      postId,
      postTitle: (entry && entry.title) || '',
      matchMode: postId ? 'url' : 'account_fallback',
    };
  });
}

module.exports = {
  REGISTRY_SOURCE_PATH,
  plainUrl,
  postIdFromUrl,
  normalizePostNo,
  postNosFromValue,
  registryRows,
  postingEntries,
  trackingKeywordRows,
  buildTrackingTargets,
};
