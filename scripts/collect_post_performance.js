const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_REPORTS_DIR = path.join(ROOT_DIR, 'outputs', 'reports', 'daily');
const DEFAULT_REGISTRY_PATH = path.join(ROOT_DIR, 'docs', 'strategy', 'POSTING_REGISTRY.json');
const DEFAULT_TAXONOMY_PATH = path.join(ROOT_DIR, 'docs', 'strategy', 'SEO_TAXONOMY.json');
const DEFAULT_LEDGER_PATH = path.join(ROOT_DIR, 'data', 'performance', 'post_performance.json');
const CONFIRMED_TITLE_HISTORY = {
  // 등록부에는 현재 제목만 남아 있는 086번의 사용자 확인 발행 제목 이력이다.
  '086': ['평수별 중문 설치 비용 확인할 3가지 기준'],
};

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function normalizePostNo(value) {
  const match = String(value || '').trim().match(/^(\d{1,3})(-\d+)?/);
  if (!match) return '';
  return `${match[1].padStart(3, '0')}${match[2] || ''}`;
}

function normalizeTopPostIdentifier(value) {
  const text = String(value || '').trim();
  if (!text || text === '-') return '';

  const reviewReels = text.match(/^리뷰릴스\s*-\s*(\d{1,3})$/);
  if (reviewReels) return `리뷰릴스-${reviewReels[1].padStart(3, '0')}`;

  return normalizePostNo(text);
}

function normalizeTitle(value) {
  return String(value || '')
    .normalize('NFC')
    .toLocaleLowerCase('ko-KR')
    .replace(/[\s\p{P}\p{S}]/gu, '');
}

function normalizeHeader(value) {
  return String(value || '')
    .replace(/[\s*_`]/g, '')
    .trim();
}

function splitMarkdownRow(line) {
  const trimmed = String(line || '').trim();
  if (!trimmed.startsWith('|') || !trimmed.endsWith('|')) return null;
  return trimmed.slice(1, -1).split('|').map((cell) => cell.trim());
}

function isDividerRow(cells) {
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell.trim()));
}

function extractMarkdownTables(sectionText) {
  const lines = sectionText.split(/\r?\n/);
  const tables = [];

  for (let index = 0; index < lines.length - 1; index += 1) {
    const headers = splitMarkdownRow(lines[index]);
    const divider = splitMarkdownRow(lines[index + 1]);
    if (!headers || !divider || !isDividerRow(divider)) continue;

    const rows = [];
    index += 2;
    while (index < lines.length) {
      const row = splitMarkdownRow(lines[index]);
      if (!row || isDividerRow(row)) break;
      rows.push(row);
      index += 1;
    }
    tables.push({ headers, rows });
  }

  return tables;
}

function topSection(content) {
  const lines = content.split(/\r?\n/);
  const start = lines.findIndex((line) => /^##\s+게시글\s*TOP/.test(line.trim()));
  if (start < 0) return null;

  const body = [];
  for (let index = start + 1; index < lines.length; index += 1) {
    if (/^##\s+/.test(lines[index])) break;
    body.push(lines[index]);
  }
  return body.join('\n');
}

function topTableColumns(headers) {
  const normalized = headers.map(normalizeHeader);
  const postNoIndex = normalized.findIndex((header) => header === '글번호');
  const titleIndex = normalized.findIndex((header) => header === '제목' || header === '게시글');
  const viewsIndex = normalized.findIndex((header) => header === '조회수');
  const publishedAtIndex = normalized.findIndex((header) => header === '작성일');
  const rankIndex = normalized.findIndex((header) => header === '순위');

  if (titleIndex < 0 || viewsIndex < 0 || rankIndex < 0) return null;
  return {
    postNoIndex,
    titleIndex,
    viewsIndex,
    publishedAtIndex,
    rankIndex,
  };
}

function parseReportDate(fileName) {
  const match = String(fileName).match(/^(\d{4}-\d{2}-\d{2})_seo_watch\.md$/);
  return match ? match[1] : '';
}

function toUtcDay(dateText) {
  const match = String(dateText || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const value = Date.UTC(year, month - 1, day);
  const probe = new Date(value);
  if (probe.getUTCFullYear() !== year || probe.getUTCMonth() !== month - 1 || probe.getUTCDate() !== day) return null;
  return value;
}

function isoDateFromCell(value, reportDate) {
  const text = String(value || '').trim();
  if (!text || text === '-') return '';
  if (toUtcDay(text) !== null) return text;

  const match = text.match(/^(\d{1,2})\s*(?:\/|월\s*)(\d{1,2})(?:일)?$/);
  if (!match) return '';

  const reportDay = toUtcDay(reportDate);
  if (reportDay === null) return '';
  const report = new Date(reportDay);
  const month = Number(match[1]);
  const day = Number(match[2]);
  let year = report.getUTCFullYear();
  const candidate = Date.UTC(year, month - 1, day);
  if (candidate > reportDay) year -= 1;

  const result = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return toUtcDay(result) === null ? '' : result;
}

function dayDifference(date, publishedAt) {
  const dateValue = toUtcDay(date);
  const publishedValue = toUtcDay(publishedAt);
  if (dateValue === null || publishedValue === null) return null;
  return Math.round((dateValue - publishedValue) / DAY_MS);
}

function metricValue(value) {
  const text = String(value || '').trim();
  const compact = text.replace(/,/g, '');
  if (/^-?\d+(?:\.\d+)?$/.test(compact)) return Number(compact);
  return text;
}

function tableRowsToObjects(table, columns, reportDate) {
  return table.rows.map((row) => ({
    postNo: columns.postNoIndex < 0 ? '' : normalizeTopPostIdentifier(row[columns.postNoIndex]),
    title: String(row[columns.titleIndex] || '').trim(),
    views: metricValue(row[columns.viewsIndex]),
    rank: metricValue(row[columns.rankIndex]),
    tablePublishedAt: columns.publishedAtIndex < 0
      ? ''
      : isoDateFromCell(row[columns.publishedAtIndex], reportDate),
  })).filter((row) => row.title);
}

function registryEntries(registry) {
  const byPostNo = new Map();
  const titleMap = new Map();

  function entryFor(postNo) {
    const existing = byPostNo.get(postNo);
    if (existing) return existing;
    const entry = {
      post_no: postNo,
      title: '',
      published_at: null,
      published_at_source: 'unknown',
      title_keys: new Set(),
      retired: false,
    };
    byPostNo.set(postNo, entry);
    return entry;
  }

  function addTitle(postNo, title) {
    const text = String(title || '').trim();
    const titleKey = normalizeTitle(text);
    if (!text || text === '폐기' || !titleKey) return;

    const entry = entryFor(postNo);
    if (!entry.title) entry.title = text;
    entry.title_keys.add(titleKey);

    const titleMatches = titleMap.get(titleKey) || new Set();
    titleMatches.add(postNo);
    titleMap.set(titleKey, titleMatches);
  }

  function memoTitleAliases(row) {
    return row.flatMap((cell) => [...String(cell || '').matchAll(/발행 제목:\s*([^.]+)/g)])
      .map((match) => match[1].trim())
      .filter(Boolean);
  }

  (registry.blocks || [])
    .filter((block) => block.type === 'table' && Array.isArray(block.header) && Array.isArray(block.rows))
    .forEach((block) => {
      const headers = block.header.map(normalizeHeader);
      const postNoIndex = headers.findIndex((header) => header === '#' || header === '글번호' || header === '글');
      const titleIndex = headers.findIndex((header) => header === '포스팅제목' || header === '포스트제목');
      const publishedAtIndex = headers.findIndex((header) => header === '발행일(TOP20작성일기준)' || header === '발행일');
      if (postNoIndex < 0) return;

      block.rows.forEach((row) => {
        const postNo = normalizePostNo(row[postNoIndex]);
        if (!postNo) return;

        const entry = entryFor(postNo);
        const publishedAt = publishedAtIndex < 0 ? null : isoDateFromCell(row[publishedAtIndex], '9999-12-31');
        if (entry.published_at === null && publishedAt) {
          entry.published_at = publishedAt;
          entry.published_at_source = 'registry';
        }
        if (row.some((cell) => String(cell || '').includes('폐기'))) entry.retired = true;

        if (titleIndex >= 0) addTitle(postNo, row[titleIndex]);
        memoTitleAliases(row).forEach((title) => addTitle(postNo, title));
      });
    });

  Object.entries(CONFIRMED_TITLE_HISTORY).forEach(([postNo, titles]) => {
    if (!byPostNo.has(postNo)) return;
    titles.forEach((title) => addTitle(postNo, title));
  });

  return { byPostNo, titleMap };
}

function listDailyReports(reportsDir) {
  if (!fs.existsSync(reportsDir)) return [];
  return fs.readdirSync(reportsDir)
    .map((fileName) => ({ fileName, date: parseReportDate(fileName) }))
    .filter((item) => item.date)
    .sort((left, right) => left.date.localeCompare(right.date));
}

function collectDailyEvidence(reportsDir, titleMap) {
  const appearances = [];
  const validDates = new Set();
  const allReportDates = [];
  const unmapped = new Map();

  listDailyReports(reportsDir).forEach(({ fileName, date }) => {
    allReportDates.push(date);
    const content = fs.readFileSync(path.join(reportsDir, fileName), 'utf8');
    const section = topSection(content);
    if (!section) return;

    extractMarkdownTables(section).forEach((table) => {
      const columns = topTableColumns(table.headers);
      if (!columns) return;
      if (table.rows.length >= 5) validDates.add(date);

      tableRowsToObjects(table, columns, date).forEach((row) => {
        if (row.postNo) {
          appearances.push({ postNo: row.postNo, date, ...row });
          return;
        }
        const matches = [...(titleMap.get(normalizeTitle(row.title)) || [])];
        if (matches.length !== 1) {
          const key = normalizeTitle(row.title);
          const existing = unmapped.get(key) || {
            title: row.title,
            dates: new Set(),
            reason: '등록부에서 글번호를 찾지 못함',
          };
          existing.dates.add(date);
          unmapped.set(key, existing);
          return;
        }
        appearances.push({ ...row, postNo: matches[0], date });
      });
    });
  });

  return { appearances, validDates, allReportDates, unmapped };
}

function addDirectIdentifierEntries(byPostNo, appearances) {
  appearances.forEach((appearance) => {
    if (byPostNo.has(appearance.postNo) || !/^리뷰릴스-\d{3}$/.test(appearance.postNo)) return;
    byPostNo.set(appearance.postNo, {
      post_no: appearance.postNo,
      title: appearance.title,
      published_at: null,
      published_at_source: 'unknown',
      title_keys: new Set(),
      retired: false,
    });
  });
}

function taxonomyInfo(postNo, taxonomy) {
  const cutoverPostNo = Number((taxonomy.migration || {}).cutover_post_no || 152);
  if (Number.parseInt(postNo, 10) < cutoverPostNo) {
    return { queue_id: '', hub_ids: [], cluster_ids: [] };
  }

  const assignment = ((taxonomy.assignments || {})[`post:${postNo}`]) || {};
  const queueRef = (assignment.source_refs || []).find((reference) => /^queue:/.test(reference));
  return {
    queue_id: queueRef ? queueRef.replace(/^queue:/, '') : '',
    hub_ids: Array.isArray(assignment.hub_ids) ? [...assignment.hub_ids] : [],
    cluster_ids: Array.isArray(assignment.cluster_ids) ? [...assignment.cluster_ids] : [],
  };
}

function verdictForPost({ publishedAt, latestReportDate, observations, validDates }) {
  const latestDay = dayDifference(latestReportDate, publishedAt);
  const windowObservations = observations.filter((observation) => observation.day >= 3 && observation.day <= 14);
  const observedDays = [...validDates]
    .filter((date) => {
      const day = dayDifference(date, publishedAt);
      return day !== null && day >= 0 && day <= 14;
    })
    .length;

  if (latestDay !== null && latestDay < 3) {
    return {
      observed_days: observedDays,
      verdict: 'pending',
      verdict_reason: '발행 후 3일 미만',
    };
  }
  if (windowObservations.length >= 2) {
    return {
      observed_days: observedDays,
      verdict: 'landed',
      verdict_reason: '발행 3~14일 구간에 TOP20 2회 등장',
    };
  }
  if (observedDays >= 5) {
    return {
      observed_days: observedDays,
      verdict: 'faded',
      verdict_reason: `발행 3~14일 구간 TOP20 ${windowObservations.length}회 등장, 관측 유효일 ${observedDays}일`,
    };
  }
  return {
    observed_days: observedDays,
    verdict: 'unobserved',
    verdict_reason: `발행 3~14일 구간 TOP20 ${windowObservations.length}회 등장, 관측 유효일 ${observedDays}일`,
  };
}

function collectPostPerformance({
  reportsDir = DEFAULT_REPORTS_DIR,
  registryPath = DEFAULT_REGISTRY_PATH,
  taxonomyPath = DEFAULT_TAXONOMY_PATH,
} = {}) {
  const { byPostNo, titleMap } = registryEntries(readJson(registryPath));
  const taxonomy = readJson(taxonomyPath);
  const evidence = collectDailyEvidence(reportsDir, titleMap);
  addDirectIdentifierEntries(byPostNo, evidence.appearances);

  // daily는 파일 날짜 순으로 읽으므로, 발행일이 없는 글에는 가장 이른 TOP20 작성일만 쓴다.
  evidence.appearances.forEach((appearance) => {
    const entry = byPostNo.get(appearance.postNo);
    if (!entry || entry.published_at !== null || !appearance.tablePublishedAt) return;
    entry.published_at = appearance.tablePublishedAt;
    entry.published_at_source = 'daily';
  });

  const latestReportDate = evidence.allReportDates[evidence.allReportDates.length - 1] || '';
  const appearancesByPostNo = new Map();
  evidence.appearances.forEach((appearance) => {
    const values = appearancesByPostNo.get(appearance.postNo) || [];
    values.push(appearance);
    appearancesByPostNo.set(appearance.postNo, values);
  });

  const posts = [...byPostNo.values()]
    .map((entry) => {
      const observations = (appearancesByPostNo.get(entry.post_no) || [])
        .map((appearance) => ({
          date: appearance.date,
          day: entry.published_at === null ? null : dayDifference(appearance.date, entry.published_at),
          rank: appearance.rank,
          views: appearance.views,
        }))
        .sort((left, right) => left.date.localeCompare(right.date));
      if (entry.published_at === null) {
        return {
          post_no: entry.post_no,
          title: entry.title,
          published_at: null,
          published_at_source: 'unknown',
          ...taxonomyInfo(entry.post_no, taxonomy),
          observations,
          observed_days: 0,
          verdict: 'unobserved',
          verdict_at: latestReportDate,
          verdict_reason: entry.retired ? '발행일 미상; 폐기 상태' : '발행일 미상',
        };
      }
      const verdict = verdictForPost({
        publishedAt: entry.published_at,
        latestReportDate,
        observations,
        validDates: evidence.validDates,
      });
      return {
        post_no: entry.post_no,
        title: entry.title,
        published_at: entry.published_at,
        published_at_source: entry.published_at_source,
        ...taxonomyInfo(entry.post_no, taxonomy),
        observations,
        ...verdict,
        verdict_at: latestReportDate,
        verdict_reason: entry.retired ? `${verdict.verdict_reason}; 폐기 상태` : verdict.verdict_reason,
      };
    })
    .sort((left, right) => left.post_no.localeCompare(right.post_no, 'en', { numeric: true }));

  return {
    schema_version: 1,
    id: 'post_performance',
    updated_at: latestReportDate,
    posts,
    unmapped_titles: [...evidence.unmapped.values()]
      .map((item) => ({
        title: item.title,
        dates: [...item.dates].sort(),
        reason: item.reason,
      }))
      .sort((left, right) => left.title.localeCompare(right.title, 'ko-KR')),
  };
}

function parseArgs(argv) {
  const options = { write: false };
  for (const arg of argv) {
    if (arg === '--write') options.write = true;
  }
  return options;
}

function writeLedger(ledger, ledgerPath = DEFAULT_LEDGER_PATH) {
  fs.mkdirSync(path.dirname(ledgerPath), { recursive: true });
  fs.writeFileSync(ledgerPath, `${JSON.stringify(ledger, null, 2)}\n`, 'utf8');
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const ledger = collectPostPerformance();
  if (options.write) writeLedger(ledger);
  console.log(`post performance collected: ${ledger.posts.length} posts, ${ledger.unmapped_titles.length} unmapped titles${options.write ? ' (written)' : ''}`);
}

if (require.main === module) main();

module.exports = {
  collectPostPerformance,
  extractMarkdownTables,
  normalizeTitle,
  registryEntries,
  topTableColumns,
  verdictForPost,
  writeLedger,
};
