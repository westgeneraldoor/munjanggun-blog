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
};
