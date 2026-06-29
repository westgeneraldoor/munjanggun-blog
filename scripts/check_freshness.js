const fs = require('fs');
const { paths } = require('./lib/paths');
const { readJsonFile, writeTextFile } = require('./lib/file_store');

const DAY_MS = 24 * 60 * 60 * 1000;

function parseArgs(argv) {
  const weekly = argv.includes('--weekly');
  const maxAgeArg = argv.find((arg) => arg.startsWith('--max-age-days='));
  return {
    strict: argv.includes('--strict'),
    weekly,
    writeReport: argv.includes('--write-report'),
    maxAgeDays: Number(maxAgeArg ? maxAgeArg.split('=')[1] : '') || (weekly ? 7 : 14),
  };
}

function parseDate(value) {
  if (!value) return null;
  const normalized = String(value).trim();
  const date = new Date(`${normalized}T00:00:00+09:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function daysAgo(date) {
  const now = new Date();
  return Math.floor((now.getTime() - date.getTime()) / DAY_MS);
}

function extractReportDate(filePath, labelPattern) {
  if (!fs.existsSync(filePath)) return null;
  const content = fs.readFileSync(filePath, 'utf8');
  const match = content.match(labelPattern);
  return match ? parseDate(match[1]) : null;
}

function fileMtimeDate(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return fs.statSync(filePath).mtime;
}

function statusFor(age, maxAgeDays) {
  if (age === null) return 'FAIL';
  if (age > maxAgeDays) return 'WARN';
  return 'PASS';
}

function buildCheck(name, filePath, date, maxAgeDays) {
  const age = date ? daysAgo(date) : null;
  return {
    name,
    path: filePath,
    date,
    age,
    status: statusFor(age, maxAgeDays),
  };
}

function dailyKeywordChecks(maxAgeDays) {
  return [
    ['keyword_data.json', paths.dataRaw('keyword_data.json')],
    ['keyword_data_product.json', paths.dataRaw('keyword_data_product.json')],
    ['keyword_data_지역.json', paths.dataRaw('keyword_data_지역.json')],
    ['keyword_data_product_relevant.json', paths.dataProcessed('keyword_data_product_relevant.json')],
    ['keyword_data_지역_30이상.md', paths.dataProcessed('keyword_data_지역_30이상.md')],
  ].map(([name, filePath]) => buildCheck(name, filePath, fileMtimeDate(filePath), maxAgeDays));
}

function weeklyRankingChecks(maxAgeDays) {
  const rankingReport = paths.outputReport('ranking_report.md');
  const top10Report = paths.outputReport('top10_analysis.md');
  const dashboard = paths.outputDashboard('ranking_dashboard.html');
  const historyPath = paths.dataProcessed('tracking_history.json');
  const history = readJsonFile(historyPath, { records: [] });
  const latestHistory = Array.isArray(history.records) && history.records.length > 0
    ? history.records[history.records.length - 1]
    : null;

  const checks = [
    buildCheck(
      'ranking_report.md',
      rankingReport,
      extractReportDate(rankingReport, /> 조회일:\s*(\d{4}-\d{2}-\d{2})/),
      maxAgeDays
    ),
    buildCheck(
      'top10_analysis.md',
      top10Report,
      extractReportDate(top10Report, /> 분석일:\s*(\d{4}-\d{2}-\d{2})/),
      maxAgeDays
    ),
    buildCheck(
      'tracking_history.json',
      historyPath,
      parseDate(latestHistory && latestHistory.date),
      maxAgeDays
    ),
  ];

  checks.push({
    name: 'ranking_dashboard.html',
    path: dashboard,
    date: null,
    age: null,
    status: fs.existsSync(dashboard) ? 'PASS' : 'FAIL',
  });

  return checks;
}

function renderMarkdown({ checks, options }) {
  const modeLabel = options.weekly ? 'weekly ranking/analysis' : 'daily keyword data';
  let md = `# 운영 산출물 최신성 점검\n\n`;
  md += `> 점검일: ${new Date().toISOString().split('T')[0]}\n`;
  md += `> 모드: ${modeLabel}\n`;
  md += `> 기준: ${options.maxAgeDays}일 초과 시 경고\n\n`;
  md += `| 산출물 | 기준일 | 경과 | 상태 |\n`;
  md += `| --- | --- | --- | --- |\n`;
  checks.forEach((check) => {
    const dateText = check.date ? check.date.toISOString().slice(0, 10) : check.status === 'PASS' ? '파일 존재' : '-';
    const ageText = check.age === null ? '-' : `${check.age}일`;
    md += `| ${check.name} | ${dateText} | ${ageText} | ${check.status} |\n`;
  });
  return md;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const checks = options.weekly
    ? weeklyRankingChecks(options.maxAgeDays)
    : dailyKeywordChecks(options.maxAgeDays);

  const md = renderMarkdown({ checks, options });
  const outputPath = paths.outputReport('freshness_check.md');
  if (options.writeReport) {
    writeTextFile(outputPath, md);
  }

  console.log(md);
  if (options.writeReport) {
    console.log(`저장: ${outputPath}`);
  } else {
    console.log(`report not written (use --write-report to save): ${outputPath}`);
  }

  const hasFail = checks.some((check) => check.status === 'FAIL');
  const hasWarn = checks.some((check) => check.status === 'WARN');
  if (hasFail || (options.strict && hasWarn)) process.exit(1);
}

main();
