const fs = require('fs');
const path = require('path');
const { paths } = require('./lib/paths');

const REQUIRED_COLUMNS = [
  'id',
  'lane',
  'status',
  'topic',
  'primary_keyword',
  'market_volume',
  'current_signal',
  'linked_asset',
  'next_action',
  'due',
  'risk',
  'updated_at',
];

const ALLOWED_LANES = new Set([
  'protect',
  'attack',
  'experiment',
  'exclude',
]);

const ALLOWED_STATUSES = new Set([
  'internal_link',
  'rewrite_candidate',
  'scorecard_needed',
  'draft_ready',
  'publish_waiting',
  'monitor_3d',
  'monitor_7d',
  'excluded',
  'done',
]);

const FORBIDDEN_ACTIVE_PATTERNS = [
  { label: '싱크대', pattern: /싱크대/ },
  { label: '현관문', pattern: /현관문/ },
  { label: '방화문', pattern: /방화문/ },
  { label: '패브릭중문', pattern: /패브릭\s*중문|패브릭중문/ },
  { label: '중문파티션', pattern: /중문\s*파티션|중문파티션/ },
  { label: '무타공중문', pattern: /무타공\s*중문|무타공중문/ },
  { label: '셀프중문', pattern: /셀프\s*중문|셀프중문/ },
  { label: '비대칭양개형중문', pattern: /비대칭\s*양개형\s*중문|비대칭양개형중문/ },
  { label: '문틀만 단독 교체 가능', pattern: /문틀만\s*단독\s*교체\s*가능/ },
  { label: '중문 자재판매', pattern: /중문\s*자재\s*판매|중문자재판매|자재판매/ },
];

function parseArgs(argv) {
  const args = {
    file: paths.docsStrategy('ACTIVE_TOPIC_QUEUE.md'),
    latestDaily: false,
    dailyFile: null,
    dailyDir: paths.outputReport(path.join('daily')),
    today: todayKst(),
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--file') {
      args.file = path.resolve(argv[index + 1]);
      index += 1;
    } else if (arg.startsWith('--file=')) {
      args.file = path.resolve(arg.split('=')[1]);
    } else if (arg === '--latest-daily') {
      args.latestDaily = true;
    } else if (arg === '--daily-file') {
      args.dailyFile = path.resolve(argv[index + 1]);
      index += 1;
    } else if (arg.startsWith('--daily-file=')) {
      args.dailyFile = path.resolve(arg.split('=')[1]);
    } else if (arg === '--daily-dir') {
      args.dailyDir = path.resolve(argv[index + 1]);
      index += 1;
    } else if (arg.startsWith('--daily-dir=')) {
      args.dailyDir = path.resolve(arg.split('=')[1]);
    } else if (arg === '--today') {
      args.today = argv[index + 1];
      index += 1;
    } else if (arg.startsWith('--today=')) {
      args.today = arg.split('=')[1];
    }
  }

  if (args.dailyFile) args.latestDaily = true;
  return args;
}

function todayKst() {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(new Date());
}

function splitTableLine(line) {
  const trimmed = String(line || '').trim();
  if (!trimmed.startsWith('|') || !trimmed.endsWith('|')) return null;
  return trimmed
    .slice(1, -1)
    .split('|')
    .map((cell) => cell.trim());
}

function isSeparatorLine(line) {
  const cells = splitTableLine(line);
  return Boolean(cells && cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell)));
}

function normalizeHeader(cells) {
  return cells.map((cell) => cell.toLowerCase());
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function hasEnumToken(text, token) {
  const pattern = new RegExp(`(^|[^A-Za-z0-9_])${escapeRegExp(token)}($|[^A-Za-z0-9_])`, 'i');
  return pattern.test(text);
}

function tableHasColumns(cells, requiredColumns) {
  const normalized = normalizeHeader(cells);
  return requiredColumns.every((column) => normalized.includes(column));
}

function findQueueTable(content) {
  const lines = content.split(/\r?\n/);

  for (let index = 0; index < lines.length; index += 1) {
    const cells = splitTableLine(lines[index]);
    if (!cells || !tableHasColumns(cells, REQUIRED_COLUMNS)) continue;

    const rows = [];
    let cursor = index + 1;
    if (isSeparatorLine(lines[cursor])) cursor += 1;

    for (; cursor < lines.length; cursor += 1) {
      const rowCells = splitTableLine(lines[cursor]);
      if (!rowCells) break;
      if (isSeparatorLine(lines[cursor])) continue;

      const row = {};
      cells.forEach((column, columnIndex) => {
        row[column] = rowCells[columnIndex] || '';
      });
      rows.push(row);
    }

    return { header: cells, rows };
  }

  return null;
}

function activeDecisionText(row) {
  return ['topic', 'primary_keyword', 'current_signal', 'next_action']
    .map((column) => row[column] || '')
    .join(' ');
}

function isPlaceholder(value) {
  const normalized = String(value || '').trim();
  return normalized === '' || normalized === '-' || /^n\/a$/i.test(normalized) || /^todo$/i.test(normalized);
}

function parseMarketVolume(value) {
  const normalized = String(value || '').replace(/,/g, '').trim();
  if (normalized === '') return null;
  const digits = normalized.replace(/[^\d]/g, '');
  if (digits === '') return null;
  return Number(digits);
}

function isIsoDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || '').trim());
}

function parseIsoDate(value) {
  if (!isIsoDate(value)) return null;
  const [year, month, day] = String(value).split('-').map(Number);
  return Date.UTC(year, month - 1, day);
}

function daysBetween(startDate, endDate) {
  const start = parseIsoDate(startDate);
  const end = parseIsoDate(endDate);
  if (start === null || end === null) return null;
  return Math.floor((end - start) / 86400000);
}

function isRewriteBan(text) {
  return /금지|하지 않는다|하지 않음/.test(text);
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function dailyReflectionText(row) {
  return Object.entries(row)
    .filter(([column]) => column.toLowerCase() !== 'queue_id')
    .map(([, value]) => value || '')
    .join(' ');
}

function inferDailyContract(row) {
  const text = dailyReflectionText(row);
  const lanes = [...ALLOWED_LANES].filter((lane) => hasEnumToken(text, lane));
  const statuses = [...ALLOWED_STATUSES].filter((status) => hasEnumToken(text, status));

  if (/제외/.test(text)) {
    lanes.push('exclude');
    statuses.push('excluded');
  }

  if (/내부\s*링크|내부링크/.test(text)) statuses.push('internal_link');
  if (/발행\s*대기|발행대기|URL\s*대기|URL대기/.test(text)) statuses.push('publish_waiting');
  if (/scorecard|스코어카드|점수표/i.test(text)) statuses.push('scorecard_needed');
  if (/3일\s*관찰|3일.*반복|monitor_3d/i.test(text)) statuses.push('monitor_3d');
  if (/7일\s*관찰|7일.*반복|monitor_7d/i.test(text)) statuses.push('monitor_7d');

  return {
    lanes: unique(lanes),
    statuses: unique(statuses),
  };
}

function validateRow(row, index) {
  const fails = [];
  const label = row.id || `row ${index + 1}`;

  if (!/^Q-\d{3}$/.test(row.id || '')) {
    fails.push(`${label}: id must match Q-000 format`);
  }

  if (!ALLOWED_LANES.has(row.lane)) {
    fails.push(`${label}: invalid lane ${row.lane}`);
  }

  if (!ALLOWED_STATUSES.has(row.status)) {
    fails.push(`${label}: invalid status ${row.status}`);
  }

  if (!isIsoDate(row.due)) {
    fails.push(`${label}: due must be YYYY-MM-DD`);
  }

  if (!isIsoDate(row.updated_at)) {
    fails.push(`${label}: updated_at must be YYYY-MM-DD`);
  }

  if (row.lane === 'attack') {
    const marketVolume = parseMarketVolume(row.market_volume);
    if (marketVolume === null || marketVolume <= 0) {
      fails.push(`${label}: attack lane needs numeric market_volume`);
    }
  }

  if (row.lane === 'exclude' && row.status !== 'excluded') {
    fails.push(`${label}: exclude lane must use excluded status`);
  }

  if (row.status === 'excluded' && row.lane !== 'exclude') {
    fails.push(`${label}: excluded status must use exclude lane`);
  }

  if (row.lane === 'exclude' && /작성|발행|원고|scorecard|스코어카드|점수표/i.test(row.next_action || '')) {
    fails.push(`${label}: exclude lane cannot have writing, publish, or scorecard action`);
  }

  if (row.lane === 'protect' && /본문\s*대수술|전면\s*리라이팅|전면\s*rewrite|대수술|rewrite/i.test(row.next_action || '') && !isRewriteBan(row.next_action || '')) {
    fails.push(`${label}: protect lane cannot direct major rewrite`);
  }

  if (row.status === 'publish_waiting' && isPlaceholder(row.linked_asset)) {
    fails.push(`${label}: publish_waiting needs linked_asset`);
  }

  if (row.status === 'scorecard_needed' && !/scorecard|스코어카드|점수표/i.test(row.next_action || '')) {
    fails.push(`${label}: scorecard_needed next_action must mention scorecard`);
  }

  if (row.lane !== 'exclude') {
    ['current_signal', 'linked_asset', 'next_action', 'risk'].forEach((column) => {
      if (isPlaceholder(row[column])) fails.push(`${label}: ${column} is required for active lane`);
    });

    const text = activeDecisionText(row);
    FORBIDDEN_ACTIVE_PATTERNS.forEach(({ label: termLabel, pattern }) => {
      if (pattern.test(text)) {
        fails.push(`${label}: forbidden term in active row: ${termLabel}`);
      }
    });
  }

  return fails;
}

function latestDailyReport(dailyDir) {
  if (!dailyDir || !fs.existsSync(dailyDir)) return null;
  const candidates = fs.readdirSync(dailyDir)
    .filter((fileName) => /^\d{4}-\d{2}-\d{2}_seo_watch\.md$/.test(fileName))
    .sort((a, b) => b.localeCompare(a));
  return candidates.length > 0 ? path.join(dailyDir, candidates[0]) : null;
}

function dateFromDailyFile(filePath) {
  const match = path.basename(filePath || '').match(/^(\d{4}-\d{2}-\d{2})_seo_watch\.md$/);
  return match ? match[1] : null;
}

function findSectionLines(content, headingPattern) {
  const lines = content.split(/\r?\n/);
  const start = lines.findIndex((line) => headingPattern.test(line));
  if (start === -1) return null;

  let end = lines.length;
  for (let index = start + 1; index < lines.length; index += 1) {
    if (/^##\s+/.test(lines[index])) {
      end = index;
      break;
    }
  }

  return lines.slice(start + 1, end);
}

function parseDailyBoardReflection(filePath) {
  const result = {
    filePath,
    date: dateFromDailyFile(filePath),
    ids: [],
    rows: [],
    fails: [],
  };

  if (!filePath || !fs.existsSync(filePath)) {
    result.fails.push(`latest daily report not found: ${filePath || '(none)'}`);
    return result;
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const sectionLines = findSectionLines(content, /^##+\s*오늘 보드 반영\s*$/);
  if (!sectionLines) {
    result.fails.push(`${path.basename(filePath)}: missing "오늘 보드 반영" section`);
    return result;
  }

  const headerIndex = sectionLines.findIndex((line) => {
    const cells = splitTableLine(line);
    return cells && normalizeHeader(cells).includes('queue_id');
  });

  if (headerIndex === -1) {
    result.fails.push(`${path.basename(filePath)}: 오늘 보드 반영 table needs queue_id column`);
    return result;
  }

  const header = splitTableLine(sectionLines[headerIndex]);
  const normalizedHeader = normalizeHeader(header);
  const queueIdIndex = normalizedHeader.indexOf('queue_id');

  let cursor = headerIndex + 1;
  if (isSeparatorLine(sectionLines[cursor])) cursor += 1;

  for (; cursor < sectionLines.length; cursor += 1) {
    const cells = splitTableLine(sectionLines[cursor]);
    if (!cells) break;
    if (isSeparatorLine(sectionLines[cursor])) continue;
    const row = {};
    header.forEach((column, columnIndex) => {
      row[column] = cells[columnIndex] || '';
    });
    result.rows.push(row);
    const queueId = cells[queueIdIndex] || '';
    if (/^Q-\d{3}$/.test(queueId)) result.ids.push(queueId);
    else result.fails.push(`${path.basename(filePath)}: invalid queue_id ${queueId || '(empty)'}`);
  }

  if (result.ids.length === 0) {
    result.fails.push(`${path.basename(filePath)}: 오늘 보드 반영 has no queue_id rows`);
  }

  return result;
}

function validateDailyReflection(result, rowsById, args) {
  const dailyFile = args.dailyFile || latestDailyReport(args.dailyDir);
  const reflection = parseDailyBoardReflection(dailyFile);
  result.dailyFile = reflection.filePath;
  const dailyBase = path.basename(reflection.filePath || '(none)');

  reflection.fails.forEach((item) => result.fails.push(item));
  reflection.rows.forEach((dailyRow) => {
    const queueIdColumn = Object.keys(dailyRow).find((column) => column.toLowerCase() === 'queue_id');
    const id = queueIdColumn ? dailyRow[queueIdColumn] : '';
    const queueRow = rowsById.get(id);
    if (!queueRow) {
      result.fails.push(`${dailyBase}: queue_id not found in ACTIVE_TOPIC_QUEUE: ${id}`);
      return;
    }

    const inferred = inferDailyContract(dailyRow);
    inferred.lanes.forEach((lane) => {
      if (lane !== queueRow.lane) {
        result.fails.push(`${dailyBase}: ${id} daily lane ${lane} conflicts with queue lane ${queueRow.lane}`);
      }
    });
    inferred.statuses.forEach((status) => {
      if (status !== queueRow.status) {
        result.fails.push(`${dailyBase}: ${id} daily status ${status} conflicts with queue status ${queueRow.status}`);
      }
    });
  });

  if (reflection.date) {
    rowsById.forEach((row) => {
      if (isIsoDate(row.updated_at) && daysBetween(row.updated_at, reflection.date) > 0) {
        result.warns.push(`${row.id}: updated_at ${row.updated_at} is older than latest daily ${reflection.date}`);
      }
    });
  }
}

function validateActiveQueue(filePath, options = {}) {
  const args = {
    latestDaily: false,
    dailyFile: null,
    dailyDir: paths.outputReport(path.join('daily')),
    today: todayKst(),
    ...options,
  };

  const result = {
    status: 'ALLOW',
    filePath,
    dailyFile: null,
    fails: [],
    warns: [],
  };

  if (!filePath || !fs.existsSync(filePath)) {
    result.status = 'BLOCK';
    result.fails.push(`active topic queue not found: ${filePath || '(none)'}`);
    return result;
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const table = findQueueTable(content);
  if (!table) {
    result.status = 'BLOCK';
    result.fails.push('queue table with v2 required columns not found');
    return result;
  }

  REQUIRED_COLUMNS.forEach((column) => {
    if (!table.header.includes(column)) {
      result.fails.push(`required column missing: ${column}`);
    }
  });

  if (table.rows.length < 8) {
    result.fails.push(`queue table has too few rows: ${table.rows.length} < 8`);
  }

  if (table.rows.length > 15) {
    result.fails.push(`queue table has too many rows: ${table.rows.length} > 15`);
  }

  const rowsById = new Map();
  table.rows.forEach((row, index) => {
    if (row.id && rowsById.has(row.id)) result.fails.push(`${row.id}: duplicate id`);
    if (row.id) rowsById.set(row.id, row);
    result.fails.push(...validateRow(row, index));
  });

  const laneCounts = table.rows.reduce((counts, row) => {
    counts[row.lane] = (counts[row.lane] || 0) + 1;
    return counts;
  }, {});

  if ((laneCounts.attack || 0) < 3) {
    result.warns.push(`attack lane has fewer than 3 rows: ${laneCounts.attack || 0}`);
  }

  if ((laneCounts.protect || 0) / Math.max(table.rows.length, 1) > 0.5) {
    result.warns.push(`protect lane exceeds 50% of queue: ${laneCounts.protect}/${table.rows.length}`);
  }

  const highVolumeAttackCount = table.rows.filter((row) => row.lane === 'attack' && parseMarketVolume(row.market_volume) >= 2000).length;
  if (highVolumeAttackCount === 0) {
    result.warns.push('no attack row with market_volume >= 2000');
  }

  table.rows.forEach((row) => {
    const age = daysBetween(row.updated_at, args.today);
    if (row.status === 'scorecard_needed' && age !== null && age >= 7) {
      result.warns.push(`${row.id}: scorecard_needed has been open for ${age} days`);
    }
    if (row.status === 'monitor_7d' && age !== null && age >= 14) {
      result.warns.push(`${row.id}: monitor_7d has been open for ${age} days`);
    }
  });

  if (args.latestDaily) validateDailyReflection(result, rowsById, args);

  if (result.fails.length > 0) result.status = 'BLOCK';
  return result;
}

function printResult(result) {
  const label = result.status === 'ALLOW' ? 'ALLOW' : 'FAIL';
  console.log(`${label}: active topic queue contract v2`);
  console.log(`file: ${result.filePath || '(none)'}`);
  if (result.dailyFile) console.log(`daily: ${result.dailyFile}`);
  result.fails.forEach((item) => console.log(`FAIL: ${item}`));
  result.warns.forEach((item) => console.log(`WARN: ${item}`));
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const result = validateActiveQueue(args.file, args);
  printResult(result);
  if (result.status !== 'ALLOW') process.exit(1);
}

if (require.main === module) {
  main();
}

module.exports = {
  validateActiveQueue,
  findQueueTable,
  parseDailyBoardReflection,
};
