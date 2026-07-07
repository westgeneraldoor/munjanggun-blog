const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');

const requiredScripts = [
  'scripts/validate_post.js',
  'scripts/blog_quality_gate.js',
  'scripts/validate_data_schema.js',
  'scripts/check_freshness.js',
  'scripts/validate_daily_report.js',
  'scripts/validate_topic_scorecard.js',
  'scripts/validate_active_queue.js',
  'scripts/summarize_ranking_changes.js',
];

function fromRoot(relativePath) {
  return path.join(root, ...relativePath.split('/'));
}

requiredScripts.forEach((relativePath) => {
  const fullPath = fromRoot(relativePath);
  if (!fs.existsSync(fullPath)) throw new Error(`자동화 스크립트가 없습니다: ${relativePath}`);

  const check = spawnSync(process.execPath, ['--check', fullPath], { encoding: 'utf8' });
  if (check.status !== 0) {
    throw new Error(`${relativePath} 문법 검사 실패\n${check.stderr || check.stdout}`);
  }
});

const validatePost = fs.readFileSync(fromRoot('scripts/validate_post.js'), 'utf8');
[
  '완전 방음',
  '현관문',
  '보양',
  '무료 방문실측',
  '#문장군중문',
].forEach((needle) => {
  if (!validatePost.includes(needle)) throw new Error(`validate_post.js에 필수 룰 문자열이 없습니다: ${needle}`);
});

const blogQualityGate = fs.readFileSync(fromRoot('scripts/blog_quality_gate.js'), 'utf8');
[
  'STATUS_MISSING',
  'APPROVAL_LOG_MISSING',
  'POST_ALREADY_PUBLISHED',
  'POST_VALIDATION_FAILED',
  'PUBLISH_APPROVAL_MISSING',
].forEach((needle) => {
  if (!blogQualityGate.includes(needle)) throw new Error(`blog_quality_gate.js에 필수 게이트 문자열이 없습니다: ${needle}`);
});

const packageJson = JSON.parse(fs.readFileSync(fromRoot('package.json'), 'utf8'));
[
  'validate:posts',
  'gate:blog',
  'test:blog-gate',
  'validate:data',
  'check:freshness',
  'ranking:summary',
  'ops:daily',
  'ops:daily:check',
  'ops:daily:write',
  'ops:weekly',
  'test:ops-daily',
  'test:active-queue',
].forEach((scriptName) => {
  if (!packageJson.scripts || !packageJson.scripts[scriptName]) {
    throw new Error(`package.json scripts에 ${scriptName}가 없습니다.`);
  }
});

const opsDaily = packageJson.scripts['ops:daily'];
[
  'validate_daily_report.js',
  'validate_topic_scorecard.js',
  'check:freshness',
  'validate_active_queue.js',
  '--latest-daily',
].forEach((needle) => {
  if (!opsDaily.includes(needle)) throw new Error(`ops:daily에 ${needle} 호출이 없습니다.`);
});

if (!packageJson.scripts['ops:daily:write'].includes('--write-report')) {
  throw new Error('ops:daily:write는 check_freshness.js --write-report를 호출해야 합니다.');
}

const agents = fs.readFileSync(fromRoot('AGENTS.md'), 'utf8');
[
  '오늘 글감 3개 트리거 응답 계약',
  '룰 적용 확인',
  '오늘의 글감 포트폴리오',
  '최종 글감 3개',
  'POSTING_REGISTRY 중복/카니발 확인',
  'POSTING_EXCLUSION_RULES 제외 키워드 확인',
].forEach((needle) => {
  if (!agents.includes(needle)) throw new Error(`AGENTS.md에 오늘 글감 응답 계약 문자열이 없습니다: ${needle}`);
});

const operatingIndex = fs.readFileSync(fromRoot('docs/OPERATING_INDEX.md'), 'utf8');
[
  '`오늘 글감 3개` 응답 출력 계약',
  '룰 적용 확인',
  '오늘의 글감 포트폴리오',
  '최종 글감 3개',
  '| 역할 | queue_id | 후보/처리 | 기존 글 중복 여부 | 왜 오늘 봐야 하는지 | 다음 액션 |',
].forEach((needle) => {
  if (!operatingIndex.includes(needle)) throw new Error(`OPERATING_INDEX.md에 오늘 글감 응답 계약 문자열이 없습니다: ${needle}`);
});

[
  'track',
  'ranking:summary',
].forEach((needle) => {
  if (opsDaily.includes(needle)) throw new Error(`ops:daily에 weekly/experimental 명령이 섞였습니다: ${needle}`);
});

console.log('자동화 룰 검증 완료');
