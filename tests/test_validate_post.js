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

function writeRootPost(fileName, lines) {
  const post = path.join(root, 'posts', fileName);
  fs.writeFileSync(post, `${lines.join('\n')}\n`, 'utf8');
  return post;
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

function testShortFieldStoryPostWarnsValidation() {
  const post = writeRootPost('998_length_probe.md', basePostLines(['## 실제 시공 현장에서는 조금 다릅니다', '현장형 글인데 본문이 너무 짧으면 발행 기준을 통과하면 안 됩니다.']));
  try {
    const result = runValidate(post);
    assert.strictEqual(result.status, 0, result.stdout);
    assert.match(result.stdout, /본문 공백 제외/);
    assert.match(result.stdout, /WARN/);
  } finally {
    fs.rmSync(post, { force: true });
  }
}

function testMissingFieldStorySectionFailsValidation() {
  const post = writeRootPost('997_missing_field_section.md', basePostLines(['현장형 글인데 실제 시공 현장 단락 없이 설명만 이어지면 발행하면 안 됩니다.']));
  try {
    const result = runValidate(post);
    assert.strictEqual(result.status, 1, result.stdout);
    assert.match(result.stdout, /실제 시공 현장에서는 조금 다릅니다/);
  } finally {
    fs.rmSync(post, { force: true });
  }
}

function testInternalMemoFailsValidation() {
  const post = writeRootPost('996_internal_memo.md', basePostLines([
    '## 실제 시공 현장에서는 조금 다릅니다',
    '현장형 글은 본문 안에서 사진이 필요한 장면을 자연스럽게 설명해야 합니다.',
    '',
    '## 운영 메모',
    '[사진: 현관 전체 컷]',
    '[AppSheet 확인 필요]',
  ]));
  try {
    const result = runValidate(post);
    assert.strictEqual(result.status, 1, result.stdout);
    assert.match(result.stdout, /운영 메모|단일 발행 MD|내부 지시문/);
  } finally {
    fs.rmSync(post, { force: true });
  }
}

function titleCandidatePostLines(bodyText) {
  return [
    '## 제목 후보 5개',
    '',
    '1. # 후보 안의 가짜 제목은 발행 제목이 아닙니다',
    '2. 중문 설치 전 보는 3가지 기준',
    '3. 현장에서는 중문보다 구조가 먼저입니다',
    '4. 좁은 현관 중문 설치 전 확인할 점',
    '5. 무료 실측 전 사진을 이렇게 준비하세요',
    '',
    '# 아파트 현관중문 설치 전 확인할 3가지 기준',
    '',
    bodyText,
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

function testTitleCandidateSectionDoesNotBecomePublishTitle() {
  const post = writeRootPost('096_title_candidate_probe.md', titleCandidatePostLines('현관 중문은 제품명보다 현장 구조를 먼저 보는 것이 좋습니다.'));
  try {
    const result = runValidate(post);
    assert.strictEqual(result.status, 0, result.stdout);
    assert.match(result.stdout, /아파트 현관중문 설치 전 확인할 3가지 기준/);
    assert.doesNotMatch(result.stdout, /제목:\s*제목 후보 5개/);
    assert.doesNotMatch(result.stdout, /후보 안의 가짜 제목/);
  } finally {
    fs.rmSync(post, { force: true });
  }
}

function testTitleCandidateSectionExcludedFromBodyLength() {
  const longCandidateNoise = '후보문장'.repeat(500);
  const publishBody = '현장에서는 가로폭과 신발장 간섭, 바닥 레일 위치를 같이 확인해야 합니다. '.repeat(70);
  const lines = titleCandidatePostLines(publishBody);
  lines.splice(2, 0, longCandidateNoise);
  const post = writeRootPost('098_title_candidate_length_probe.md', lines);
  try {
    const result = runValidate(post);
    assert.strictEqual(result.status, 0, result.stdout);
    assert.doesNotMatch(result.stdout, /1500~2500|2500/);
  } finally {
    fs.rmSync(post, { force: true });
  }
}

function main() {
  testUnsupportedProductsFailValidation();
  testDoorFrameOnlyPositiveClaimFailsValidation();
  testShortFieldStoryPostWarnsValidation();
  testMissingFieldStorySectionFailsValidation();
  testInternalMemoFailsValidation();
  testTitleCandidateSectionDoesNotBecomePublishTitle();
  testTitleCandidateSectionExcludedFromBodyLength();
  console.log('validate_post product tests passed');
}

main();
