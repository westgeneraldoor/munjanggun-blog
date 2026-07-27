const fs = require('fs');
const path = require('path');
const { paths } = require('./lib/paths');
const { CORE_HUB_LABELS } = require('./validate_seo_taxonomy');

const REQUIRED_FIELDS = [
  '후보 키워드/원고 번호',
  '광고 API 시장 수요',
  '블로그 실제 유입 반복성',
  'TOP20 관련 반응',
  '문장군 서비스 적합성',
  'AppSheet 현장 연결성',
  '기존 글 중복/카니발 위험',
  '발행 안전성',
  '최종 판정',
];

const CORE_HUBS = CORE_HUB_LABELS;
const CORE_HUB_COLUMNS = ['핵심 허브', '상태', '근거 글/Q-ID', '판단 근거', '다음 액션'];
const ALLOWED_ROTATION_STATES = new Set(['작성 후보', '보호', '관찰', '중복 보류']);
const RECHECK_ROTATION_STATES = new Set(['관찰', '중복 보류']);

const PLACEHOLDER_VALUES = new Set([
  '',
  '-',
  'TODO',
  'todo',
  '작성 예정',
  '추후 작성',
  '추후 확인',
  '미정',
  '없음',
  'N/A',
  'n/a',
  '주제명',
  'YYYY-MM-DD',
]);

function parseArgs(argv) {
  const args = {
    dir: paths.outputReport(path.join('topic_candidates')),
    file: null,
    latest: false,
    allowMissing: 'fail',
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--dir') {
      args.dir = path.resolve(argv[index + 1]);
      index += 1;
    } else if (arg.startsWith('--dir=')) {
      args.dir = path.resolve(arg.split('=')[1]);
    } else if (arg === '--file') {
      args.file = path.resolve(argv[index + 1]);
      index += 1;
    } else if (arg.startsWith('--file=')) {
      args.file = path.resolve(arg.split('=')[1]);
    } else if (arg === '--latest') {
      args.latest = true;
    } else if (arg === '--allow-missing') {
      args.allowMissing = argv[index + 1] || 'fail';
      index += 1;
    } else if (arg.startsWith('--allow-missing=')) {
      args.allowMissing = arg.split('=')[1] || 'fail';
    }
  }

  if (!args.file && !args.latest) args.latest = true;
  return args;
}

function listScorecards(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((fileName) => /\.md$/i.test(fileName))
    .filter((fileName) => !/template/i.test(fileName))
    .sort((a, b) => b.localeCompare(a));
}

function resolveScorecard(args) {
  if (args.file) return args.file;
  const scorecards = listScorecards(args.dir);
  return scorecards.length > 0 ? path.join(args.dir, scorecards[0]) : null;
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isTemplateFile(filePath) {
  return /TOPIC_SCORECARD_TEMPLATE\.md$/i.test(path.basename(filePath || ''));
}

function isPlaceholderValue(value) {
  const normalized = String(value || '').trim();
  if (PLACEHOLDER_VALUES.has(normalized)) return true;
  return /^(todo|작성 예정|추후 작성|미정|n\/a)$/i.test(normalized);
}

function fieldValues(content, field) {
  const pattern = new RegExp(`^\\s*-\\s*${escapeRegExp(field)}\\s*:[ \\t]*(.*)$`, 'gm');
  const values = [];
  let match = pattern.exec(content);
  while (match) {
    values.push(match[1].trim());
    match = pattern.exec(content);
  }
  return values;
}

function splitTableLine(line) {
  const trimmed = String(line || '').trim();
  if (!trimmed.startsWith('|') || !trimmed.endsWith('|')) return null;
  return trimmed.slice(1, -1).split('|').map((cell) => cell.trim());
}

function isSeparatorLine(line) {
  const cells = splitTableLine(line);
  return Boolean(cells && cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell)));
}

function findCoreHubRotationRows(content) {
  const lines = content.split(/\r?\n/);
  const start = lines.findIndex((line) => /^##\s+핵심 허브 순환 점검\s*$/.test(line));
  if (start === -1) return { found: false, tableFound: false, rows: [] };

  let end = lines.length;
  for (let index = start + 1; index < lines.length; index += 1) {
    if (/^##\s+/.test(lines[index])) {
      end = index;
      break;
    }
  }

  const section = lines.slice(start + 1, end);
  const headerIndex = section.findIndex((line) => {
    const cells = splitTableLine(line);
    return cells && CORE_HUB_COLUMNS.every((column) => cells.includes(column));
  });
  if (headerIndex === -1) return { found: true, tableFound: false, rows: [] };

  const header = splitTableLine(section[headerIndex]);
  const rows = [];
  let cursor = headerIndex + 1;
  if (isSeparatorLine(section[cursor])) cursor += 1;

  for (; cursor < section.length; cursor += 1) {
    const cells = splitTableLine(section[cursor]);
    if (!cells) break;
    if (isSeparatorLine(section[cursor])) continue;
    const row = {};
    header.forEach((column, index) => {
      row[column] = cells[index] || '';
    });
    rows.push(row);
  }

  return { found: true, tableFound: true, rows };
}

function validateCoreHubRotation(content) {
  const parsed = findCoreHubRotationRows(content);
  if (!parsed.found || !parsed.tableFound) return [];

  const warns = [];
  const rowsByHub = new Map();
  parsed.rows.forEach((row) => {
    const hub = row['핵심 허브'];
    const rows = rowsByHub.get(hub) || [];
    rows.push(row);
    rowsByHub.set(hub, rows);
  });
  rowsByHub.forEach((_rows, hub) => {
    if (!CORE_HUBS.includes(hub)) {
      warns.push(`core hub rotation unknown hub: ${hub}`);
    }
  });
  CORE_HUBS.forEach((hub) => {
    const rows = rowsByHub.get(hub) || [];
    if (rows.length === 0) {
      warns.push(`core hub rotation missing hub: ${hub}`);
      return;
    }

    if (rows.length > 1) {
      warns.push(`core hub rotation duplicate hub: ${hub}`);
    }

    const row = rows[0];

    const state = row['상태'];
    if (!ALLOWED_ROTATION_STATES.has(state)) {
      warns.push(`${hub}: invalid core hub rotation state: ${state || '(empty)'}`);
    }
    if (isPlaceholderValue(row['근거 글/Q-ID'])) {
      warns.push(`${hub}: ${state || '(empty)'} needs evidence post or Q-ID`);
    }
    if (isPlaceholderValue(row['판단 근거'])) {
      warns.push(`${hub}: ${state || '(empty)'} needs decision evidence`);
    }
    if (isPlaceholderValue(row['다음 액션'])) {
      warns.push(`${hub}: ${state || '(empty)'} needs next action or review point`);
    }
    if (RECHECK_ROTATION_STATES.has(state)) {
      if (!/(?:\bQ-\d{3}\b|\b\d{3}\b)/.test(row['근거 글/Q-ID'])) {
        warns.push(`${hub}: ${state} needs evidence post or Q-ID`);
      }
      if (!/(^|[^\d])(?:3일|7일)/.test(row['다음 액션'])) {
        warns.push(`${hub}: ${state} needs 3일 or 7일 review point`);
      }
    }
  });

  return warns;
}

function validateTopicScorecard(filePath, options = {}) {
  const result = {
    status: 'ALLOW',
    filePath,
    fails: [],
    warns: [],
  };

  if (!filePath || !fs.existsSync(filePath)) {
    const message = `topic scorecard not found: ${filePath || '(none)'}`;
    if (options.allowMissing === 'warn') {
      result.warns.push(message);
      return result;
    }
    result.status = 'BLOCK';
    result.fails.push(message);
    return result;
  }

  if (isTemplateFile(filePath)) {
    result.status = 'BLOCK';
    result.fails.push('TOPIC_SCORECARD_TEMPLATE.md는 실제 scorecard로 인정하지 않습니다.');
    return result;
  }

  const content = fs.readFileSync(filePath, 'utf8');
  REQUIRED_FIELDS.forEach((field) => {
    const values = fieldValues(content, field);
    if (values.length === 0) {
      result.fails.push(`${field} 항목이 없습니다.`);
      return;
    }

    values.forEach((value, index) => {
      if (value === '') {
        result.fails.push(`${field} 항목 ${index + 1}의 값이 비어 있습니다.`);
      } else if (isPlaceholderValue(value)) {
        result.fails.push(`${field} 항목 ${index + 1}의 값이 placeholder입니다: ${value}`);
      }
    });
  });

  if (!/^##\s+후보\s+/m.test(content)) {
    result.fails.push('후보별 섹션(## 후보 N.)이 없습니다.');
  }

  const coreHubRotation = findCoreHubRotationRows(content);
  if (!coreHubRotation.found) {
    result.fails.push('core hub rotation section is missing');
  } else if (!coreHubRotation.tableFound) {
    result.fails.push('core hub rotation table is missing or has invalid columns');
  } else {
    result.warns.push(...validateCoreHubRotation(content));
  }

  if (result.fails.length > 0) result.status = 'BLOCK';
  return result;
}

function printResult(result) {
  const label = result.status === 'ALLOW' ? 'ALLOW' : 'FAIL';
  console.log(`${label}: topic scorecard contract`);
  console.log(`file: ${result.filePath || '(none)'}`);
  result.fails.forEach((item) => console.log(`FAIL: ${item}`));
  result.warns.forEach((item) => console.log(`WARN: ${item}`));
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const filePath = resolveScorecard(args);
  const result = validateTopicScorecard(filePath, args);
  printResult(result);
  if (result.status !== 'ALLOW') process.exit(1);
}

if (require.main === module) {
  main();
}

module.exports = {
  findCoreHubRotationRows,
  validateTopicScorecard,
  validateCoreHubRotation,
  resolveScorecard,
};
