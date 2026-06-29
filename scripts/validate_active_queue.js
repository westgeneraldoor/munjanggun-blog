const fs = require('fs');
const path = require('path');
const { paths } = require('./lib/paths');

const REQUIRED_COLUMNS = [
  'id',
  'status',
  'priority',
  'portfolio_class',
  'topic',
  'primary_keyword',
  'intent',
  'action',
  'linked_post',
  'market_volume',
  '3d_signal',
  'evidence_refs',
  'risk',
  'next_decision_date',
];

const ALLOWED_STATUSES = new Set([
  'protect',
  'publish_waiting',
  'scorecard_needed',
  'draft_ready',
  'monitor_3d',
  'rewrite_candidate',
  'internal_link',
  'excluded',
]);

const ALLOWED_PORTFOLIO_CLASSES = new Set([
  'defense',
  'attack',
  'experiment',
  'excluded',
]);

const FORBIDDEN_ACTIVE_PATTERNS = [
  { label: '싱크대', pattern: /싱크대/ },
  { label: '현관문', pattern: /현관문/ },
  { label: '방화문', pattern: /방화문/ },
  { label: '패브릭', pattern: /패브릭/ },
  { label: '중문파티션', pattern: /중문\s*파티션/ },
  { label: '무타공중문', pattern: /무\s*타공\s*중문/ },
  { label: '셀프중문', pattern: /셀프\s*중문/ },
  { label: '비대칭양개형중문', pattern: /비대칭\s*양개형\s*중문/ },
  { label: '문틀만 단독 교체 가능', pattern: /문틀만\s*단독\s*교체\s*가능/ },
  { label: '중문 자재판매', pattern: /중문\s*자재\s*판매|중문자재판매|자재판매/ },
];

function parseArgs(argv) {
  const args = {
    file: paths.docsStrategy('ACTIVE_TOPIC_QUEUE.md'),
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--file') {
      args.file = path.resolve(argv[index + 1]);
      index += 1;
    } else if (arg.startsWith('--file=')) {
      args.file = path.resolve(arg.split('=')[1]);
    }
  }

  return args;
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

function findQueueTable(content) {
  const lines = content.split(/\r?\n/);

  for (let index = 0; index < lines.length; index += 1) {
    const cells = splitTableLine(lines[index]);
    if (!cells) continue;

    const normalized = cells.map((cell) => cell.toLowerCase());
    const hasAllRequired = REQUIRED_COLUMNS.every((column) => normalized.includes(column));
    if (!hasAllRequired) continue;

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
  return ['topic', 'primary_keyword', 'intent', 'action']
    .map((column) => row[column] || '')
    .join(' ');
}

function portfolioClasses(value) {
  return String(value || '')
    .split(/[+,/]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function validateRow(row, index) {
  const fails = [];
  const label = row.id || `row ${index + 1}`;

  REQUIRED_COLUMNS.forEach((column) => {
    if (!Object.prototype.hasOwnProperty.call(row, column)) {
      fails.push(`${label}: missing column ${column}`);
    }
  });

  if (!ALLOWED_STATUSES.has(row.status)) {
    fails.push(`${label}: invalid status ${row.status}`);
  }

  const classes = portfolioClasses(row.portfolio_class);
  if (classes.length === 0) {
    fails.push(`${label}: portfolio_class is empty`);
  } else {
    classes.forEach((item) => {
      if (!ALLOWED_PORTFOLIO_CLASSES.has(item)) {
        fails.push(`${label}: invalid portfolio_class ${item}`);
      }
    });
  }

  if (row.status === 'publish_waiting' && (!row.linked_post || row.linked_post === '-')) {
    fails.push(`${label}: publish_waiting needs linked_post`);
  }

  if (row.status === 'scorecard_needed' && !/scorecard|점수표|스코어카드/i.test(row.action || '')) {
    fails.push(`${label}: scorecard_needed action must mention scorecard`);
  }

  if (row.status !== 'excluded') {
    const text = activeDecisionText(row);
    FORBIDDEN_ACTIVE_PATTERNS.forEach(({ label: termLabel, pattern }) => {
      if (pattern.test(text)) {
        fails.push(`${label}: forbidden term in active row: ${termLabel}`);
      }
    });
  }

  if (!row.evidence_refs || row.evidence_refs === '-') {
    fails.push(`${label}: evidence_refs is required`);
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(row.next_decision_date || '')) {
    fails.push(`${label}: next_decision_date must be YYYY-MM-DD`);
  }

  return fails;
}

function validateActiveQueue(filePath) {
  const result = {
    status: 'ALLOW',
    filePath,
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
    result.fails.push('queue table with required columns not found');
    return result;
  }

  REQUIRED_COLUMNS.forEach((column) => {
    if (!table.header.includes(column)) {
      result.fails.push(`required column missing: ${column}`);
    }
  });

  if (table.rows.length === 0) {
    result.fails.push('queue table has no rows');
  }

  if (table.rows.length > 15) {
    result.fails.push(`queue table has too many rows: ${table.rows.length} > 15`);
  }

  const statuses = new Set();
  const classes = new Set();
  const ids = new Set();

  table.rows.forEach((row, index) => {
    if (ids.has(row.id)) result.fails.push(`${row.id}: duplicate id`);
    if (row.id) ids.add(row.id);
    if (row.status) statuses.add(row.status);
    portfolioClasses(row.portfolio_class).forEach((item) => classes.add(item));
    result.fails.push(...validateRow(row, index));
  });

  ['protect', 'scorecard_needed', 'excluded'].forEach((requiredStatus) => {
    if (!statuses.has(requiredStatus)) {
      result.fails.push(`queue must include at least one ${requiredStatus} row`);
    }
  });

  ['defense', 'attack', 'excluded'].forEach((requiredClass) => {
    if (!classes.has(requiredClass)) {
      result.fails.push(`queue must include ${requiredClass} portfolio_class`);
    }
  });

  const evidenceText = table.rows.map((row) => row.evidence_refs || '').join(' ');
  ['2026-06-26', '2026-06-27', '2026-06-28'].forEach((date) => {
    if (!evidenceText.includes(date)) {
      result.warns.push(`latest 3-day evidence date not referenced: ${date}`);
    }
  });

  if (result.fails.length > 0) result.status = 'BLOCK';
  return result;
}

function printResult(result) {
  const label = result.status === 'ALLOW' ? 'ALLOW' : 'FAIL';
  console.log(`${label}: active topic queue contract`);
  console.log(`file: ${result.filePath || '(none)'}`);
  result.fails.forEach((item) => console.log(`FAIL: ${item}`));
  result.warns.forEach((item) => console.log(`WARN: ${item}`));
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const result = validateActiveQueue(args.file);
  printResult(result);
  if (result.status !== 'ALLOW') process.exit(1);
}

if (require.main === module) {
  main();
}

module.exports = {
  validateActiveQueue,
  findQueueTable,
};
