const fs = require('fs');
const path = require('path');
const { missingDates, parseDataDate } = require('./lib/daily_coverage');

function parseArgs(argv) {
  const args = { reportsDir: path.join(__dirname, '..', 'outputs', 'reports', 'daily'), from: '', to: '' };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--reports-dir') args.reportsDir = path.resolve(argv[++index]);
    else if (arg.startsWith('--reports-dir=')) args.reportsDir = path.resolve(arg.split('=')[1]);
    else if (arg === '--from') args.from = argv[++index];
    else if (arg.startsWith('--from=')) args.from = arg.split('=')[1];
    else if (arg === '--to') args.to = argv[++index];
    else if (arg.startsWith('--to=')) args.to = arg.split('=')[1];
  }
  return args;
}

function reportDates(reportsDir) {
  if (!fs.existsSync(reportsDir)) return [];
  return fs.readdirSync(reportsDir)
    .filter((name) => /_seo_watch\.md$/.test(name))
    .map((name) => parseDataDate(fs.readFileSync(path.join(reportsDir, name), 'utf8')))
    .filter(Boolean);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const dates = reportDates(args.reportsDir);
  const from = args.from || dates.sort()[0];
  const to = args.to || dates.sort().at(-1);
  if (!from || !to) throw new Error('일간 보고서의 데이터 기준일을 찾지 못했습니다.');
  const missing = missingDates(dates, from, to);
  if (missing.length === 0) {
    console.log(`ALLOW: daily coverage ${from}..${to} complete`);
    return;
  }
  console.log(`BLOCK: 일간 통계/TOP20 미수집 ${missing.length}일: ${missing.join(', ')}`);
  process.exitCode = 2;
}

try {
  main();
} catch (error) {
  console.error(`FAIL: ${error.message}`);
  process.exitCode = 1;
}

module.exports = { parseArgs, reportDates };
