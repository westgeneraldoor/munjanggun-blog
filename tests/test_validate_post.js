const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const cli = path.join(root, 'scripts', 'validate_post.js');

function runValidate(postPath) {
  return spawnSync(process.execPath, [cli, postPath, '--no-write-report'], {
    cwd: root,
    encoding: 'utf8',
  });
}

function writeTempPost(lines) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'validate-post-'));
  const post = path.join(dir, '999_unsupported_product.md');
  fs.writeFileSync(post, `${lines.join('\n')}\n`, 'utf8');
  return { dir, post };
}

function removeDir(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

function basePostLines(extraLines = []) {
  return [
    '# 아파트 중문 설치 전 확인할 3가지 기준',
    '',
    '아파트 중문 설치는 현장 구조와 사용 동선을 먼저 확인해야 합니다.',
    ...extraLines,
    '',
    '무료 방문실측으로 현장 조건을 확인하고 네이버 예약으로 편하게 접수할 수 있습니다.',
    '',
    '관련 글',
    'https://blog.naver.com/doorgeneral/224317511025',
    'https://blog.naver.com/doorgeneral/224317523524',
    '',
    '# 해시태그',
    '',
    '#아파트중문 #현관중문 #중문설치 #무료방문실측 #중문종류 #문장군 #문장군중문',
    '',
  ];
}

function testUnsupportedProductsFailValidation() {
  const { dir, post } = writeTempPost(basePostLines(['현관문과 방화문, 비대칭양개형중문, 중문파티션도 같이 안내한다고 쓰면 안 됩니다.']));
  try {
    const result = runValidate(post);
    assert.strictEqual(result.status, 1, result.stdout);
    assert.match(result.stdout, /미취급|제외|unsupported|지원하지/);
    assert.match(result.stdout, /현관문/);
    assert.match(result.stdout, /방화문/);
    assert.match(result.stdout, /비대칭양개형중문/);
    assert.match(result.stdout, /중문파티션/);
  } finally {
    removeDir(dir);
  }
}

function testDoorFrameOnlyPositiveClaimFailsValidation() {
  const { dir, post } = writeTempPost(basePostLines(['문틀만 단독으로 교체할 수 있습니다. 기존 문짝은 그대로 쓰면 됩니다.']));
  try {
    const result = runValidate(post);
    assert.strictEqual(result.status, 1, result.stdout);
    assert.match(result.stdout, /문틀만 단독 교체 가능/);
  } finally {
    removeDir(dir);
  }
}

function main() {
  testUnsupportedProductsFailValidation();
  testDoorFrameOnlyPositiveClaimFailsValidation();
  console.log('validate_post product tests passed');
}

main();
