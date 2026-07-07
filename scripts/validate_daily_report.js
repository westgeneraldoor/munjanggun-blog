const fs = require('fs');
const path = require('path');
const { paths } = require('./lib/paths');

const DEFAULT_MAX_AGE_DAYS = 2;
const DAY_MS = 24 * 60 * 60 * 1000;

const REQUIRED_SECTIONS = [
  {
    label: '기준 날짜',
    type: 'date',
    patterns: [/데이터 기준일:\s*\d{4}-\d{2}-\d{2}/, /^#\s*\d{4}-\d{2}-\d{2}\s+/m],
  },
  {
    label: '유입경로 요약',
    patterns: [/유입경로 요약/],
  },
  {
    label: '상세 검색어',
    patterns: [/상세 검색어/, /주요 검색어/, /검색어 클러스터/],
  },
  {
    label: '게시글 TOP20',
    patterns: [/게시글\s*TOP\s*20/, /게시글\s*TOP20/],
  },
  {
    label: '신규/보강 후보',
    patterns: [/신규\/보강 후보/, /신규 후보/, /보강 후보/, /총괄 판단/],
  },
  {
    label: '다음 액션',
    patterns: [/다음 액션/],
  },
];

const TOPIC_PORTFOLIO_SECTION = {
  label: '오늘의 글감 포트폴리오',
  patterns: [/오늘의\s*글감\s*포트폴리오/, /글감\s*포트폴리오\s*요약/],
};

const TOPIC_PORTFOLIO_ROLES = [
  { label: '탈락 후보', patterns: [/탈락\s*후보/, /exclude/i] },
  { label: '보호글', patterns: [/보호글/, /protect/i] },
  { label: '공격글', patterns: [/공격글/, /attack/i] },
  { label: '실험글', patterns: [/실험글/, /experiment/i] },
];

const PLACEHOLDER_VALUES = new Set([
  '-',
  'todo',
  'TODO',
  '작성 예정',
  '추후 작성',
  '미정',
  '없음',
  'N/A',
  'n/a',
]);

function parseArgs(argv) {
  const args = {
    reportsDir: path.join(paths.outputReport('daily')),
    date: null,
    latest: false,
    maxAgeDays: DEFAULT_MAX_AGE_DAYS,
    requireTopicPortfolio: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--reports-dir') {
      args.reportsDir = path.resolve(argv[index + 1]);
      index += 1;
    } else if (arg.startsWith('--reports-dir=')) {
      args.reportsDir = path.resolve(arg.split('=')[1]);
    } else if (arg === '--date') {
      args.date = argv[index + 1];
      index += 1;
    } else if (arg.startsWith('--date=')) {
      args.date = arg.split('=')[1];
    } else if (arg === '--latest') {
      args.latest = true;
    } else if (arg === '--max-age-days') {
      args.maxAgeDays = Number(argv[index + 1]);
      index += 1;
    } else if (arg.startsWith('--max-age-days=')) {
      args.maxAgeDays = Number(arg.split('=')[1]);
    } else if (arg === '--require-topic-portfolio') {
      args.requireTopicPortfolio = true;
    }
  }

  if (!Number.isFinite(args.maxAgeDays)) args.maxAgeDays = DEFAULT_MAX_AGE_DAYS;
  if (!args.date && !args.latest) args.latest = true;
  return args;
}

function reportDateFromName(fileName) {
  const match = fileName.match(/^(\d{4}-\d{2}-\d{2})_seo_watch\.md$/);
  return match ? match[1] : null;
}

function listReports(reportsDir) {
  if (!fs.existsSync(reportsDir)) return [];
  return fs.readdirSync(reportsDir)
    .filter((fileName) => reportDateFromName(fileName))
    .sort((a, b) => reportDateFromName(b).localeCompare(reportDateFromName(a)));
}

function resolveReport(args) {
  if (args.date) {
    return path.join(args.reportsDir, `${args.date}_seo_watch.md`);
  }

  const reports = listReports(args.reportsDir);
  return reports.length > 0 ? path.join(args.reportsDir, reports[0]) : null;
}

function daysBetweenToday(dateText) {
  if (!dateText) return null;
  const date = new Date(`${dateText}T00:00:00+09:00`);
  if (Number.isNaN(date.getTime())) return null;
  const today = new Date();
  const todayKst = new Date(today.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
  const todayStart = new Date(todayKst.getFullYear(), todayKst.getMonth(), todayKst.getDate());
  return Math.floor((todayStart.getTime() - date.getTime()) / DAY_MS);
}

function findHeadingLine(lines, patterns) {
  return lines.findIndex((line) => {
    if (!/^#{1,6}\s+/.test(line)) return false;
    return patterns.some((pattern) => pattern.test(line));
  });
}

function sectionBody(lines, headingIndex) {
  if (headingIndex < 0) return '';
  const body = [];
  for (let index = headingIndex + 1; index < lines.length; index += 1) {
    if (/^##\s+/.test(lines[index])) break;
    body.push(lines[index]);
  }
  return body.join('\n');
}

function normalizeContentLines(body) {
  return body
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line)
    .filter((line) => !/^#{1,6}\s+/.test(line))
    .filter((line) => !/^[-|:\s]+$/.test(line))
    .filter((line) => !/^\|\s*-+/.test(line))
    .filter((line) => !/^>\s*$/.test(line))
    .map((line) => line.replace(/^[-*]\s+/, '').trim())
    .filter((line) => line);
}

function isPlaceholderText(value) {
  const normalized = String(value || '').trim();
  if (!normalized) return true;
  if (PLACEHOLDER_VALUES.has(normalized)) return true;
  return /^(todo|작성 예정|추후 작성|미정|n\/a)$/i.test(normalized);
}

function hasMeaningfulBody(body) {
  const lines = normalizeContentLines(body);
  if (lines.length === 0) return false;
  return lines.some((line) => !isPlaceholderText(line));
}

function splitMarkdownRow(line) {
  const trimmed = line.trim();
  if (!trimmed.startsWith('|') || !trimmed.endsWith('|')) return null;
  return trimmed
    .slice(1, -1)
    .split('|')
    .map((cell) => cell.trim());
}

function isDividerRow(cells) {
  return cells.every((cell) => /^:?-{3,}:?$/.test(cell.trim()));
}

function extractMarkdownTables(body) {
  const tables = [];
  const lines = body.split('\n');

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

function findHeaderIndex(headers, patterns) {
  return headers.findIndex((header) => patterns.some((pattern) => pattern.test(header)));
}

function findTopicPortfolioTable(body) {
  return extractMarkdownTables(body).find((table) => (
    findHeaderIndex(table.headers, [/역할/, /role/i]) >= 0
    && findHeaderIndex(table.headers, [/queue[_\s-]*id/i, /Q-?ID/i, /큐\s*ID/]) >= 0
    && findHeaderIndex(table.headers, [/후보/, /처리/, /주제/, /topic/i]) >= 0
    && findHeaderIndex(table.headers, [/중복/, /카니발/, /기존\s*글/]) >= 0
    && findHeaderIndex(table.headers, [/왜\s*오늘/, /오늘\s*봐야/, /오늘\s*써야/, /today/i]) >= 0
    && findHeaderIndex(table.headers, [/다음\s*액션/, /action/i, /^처리$/]) >= 0
  ));
}

function contradictoryMissingReportClaims(content, reportsDir) {
  const fails = [];
  const pattern = /outputs\/reports\/daily\/(\d{4}-\d{2}-\d{2})_seo_watch\.md/g;
  let match = pattern.exec(content);

  while (match) {
    const date = match[1];
    const linkedPath = path.join(reportsDir, `${date}_seo_watch.md`);
    const start = Math.max(0, match.index - 140);
    const end = Math.min(content.length, match.index + match[0].length + 140);
    const context = content.slice(start, end);
    const claimsMissing = /(없|확인되지 않았다|아직 없다|missing|not found|does not exist)/i.test(context);

    if (claimsMissing && fs.existsSync(linkedPath)) {
      fails.push(`report claims missing file that exists: outputs/reports/daily/${date}_seo_watch.md`);
    }

    match = pattern.exec(content);
  }

  return fails;
}

function validateTopicPortfolioSection(lines, required) {
  const issues = [];
  const headingIndex = findHeadingLine(lines, TOPIC_PORTFOLIO_SECTION.patterns);

  if (headingIndex < 0) {
    if (required) issues.push(`${TOPIC_PORTFOLIO_SECTION.label} 섹션이 없습니다.`);
    return issues;
  }

  const body = sectionBody(lines, headingIndex);
  if (!hasMeaningfulBody(body)) {
    issues.push(`${TOPIC_PORTFOLIO_SECTION.label} 섹션이 비어 있거나 placeholder만 있습니다. 실제 내용을 입력해야 합니다.`);
    return issues;
  }

  const table = findTopicPortfolioTable(body);
  if (!table) {
    issues.push(`${TOPIC_PORTFOLIO_SECTION.label}에 역할, queue_id, 후보/처리, 기존 글 중복 여부, 왜 오늘 봐야 하는지, 다음 액션을 담은 Markdown 표가 없습니다.`);
    return issues;
  }

  const roleIndex = findHeaderIndex(table.headers, [/역할/, /role/i]);
  const queueIdIndex = findHeaderIndex(table.headers, [/queue[_\s-]*id/i, /Q-?ID/i, /큐\s*ID/]);
  const candidateIndex = findHeaderIndex(table.headers, [/후보/, /처리/, /주제/, /topic/i]);
  const overlapIndex = findHeaderIndex(table.headers, [/중복/, /카니발/, /기존\s*글/]);
  const whyTodayIndex = findHeaderIndex(table.headers, [/왜\s*오늘/, /오늘\s*봐야/, /오늘\s*써야/, /today/i]);
  const actionIndex = findHeaderIndex(table.headers, [/다음\s*액션/, /action/i, /^처리$/]);

  if (table.rows.length === 0) {
    issues.push(`${TOPIC_PORTFOLIO_SECTION.label} 표에 후보 행이 없습니다.`);
    return issues;
  }

  TOPIC_PORTFOLIO_ROLES.forEach((role) => {
    const hasRoleRow = table.rows.some((row) => role.patterns.some((pattern) => pattern.test(row[roleIndex] || '')));
    if (!hasRoleRow) {
      issues.push(`${TOPIC_PORTFOLIO_SECTION.label}에 ${role.label} 행이 없습니다.`);
    }
  });

  table.rows.forEach((row) => {
    const role = row[roleIndex] || '';
    const queueId = row[queueIdIndex] || '';
    const candidate = row[candidateIndex] || '';
    const overlap = row[overlapIndex] || '';
    const whyToday = row[whyTodayIndex] || '';
    const action = row[actionIndex] || '';

    if (isPlaceholderText(queueId)) {
      issues.push(`${TOPIC_PORTFOLIO_SECTION.label}의 ${role || '(역할 없음)'} 행에 queue_id가 없습니다.`);
    } else if (!/Q-\d{3}/.test(queueId)) {
      issues.push(`${TOPIC_PORTFOLIO_SECTION.label}의 ${role || '(역할 없음)'} 행 queue_id는 ACTIVE_TOPIC_QUEUE Q-ID를 포함해야 합니다: ${queueId}`);
    }

    if (isPlaceholderText(candidate)) {
      issues.push(`${TOPIC_PORTFOLIO_SECTION.label}의 ${role || '(역할 없음)'} 행에 후보/처리 내용이 없습니다.`);
    }

    if (isPlaceholderText(overlap)) {
      issues.push(`${TOPIC_PORTFOLIO_SECTION.label}의 ${role || '(역할 없음)'} 행에 기존 글 중복/카니발 확인이 없습니다.`);
    }

    if (isPlaceholderText(whyToday)) {
      issues.push(`${TOPIC_PORTFOLIO_SECTION.label}의 ${role || '(역할 없음)'} 행에 왜 오늘 봐야 하는지 판단이 없습니다.`);
    }

    if (isPlaceholderText(action)) {
      issues.push(`${TOPIC_PORTFOLIO_SECTION.label}의 ${role || '(역할 없음)'} 행에 다음 액션이 없습니다.`);
    }

    const line = row.join(' | ');
    const hasNegation = /(금지|차단|하지\s*않|넘기지\s*않|관찰만|보류)/i.test(line);

    if (/(탈락|exclude)/i.test(line) && /(작성|발행|원고|draft|publish|scorecard|스코어카드)/i.test(line) && !hasNegation) {
      issues.push(`${TOPIC_PORTFOLIO_SECTION.label}의 탈락 후보 행은 작성/발행/scorecard 액션을 지시하면 안 됩니다: ${line}`);
    }

    if (/(보호글|protect)/i.test(line) && /(전면\s*리라이팅|대수술|본문\s*대수술)/i.test(line) && !hasNegation) {
      issues.push(`${TOPIC_PORTFOLIO_SECTION.label}의 보호글 행은 대수술 지시가 아니라 보호/내부링크/관찰 중심이어야 합니다: ${line}`);
    }
  });

  return issues;
}

function validateDailyReport(filePath, options = {}) {
  const result = {
    status: 'ALLOW',
    filePath,
    fails: [],
    warns: [],
  };

  if (!filePath || !fs.existsSync(filePath)) {
    result.status = 'BLOCK';
    result.fails.push(`daily report not found: ${filePath || '(none)'}`);
    return result;
  }

  const fileName = path.basename(filePath);
  const fileDate = reportDateFromName(fileName);
  const age = daysBetweenToday(fileDate);
  if (age !== null && age > options.maxAgeDays) {
    result.warns.push(`daily report is ${age} days old: ${fileName}`);
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split(/\r?\n/);
  const reportsDir = options.reportsDir || path.dirname(filePath);

  REQUIRED_SECTIONS.forEach((section) => {
    if (section.type === 'date') {
      if (!section.patterns.some((pattern) => pattern.test(content))) {
        result.fails.push(`${section.label} 섹션 또는 데이터 기준일이 없습니다.`);
      }
      return;
    }

    const headingIndex = findHeadingLine(lines, section.patterns);
    if (headingIndex < 0) {
      result.fails.push(`${section.label} 섹션이 없습니다.`);
      return;
    }

    const body = sectionBody(lines, headingIndex);
    if (!hasMeaningfulBody(body)) {
      result.fails.push(`${section.label} 섹션이 비어 있거나 placeholder만 있습니다. 실제 내용을 입력해야 합니다.`);
    }
  });

  result.fails.push(...contradictoryMissingReportClaims(content, reportsDir));
  result.fails.push(...validateTopicPortfolioSection(lines, Boolean(options.requireTopicPortfolio)));

  if (result.fails.length > 0) result.status = 'BLOCK';
  return result;
}

function printResult(result) {
  const label = result.status === 'ALLOW' ? 'ALLOW' : 'FAIL';
  console.log(`${label}: daily SEO report contract`);
  console.log(`file: ${result.filePath || '(none)'}`);
  result.fails.forEach((item) => console.log(`FAIL: ${item}`));
  result.warns.forEach((item) => console.log(`WARN: ${item}`));
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const filePath = resolveReport(args);
  const result = validateDailyReport(filePath, args);
  printResult(result);
  if (result.status !== 'ALLOW') process.exit(1);
}

if (require.main === module) {
  main();
}

module.exports = {
  validateDailyReport,
  resolveReport,
  contradictoryMissingReportClaims,
  validateTopicPortfolioSection,
};
