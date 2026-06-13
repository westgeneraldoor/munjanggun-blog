const fs = require('fs');
const { paths } = require('./lib/paths');
const { readJsonFile } = require('./lib/file_store');

function fail(message) {
  throw new Error(message);
}

function assertArrayConfig(filePath, fields = []) {
  const value = readJsonFile(filePath, null);
  if (!Array.isArray(value)) fail(`${filePath}는 배열이어야 합니다.`);
  if (value.length === 0) fail(`${filePath} 배열이 비어 있습니다.`);

  const seen = new Set();
  value.forEach((item, index) => {
    if (typeof item === 'string') {
      if (!item.trim()) fail(`${filePath}[${index}] 값이 비어 있습니다.`);
      if (seen.has(item)) fail(`${filePath} 중복 값: ${item}`);
      seen.add(item);
      return;
    }

    if (!item || typeof item !== 'object') fail(`${filePath}[${index}]는 객체 또는 문자열이어야 합니다.`);
    fields.forEach((field) => {
      if (!String(item[field] || '').trim()) fail(`${filePath}[${index}].${field} 값이 비어 있습니다.`);
    });
    const key = fields.map((field) => item[field]).join('|');
    if (key && seen.has(key)) fail(`${filePath} 중복 값: ${key}`);
    if (key) seen.add(key);
  });
}

function assertHistory() {
  const filePath = paths.dataProcessed('tracking_history.json');
  const history = readJsonFile(filePath, null);
  if (!history || typeof history !== 'object') fail('tracking_history.json은 객체여야 합니다.');
  if (!Array.isArray(history.records)) fail('tracking_history.json records가 배열이 아닙니다.');

  let previousTime = 0;
  history.records.forEach((record, recordIndex) => {
    if (!record.date) fail(`records[${recordIndex}].date가 없습니다.`);
    const timestamp = Date.parse(record.timestamp || record.date);
    if (Number.isNaN(timestamp)) fail(`records[${recordIndex}] 날짜를 파싱할 수 없습니다.`);
    if (timestamp < previousTime) fail(`records[${recordIndex}] 날짜가 이전 레코드보다 과거입니다.`);
    previousTime = timestamp;

    if (!Array.isArray(record.rankings)) fail(`records[${recordIndex}].rankings가 배열이 아닙니다.`);
    const seen = new Set();
    record.rankings.forEach((ranking, rankingIndex) => {
      if (!ranking.keyword) fail(`records[${recordIndex}].rankings[${rankingIndex}].keyword가 없습니다.`);
      if (seen.has(ranking.keyword)) fail(`records[${recordIndex}] 중복 키워드: ${ranking.keyword}`);
      seen.add(ranking.keyword);
      if (typeof ranking.rank !== 'number') fail(`${ranking.keyword} rank는 숫자여야 합니다.`);
      if (ranking.rank < -1 || ranking.rank > 100) fail(`${ranking.keyword} rank 범위가 이상합니다: ${ranking.rank}`);
    });
  });
}

function assertPostingRegistry() {
  const registryPath = paths.docsStrategy('POSTING_REGISTRY.md');
  if (!fs.existsSync(registryPath)) fail('POSTING_REGISTRY.md가 없습니다.');
  const content = fs.readFileSync(registryPath, 'utf8');
  const listStart = content.indexOf('## 발행 글 목록');
  const listEnd = content.indexOf('## 순위 추적 대상 키워드');
  const listContent = listStart !== -1 && listEnd !== -1
    ? content.slice(listStart, listEnd)
    : content;
  const rows = listContent.split(/\r?\n/).filter((line) => /^\| \d{3}/.test(line));
  if (rows.length === 0) fail('POSTING_REGISTRY.md에 발행 글 행이 없습니다.');

  const postRows = rows.filter((line) => line.split('|').length >= 8);
  const seen = new Set();
  postRows.forEach((line) => {
    const columns = line.split('|').map((col) => col.trim());
    const number = columns[1];
    const file = columns[2];
    if (!/^\d{3}(-\d+)?$/.test(number)) fail(`등록부 번호 형식 오류: ${number}`);
    if (!file.endsWith('.md')) return;
    if (seen.has(number)) fail(`등록부 글 번호 중복: ${number}`);
    seen.add(number);
  });
}

function main() {
  assertArrayConfig(paths.config('tracking_keywords.json'), ['keyword', 'hub']);
  assertArrayConfig(paths.config('top10_keywords.json'), ['keyword', 'hub']);
  assertArrayConfig(paths.config('regional_seed_keywords.json'));
  assertArrayConfig(paths.config('product_seed_keywords.json'));
  assertHistory();
  assertPostingRegistry();
  console.log('데이터 스키마 검증 완료');
}

main();
