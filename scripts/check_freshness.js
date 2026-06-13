const fs = require('fs');
const { paths } = require('./lib/paths');
const { readJsonFile, writeTextFile } = require('./lib/file_store');

const DAY_MS = 24 * 60 * 60 * 1000;

function parseArgs(argv) {
  return {
    strict: argv.includes('--strict'),
    maxAgeDays: Number((argv.find((arg) => arg.startsWith('--max-age-days=')) || '').split('=')[1]) || 3,
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

function statusFor(age, maxAgeDays) {
  if (age === null) return 'FAIL';
  if (age > maxAgeDays) return 'WARN';
  return 'PASS';
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const rankingReport = paths.outputReport('ranking_report.md');
  const top10Report = paths.outputReport('top10_analysis.md');
  const dashboard = paths.outputDashboard('ranking_dashboard.html');
  const historyPath = paths.dataProcessed('tracking_history.json');
  const history = readJsonFile(historyPath, { records: [] });
  const latestHistory = Array.isArray(history.records) && history.records.length > 0
    ? history.records[history.records.length - 1]
    : null;

  const checks = [
    {
      name: 'ranking_report.md',
      path: rankingReport,
      date: extractReportDate(rankingReport, /> 조회일:\s*(\d{4}-\d{2}-\d{2})/),
    },
    {
      name: 'top10_analysis.md',
      path: top10Report,
      date: extractReportDate(top10Report, /> 분석일:\s*(\d{4}-\d{2}-\d{2})/),
    },
    {
      name: 'tracking_history.json',
      path: historyPath,
      date: parseDate(latestHistory && latestHistory.date),
    },
  ].map((check) => {
    const age = check.date ? daysAgo(check.date) : null;
    return { ...check, age, status: statusFor(age, options.maxAgeDays) };
  });

  const dashboardStatus = fs.existsSync(dashboard) ? 'PASS' : 'FAIL';
  let md = `# 운영 산출물 최신성 점검\n\n`;
  md += `> 점검일: ${new Date().toISOString().split('T')[0]}\n`;
  md += `> 기준: ${options.maxAgeDays}일 초과 시 경고\n\n`;
  md += `| 산출물 | 기준일 | 경과 | 상태 |\n`;
  md += `| --- | --- | --- | --- |\n`;
  checks.forEach((check) => {
    md += `| ${check.name} | ${check.date ? check.date.toISOString().slice(0, 10) : '-'} | ${check.age === null ? '-' : `${check.age}일`} | ${check.status} |\n`;
  });
  md += `| ranking_dashboard.html | 파일 존재 | - | ${dashboardStatus} |\n`;

  const outputPath = paths.outputReport('freshness_check.md');
  writeTextFile(outputPath, md);

  console.log(md);
  console.log(`저장: ${outputPath}`);

  const hasFail = checks.some((check) => check.status === 'FAIL') || dashboardStatus === 'FAIL';
  const hasWarn = checks.some((check) => check.status === 'WARN');
  if (hasFail || (options.strict && hasWarn)) process.exit(1);
}

main();
