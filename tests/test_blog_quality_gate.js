const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const cli = path.join(root, 'scripts', 'blog_quality_gate.js');

function runGate(args) {
  const result = spawnSync(process.execPath, [cli, ...args, '--json'], {
    cwd: root,
    encoding: 'utf8',
  });
  let payload;
  try {
    payload = JSON.parse(result.stdout);
  } catch (err) {
    throw new Error(`JSON output expected.\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`);
  }
  return { result, payload };
}

function codes(payload) {
  return payload.issues.map((issue) => issue.code);
}

function makeControlDir({ status = true, approval = true } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'blog-gate-'));
  if (status) {
    fs.writeFileSync(
      path.join(dir, 'STATUS.md'),
      [
        '# STATUS - blog publish gate',
        '',
        '- Publish allowed: `YES`',
        '- Post QA: `PASS`',
        '',
        '| Gate | Status | Notes |',
        '| --- | --- | --- |',
        '| Publish allowed | pass | ready for Naver paste |',
        '',
      ].join('\n'),
      'utf8',
    );
  }
  if (approval) {
    fs.writeFileSync(
      path.join(dir, 'APPROVAL_LOG.md'),
      [
        '# APPROVAL_LOG - blog publish gate',
        '',
        '## 2026-06-17 - Publish Approval',
        '',
        '- Decision: Blog publish approved.',
        '- Approved scope: Publish this checked post to Naver Blog.',
        '- Not approved: Changing title, deleting CTA, or publishing a different file.',
        '',
      ].join('\n'),
      'utf8',
    );
  }
  return dir;
}

function removeDir(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

function assertBlocked(payload, expectedCode) {
  assert.strictEqual(payload.ok, false);
  assert.strictEqual(payload.decision, 'BLOCK');
  assert(codes(payload).includes(expectedCode), `Expected ${expectedCode}, got ${codes(payload).join(', ')}`);
}

function testValidUrlWaitingPostPasses() {
  const controlDir = makeControlDir();
  const { result, payload } = runGate([
    '--post',
    'posts/078_화장실문틀교체.md',
    '--mode',
    'publish',
    '--control-dir',
    controlDir,
  ]);
  assert.strictEqual(result.status, 0, result.stderr || result.stdout);
  assert.strictEqual(payload.ok, true);
  assert.strictEqual(payload.decision, 'ALLOW');
  assert.strictEqual(payload.summary.fail, 0);
  removeDir(controlDir);
}

function testMissingStatusBlocksPublish() {
  const controlDir = makeControlDir({ status: false });
  const { result, payload } = runGate([
    '--post',
    'posts/078_화장실문틀교체.md',
    '--mode',
    'publish',
    '--control-dir',
    controlDir,
  ]);
  assert.strictEqual(result.status, 1);
  assertBlocked(payload, 'STATUS_MISSING');
  removeDir(controlDir);
}

function testApprovalLogWithNotApprovedDoesNotPass() {
  const controlDir = makeControlDir();
  fs.writeFileSync(
    path.join(controlDir, 'APPROVAL_LOG.md'),
    [
      '# APPROVAL_LOG - blog publish gate',
      '',
      '## 2026-06-17 - Publish Hold',
      '',
      '- Decision: Blog publish is not approved.',
      '- Approved scope: Review only.',
      '',
    ].join('\n'),
    'utf8',
  );
  const { result, payload } = runGate([
    '--post',
    'posts/078_화장실문틀교체.md',
    '--mode',
    'publish',
    '--control-dir',
    controlDir,
  ]);
  assert.strictEqual(result.status, 1);
  assertBlocked(payload, 'PUBLISH_APPROVAL_MISSING');
  removeDir(controlDir);
}

function testAlreadyPublishedRegistryEntryBlocksDuplicatePublish() {
  const controlDir = makeControlDir();
  const { result, payload } = runGate([
    '--post',
    'posts/069_3연동중문_리라이팅.md',
    '--mode',
    'publish',
    '--control-dir',
    controlDir,
  ]);
  assert.strictEqual(result.status, 1);
  assertBlocked(payload, 'POST_ALREADY_PUBLISHED');
  removeDir(controlDir);
}

function testPlainNaverUrlInRegistryBlocksDuplicatePublish() {
  const controlDir = makeControlDir();
  const registry = path.join(root, 'docs', 'strategy', 'POSTING_REGISTRY.md');
  const original = fs.readFileSync(registry, 'utf8');
  try {
    const patched = original.replace(
      '| 078 | 078_화장실문틀교체.md | 클러스터(H4) | 화장실문틀교체 | 화장실문틀교체 전 꼭 보는 3가지 세트 기준 | - | - |',
      '| 078 | 078_화장실문틀교체.md | 클러스터(H4) | 화장실문틀교체 | 화장실문틀교체 전 꼭 보는 3가지 세트 기준 | https://blog.naver.com/doorgeneral/224399999999?tracking=1 | 2026-06-17 |',
    );
    fs.writeFileSync(registry, patched, 'utf8');
    const { result, payload } = runGate([
      '--post',
      'posts/078_화장실문틀교체.md',
      '--mode',
      'publish',
      '--control-dir',
      controlDir,
    ]);
    assert.strictEqual(result.status, 1);
    assertBlocked(payload, 'POST_ALREADY_PUBLISHED');
  } finally {
    fs.writeFileSync(registry, original, 'utf8');
    removeDir(controlDir);
  }
}

function testValidatePostFailureBlocksPublish() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'blog-gate-bad-post-'));
  const post = path.join(dir, '999_bad.md');
  fs.writeFileSync(
    post,
    [
      '# 중문 할까?',
      '',
      '안녕하세요 문장군입니다. 현관문 보양 완벽 방음 무조건 가능합니다.',
      '',
      '# 해시태그',
      '',
      '#문장군',
      '',
    ].join('\n'),
    'utf8',
  );
  const controlDir = makeControlDir();
  const leakedReport = path.join(root, 'outputs', 'checks', '999_bad_check.md');
  if (fs.existsSync(leakedReport)) fs.unlinkSync(leakedReport);
  const { result, payload } = runGate([
    '--post',
    post,
    '--mode',
    'publish',
    '--control-dir',
    controlDir,
  ]);
  assert.strictEqual(result.status, 1);
  assertBlocked(payload, 'POST_VALIDATION_FAILED');
  assert.strictEqual(fs.existsSync(leakedReport), false, 'blog gate must not write validate_post reports for temp posts');
  removeDir(dir);
  removeDir(controlDir);
}

function testPublishAllowedNoBlocksPublish() {
  const controlDir = makeControlDir();
  fs.writeFileSync(
    path.join(controlDir, 'STATUS.md'),
    [
      '# STATUS - blog publish gate',
      '',
      '- Publish allowed: `NO`',
      '- Post QA: `PASS`',
      '',
    ].join('\n'),
    'utf8',
  );
  const { result, payload } = runGate([
    '--post',
    'posts/078_화장실문틀교체.md',
    '--mode',
    'publish',
    '--control-dir',
    controlDir,
  ]);
  assert.strictEqual(result.status, 1);
  assertBlocked(payload, 'PUBLISH_NOT_ALLOWED');
  removeDir(controlDir);
}

function testPostQaFailBlocksPublish() {
  const controlDir = makeControlDir();
  fs.writeFileSync(
    path.join(controlDir, 'STATUS.md'),
    [
      '# STATUS - blog publish gate',
      '',
      '- Publish allowed: `YES`',
      '- Post QA: `FAIL`',
      '',
    ].join('\n'),
    'utf8',
  );
  const { result, payload } = runGate([
    '--post',
    'posts/078_화장실문틀교체.md',
    '--mode',
    'publish',
    '--control-dir',
    controlDir,
  ]);
  assert.strictEqual(result.status, 1);
  assertBlocked(payload, 'POST_QA_NOT_PASS');
  removeDir(controlDir);
}

function testPublishModeEscalatesTitleWithoutNumber() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'blog-gate-no-number-'));
  const post = path.join(dir, '998_no_number.md');
  fs.writeFileSync(
    post,
    [
      '# 아파트 중문 설치 전 확인할 기준',
      '',
      '아파트 중문 설치 전 현장에서 확인할 기준을 정리합니다.',
      '',
      '무료 방문실측으로 현장 조건을 먼저 확인할 수 있습니다.',
      '',
      '관련 글',
      'https://blog.naver.com/doorgeneral/224317511025',
      'https://blog.naver.com/doorgeneral/224317523524',
      '',
      '# 해시태그',
      '',
      '#아파트중문 #현관중문 #중문설치 #무료방문실측 #중문종류 #문장군 #문장군중문',
      '',
    ].join('\n'),
    'utf8',
  );
  const controlDir = makeControlDir();
  const { result, payload } = runGate([
    '--post',
    post,
    '--mode',
    'publish',
    '--control-dir',
    controlDir,
  ]);
  assert.strictEqual(result.status, 1);
  assertBlocked(payload, 'TITLE_NUMBER_MISSING');
  removeDir(dir);
  removeDir(controlDir);
}

function testMunjanggunSpecificForbiddenClaimsBlockPublish() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'blog-gate-scope-'));
  const post = path.join(dir, '997_scope.md');
  fs.writeFileSync(
    post,
    [
      '# 문틀교체비용 확인할 3가지 기준',
      '',
      '문틀만 단독 교체 가능하다고 안내하면 안 되는 상황입니다.',
      '비대칭양개형중문과 중문파티션도 공식 시공 제품처럼 쓰면 안 됩니다.',
      '살면서리모델링 전체 공사까지 가능한 것처럼 쓰지 않습니다.',
      '',
      '무료 방문실측으로 현장 조건을 먼저 확인할 수 있습니다.',
      '',
      '관련 글',
      'https://blog.naver.com/doorgeneral/224317511025',
      'https://blog.naver.com/doorgeneral/224317523524',
      '',
      '# 해시태그',
      '',
      '#문틀교체비용 #문틀교체 #문짝교체비용 #방문교체비용 #ABS도어 #문장군 #문장군중문',
      '',
    ].join('\n'),
    'utf8',
  );
  const controlDir = makeControlDir();
  const { result, payload } = runGate([
    '--post',
    post,
    '--mode',
    'publish',
    '--control-dir',
    controlDir,
  ]);
  assert.strictEqual(result.status, 1);
  const actualCodes = codes(payload);
  assert(actualCodes.includes('DOOR_FRAME_ONLY_CLAIM'));
  assert(actualCodes.includes('EXCLUDED_PRODUCT_CLAIM'));
  assert(actualCodes.includes('SERVICE_SCOPE_OVERREACH'));
  removeDir(dir);
  removeDir(controlDir);
}

function testProductionNotesAndBodyHashtagsBlockPublish() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'blog-gate-notes-'));
  const post = path.join(dir, '996_notes.md');
  fs.writeFileSync(
    post,
    [
      '# 아파트 중문 설치 전 확인할 3가지 기준',
      '',
      '본문 중간 #아파트중문 해시태그는 발행 본문에서 제외해야 합니다.',
      '',
      '[사진: 현관 전경]',
      '',
      '검색 의도 분석',
      '- 제작 노트가 본문에 남아 있습니다.',
      '',
      '무료 방문실측으로 현장 조건을 먼저 확인할 수 있습니다.',
      '',
      '관련 글',
      'https://blog.naver.com/doorgeneral/224317511025',
      'https://blog.naver.com/doorgeneral/224317523524',
      '',
      '# 해시태그',
      '',
      '#아파트중문 #현관중문 #중문설치 #무료방문실측 #중문종류 #문장군 #문장군중문',
      '',
    ].join('\n'),
    'utf8',
  );
  const controlDir = makeControlDir();
  const { result, payload } = runGate([
    '--post',
    post,
    '--mode',
    'publish',
    '--control-dir',
    controlDir,
  ]);
  assert.strictEqual(result.status, 1);
  const actualCodes = codes(payload);
  assert(actualCodes.includes('PRODUCTION_NOTE_IN_POST'));
  assert(actualCodes.includes('PHOTO_PLACEHOLDER_IN_POST'));
  assert(actualCodes.includes('BODY_HASHTAG_PRESENT'));
  removeDir(dir);
  removeDir(controlDir);
}

function main() {
  [
    testValidUrlWaitingPostPasses,
    testMissingStatusBlocksPublish,
    testApprovalLogWithNotApprovedDoesNotPass,
    testAlreadyPublishedRegistryEntryBlocksDuplicatePublish,
    testPlainNaverUrlInRegistryBlocksDuplicatePublish,
    testValidatePostFailureBlocksPublish,
    testPublishAllowedNoBlocksPublish,
    testPostQaFailBlocksPublish,
    testPublishModeEscalatesTitleWithoutNumber,
    testMunjanggunSpecificForbiddenClaimsBlockPublish,
    testProductionNotesAndBodyHashtagsBlockPublish,
  ].forEach((test) => test());
  console.log('blog quality gate tests passed');
}

main();
