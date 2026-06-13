const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');

const requiredScripts = [
  'scripts/validate_post.js',
  'scripts/validate_data_schema.js',
  'scripts/check_freshness.js',
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

const packageJson = JSON.parse(fs.readFileSync(fromRoot('package.json'), 'utf8'));
[
  'validate:posts',
  'validate:data',
  'check:freshness',
  'ranking:summary',
  'ops:daily',
].forEach((scriptName) => {
  if (!packageJson.scripts || !packageJson.scripts[scriptName]) {
    throw new Error(`package.json scripts에 ${scriptName}가 없습니다.`);
  }
});

console.log('자동화 룰 검증 완료');
