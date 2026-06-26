const fs = require('fs');
const path = require('path');
const { paths } = require('./lib/paths');

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

  const content = fs.readFileSync(filePath, 'utf8');
  REQUIRED_FIELDS.forEach((field) => {
    const pattern = new RegExp(`${field}\\s*:`);
    if (!pattern.test(content)) result.fails.push(`${field} 항목이 없습니다.`);
  });

  if (!/^##\s+후보\s+/m.test(content)) {
    result.fails.push('후보별 섹션(## 후보 N.)이 없습니다.');
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
  validateTopicScorecard,
  resolveScorecard,
};
