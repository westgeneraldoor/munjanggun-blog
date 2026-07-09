const fs = require('fs');
const { paths } = require('./lib/paths');
const { readJsonFile } = require('./lib/file_store');
const { findPublicTextIssues, walkFiles } = require('./lib/public_safety');
const { assertNoDrift } = require('./render_strategy_docs');

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
  const appConfig = readJsonFile(paths.config('app.json'), {});
  if (!history || typeof history !== 'object') fail('tracking_history.json은 객체여야 합니다.');
  if (!Array.isArray(history.records)) fail('tracking_history.json records가 배열이 아닙니다.');

  if (history.version !== appConfig.rankingHistoryVersion) {
    fail(`tracking_history.json version must match config/app.json rankingHistoryVersion (${appConfig.rankingHistoryVersion}).`);
  }
  if (history.version < 4) fail('tracking_history.json version must be 4 or higher for URL-based ranking.');

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
      const trackingKey = ranking.trackingId || ranking.keyword;
      if (seen.has(trackingKey)) fail(`records[${recordIndex}] 중복 추적 키: ${trackingKey}`);
      seen.add(trackingKey);
      if (typeof ranking.rank !== 'number') fail(`${ranking.keyword} rank는 숫자여야 합니다.`);
      if (ranking.rank < -1 || ranking.rank > 100) fail(`${ranking.keyword} rank 범위가 이상합니다: ${ranking.rank}`);
      if (ranking.postUrl && !/^https:\/\/blog\.naver\.com\/doorgeneral\/\d+/.test(ranking.postUrl)) {
        fail(`${ranking.keyword} postUrl 형식이 이상합니다: ${ranking.postUrl}`);
      }
      if (ranking.postUrl && ranking.postId && !ranking.postUrl.includes(ranking.postId)) {
        fail(`${ranking.keyword} postId가 postUrl과 맞지 않습니다.`);
      }
      if (ranking.matchType === 'url' && !ranking.postId) {
        fail(`${ranking.keyword} URL 매칭 결과에는 postId가 필요합니다.`);
      }
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

  assertRecentRegistryRows(content);
}

function parseMarkdownRows(content) {
  return content
    .split(/\r?\n/)
    .filter((line) => /^\|\s*\d{3}(?:-\d+)?\s*\|/.test(line))
    .map((line) => line.split('|').map((cell) => cell.trim()));
}

function plainUrl(value) {
  const linkMatch = String(value || '').match(/\]\((https:\/\/blog\.naver\.com\/doorgeneral\/\d+[^)]*)\)/);
  if (linkMatch) return linkMatch[1];
  const urlMatch = String(value || '').match(/https:\/\/blog\.naver\.com\/doorgeneral\/\d+\S*/);
  return urlMatch ? urlMatch[0] : null;
}

function assertRecentRegistryRows(content) {
  const rows = parseMarkdownRows(content);
  rows.forEach((cells) => {
    const number = Number(cells[1]);
    if (!Number.isFinite(number) || number < 126) return;

    const file = cells[2] || '';
    const urlOrStatus = cells[6] || '';
    const dateOrStatus = cells[7] || '';
    const url = plainUrl(urlOrStatus);

    if (file !== '-' && !file.endsWith('.md')) return;

    if (file && file !== '-' && !/^\d{3}_.+\.md$/.test(file)) {
      fail(`최근 등록부 행 파일명 형식 오류: ${number} ${file}`);
    }

    if (url && !/^https:\/\/blog\.naver\.com\/doorgeneral\/\d+/.test(url)) {
      fail(`최근 등록부 행 URL 형식 오류: ${number} ${url}`);
    }

    if (/URL대기/.test(dateOrStatus) && urlOrStatus !== '-') {
      fail(`최근 등록부 URL대기 행은 URL 칸을 '-'로 둬야 합니다: ${number}`);
    }

    if (/발행완료/.test(dateOrStatus) && !url) {
      fail(`최근 등록부 발행완료 행에는 네이버 URL이 필요합니다: ${number}`);
    }
  });
}

function assertPublicGeneratedOutputs() {
  const files = [
    ...walkFiles(paths.dataRaw(''), ['.json', '.md']),
    ...walkFiles(paths.dataProcessed(''), ['.json', '.md']),
    ...walkFiles(paths.outputReport(''), ['.json', '.md', '.html']),
  ];
  const issues = findPublicTextIssues(files);
  if (issues.length > 0) {
    const preview = issues
      .slice(0, 20)
      .map((issue) => `${issue.code}: ${issue.filePath}:${issue.line} ${issue.message}`)
      .join('\n');
    const suffix = issues.length > 20 ? `\n... ${issues.length - 20}개 추가 이슈` : '';
    fail(`공개 산출물 안전 검증 실패\n${preview}${suffix}`);
  }
}

function assertKeywordMetadata() {
  [
    [paths.dataRaw('keyword_data_product.json'), paths.dataRaw('keyword_data_product.meta.json')],
    [paths.dataRaw('keyword_data_지역.json'), paths.dataRaw('keyword_data_지역.meta.json')],
    [paths.dataProcessed('keyword_data_product_relevant.json'), paths.dataProcessed('keyword_data_product_relevant.meta.json')],
    [paths.dataProcessed('keyword_data_지역_30이상.md'), paths.dataProcessed('keyword_data_지역_30이상.meta.json')],
  ].forEach(([dataPath, metaPath]) => {
    if (!fs.existsSync(dataPath)) fail(`키워드 데이터가 없습니다: ${dataPath}`);
    if (!fs.existsSync(metaPath)) fail(`키워드 메타데이터가 없습니다: ${metaPath}`);
    const meta = readJsonFile(metaPath, null);
    if (!meta || typeof meta !== 'object') fail(`키워드 메타데이터는 객체여야 합니다: ${metaPath}`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(meta.data_date || ''))) fail(`data_date 형식 오류: ${metaPath}`);
    if (Number.isNaN(Date.parse(meta.generated_at || ''))) fail(`generated_at 형식 오류: ${metaPath}`);
    if (!Number.isInteger(meta.row_count) || meta.row_count < 0) fail(`row_count 형식 오류: ${metaPath}`);
    if (meta.estimate_policy !== 'lt10_as_5') fail(`estimate_policy 형식 오류: ${metaPath}`);
  });
}

function assertKeywordEstimateFlags() {
  [
    paths.dataRaw('keyword_data_product.json'),
    paths.dataRaw('keyword_data_지역.json'),
    paths.dataProcessed('keyword_data_product_relevant.json'),
  ].forEach((filePath) => {
    const rows = readJsonFile(filePath, null);
    if (!Array.isArray(rows)) fail(`${filePath}는 배열이어야 합니다.`);
    rows.forEach((row, index) => {
      ['pcEstimated', 'mobileEstimated', 'totalEstimated'].forEach((field) => {
        if (typeof row[field] !== 'boolean') fail(`${filePath}[${index}].${field}는 boolean이어야 합니다.`);
      });
      const pcEstimated = String(row.pcRaw || '').includes('<');
      const mobileEstimated = String(row.mobileRaw || '').includes('<');
      if (row.pcEstimated !== pcEstimated) fail(`${filePath}[${index}].pcEstimated 값이 pcRaw와 맞지 않습니다.`);
      if (row.mobileEstimated !== mobileEstimated) fail(`${filePath}[${index}].mobileEstimated 값이 mobileRaw와 맞지 않습니다.`);
      if (row.totalEstimated !== (pcEstimated || mobileEstimated)) fail(`${filePath}[${index}].totalEstimated 값이 pc/mobile 추정 여부와 맞지 않습니다.`);
    });
  });
}

function assertLegacyKeywordMetadata() {
  const metaPath = paths.dataRaw('keyword_data.meta.json');
  const dataPath = paths.dataRaw('keyword_data.json');
  if (!fs.existsSync(metaPath) || !fs.existsSync(dataPath)) return;

  const meta = readJsonFile(metaPath, null);
  if (!meta || typeof meta !== 'object') fail(`레거시 키워드 메타데이터는 객체여야 합니다: ${metaPath}`);
  if (meta.data_date !== '2026-05-07') fail(`레거시 키워드 data_date는 원천 조회일 2026-05-07이어야 합니다: ${metaPath}`);
  if (meta.estimate_policy !== 'not_available_legacy_no_raw_thresholds') {
    fail(`레거시 키워드 estimate_policy는 raw threshold 부재를 표시해야 합니다: ${metaPath}`);
  }

  const rows = readJsonFile(dataPath, null);
  if (!Array.isArray(rows)) fail(`${dataPath}는 배열이어야 합니다.`);
  rows.forEach((row, index) => {
    ['pcEstimated', 'mobileEstimated', 'totalEstimated'].forEach((field) => {
      if (field in row) fail(`${dataPath}[${index}].${field}는 레거시 데이터에 쓰지 않습니다.`);
    });
  });
}

function assertTop10TableShape() {
  const reportPath = paths.outputReport('top10_analysis.md');
  if (!fs.existsSync(reportPath)) return;
  const lines = fs.readFileSync(reportPath, 'utf8').split(/\r?\n/);
  lines.forEach((line, index) => {
    if (!/^\|\s*\d+\s*\|/.test(line)) return;
    const cells = line.split('|');
    if (cells.length !== 7) {
      fail(`TOP10 리포트 표 컬럼 수 오류: ${reportPath}:${index + 1}`);
    }
  });
}

function assertPostValidationPolicy() {
  const policyPath = paths.config('post_validation_policy.json');
  const policy = readJsonFile(policyPath, null);
  if (!policy || typeof policy !== 'object') fail('post_validation_policy.json은 객체여야 합니다.');
  [
    'default_from_number',
    'field_story_length_from_number',
    'field_story_required_section_from_number',
    'internal_links_min',
  ].forEach((field) => {
    if (!Number.isInteger(policy[field]) || policy[field] <= 0) fail(`${field}는 양의 정수여야 합니다.`);
  });
  if (!String(policy.field_story_required_heading || '').startsWith('## ')) {
    fail('field_story_required_heading은 Markdown heading이어야 합니다.');
  }
  const body = policy.field_story_body_chars_no_spaces || {};
  if (!Number.isInteger(body.min) || !Number.isInteger(body.max) || body.min >= body.max) {
    fail('field_story_body_chars_no_spaces min/max 형식 오류');
  }
}

function assertStrategySources() {
  [
    {
      id: 'active_topic_queue',
      markdownPath: paths.docsStrategy('ACTIVE_TOPIC_QUEUE.md'),
      sourcePath: paths.docsStrategy('ACTIVE_TOPIC_QUEUE.json'),
    },
    {
      id: 'posting_registry',
      markdownPath: paths.docsStrategy('POSTING_REGISTRY.md'),
      sourcePath: paths.docsStrategy('POSTING_REGISTRY.json'),
    },
  ].forEach((doc) => {
    const source = readJsonFile(doc.sourcePath, null);
    if (!source || source.schema_version !== 1 || !Array.isArray(source.blocks)) {
      fail(`전략 JSON source 형식 오류: ${doc.sourcePath}`);
    }
    assertNoDrift(doc);
  });
}

function main() {
  assertArrayConfig(paths.config('tracking_keywords.json'), ['keyword', 'hub', 'postNo']);
  assertArrayConfig(paths.config('top10_keywords.json'), ['keyword', 'hub']);
  assertArrayConfig(paths.config('regional_seed_keywords.json'));
  assertArrayConfig(paths.config('product_seed_keywords.json'));
  assertHistory();
  assertPostingRegistry();
  assertKeywordMetadata();
  assertKeywordEstimateFlags();
  assertLegacyKeywordMetadata();
  assertTop10TableShape();
  assertPostValidationPolicy();
  assertStrategySources();
  assertPublicGeneratedOutputs();
  console.log('데이터 스키마 검증 완료');
}

main();
