const assert = require('assert');
const crypto = require('crypto');
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

function sha256File(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function writeEvidence(controlDir, evidence = {}) {
  fs.writeFileSync(
    path.join(controlDir, 'EVIDENCE.json'),
    JSON.stringify(
      {
        source_type: 'field_pattern',
        evidence_refs: ['FIELD_PATTERN_GENERAL_001'],
        quote_status: 'paraphrased',
        privacy_status: 'anonymized',
        evidence_scope: {},
        claims: [{ claim: 'general field pattern', evidence_refs: ['FIELD_PATTERN_GENERAL_001'] }],
        ...evidence,
      },
      null,
      2,
    ),
    'utf8',
  );
}

function makeControlDir({
  status = true,
  approval = true,
  postPath = path.join(root, 'posts', '087_PVC걸레받이단점.md'),
  approvalHash = postPath && fs.existsSync(postPath) ? sha256File(postPath) : null,
  evidence = true,
  evidenceData = {},
} = {}) {
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
        approvalHash ? `- Content SHA-256: ${approvalHash}` : '',
        '- Not approved: Changing title, deleting CTA, or publishing a different file.',
        '',
      ].join('\n'),
      'utf8',
    );
  }
  if (evidence) writeEvidence(dir, evidenceData);
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
    'posts/087_PVC걸레받이단점.md',
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
    'posts/087_PVC걸레받이단점.md',
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
    'posts/087_PVC걸레받이단점.md',
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
      '| 087 | 087_PVC걸레받이단점.md | 클러스터(H4·H5) | PVC걸레받이단점, 걸레받이몰딩 | PVC 걸레받이 단점 시공 전 보는 3가지 기준 | - | - |',
      '| 087 | 087_PVC걸레받이단점.md | 클러스터(H4·H5) | PVC걸레받이단점, 걸레받이몰딩 | PVC 걸레받이 단점 시공 전 보는 3가지 기준 | https://blog.naver.com/doorgeneral/224399999999?tracking=1 | 2026-06-22 |',
    );
    fs.writeFileSync(registry, patched, 'utf8');
    const { result, payload } = runGate([
      '--post',
      'posts/087_PVC걸레받이단점.md',
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
    'posts/087_PVC걸레받이단점.md',
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
    'posts/087_PVC걸레받이단점.md',
    '--mode',
    'publish',
    '--control-dir',
    controlDir,
  ]);
  assert.strictEqual(result.status, 1);
  assertBlocked(payload, 'POST_QA_NOT_PASS');
  removeDir(controlDir);
}

function testPublishModeDoesNotBlockTitleWithoutNumber() {
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
  const controlDir = makeControlDir({ postPath: post });
  const { result, payload } = runGate([
    '--post',
    post,
    '--mode',
    'publish',
    '--control-dir',
    controlDir,
  ]);
  assert.strictEqual(result.status, 1);
  assert(!codes(payload).includes('TITLE_NUMBER_MISSING'), `TITLE_NUMBER_MISSING should not block publish, got ${codes(payload).join(', ')}`);
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

function writeTempPost(name, lines) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'blog-gate-p1-'));
  const post = path.join(dir, name);
  fs.writeFileSync(post, `${lines.join('\n')}\n`, 'utf8');
  return { dir, post };
}

function basePostLines(extraLines = [], hashtagLine = '#아파트중문 #현관중문 #중문설치 #무료방문실측 #문장군 #문장군중문') {
  return [
    '# 아파트 중문 설치 3가지 기준',
    '',
    '아파트 중문 설치는 현장 구조와 사용 동선을 먼저 확인해야 합니다.',
    ...extraLines,
    '',
    '무료 방문실측으로 현장 조건을 먼저 확인하고 결정하셔도 됩니다.',
    '',
    '관련 글',
    'https://blog.naver.com/doorgeneral/224317511025',
    'https://blog.naver.com/doorgeneral/224317523524',
    '',
    '# 해시태그',
    '',
    hashtagLine,
    '',
  ];
}

function testApprovalHashMissingBlocksPublish() {
  const { dir, post } = writeTempPost('990_hash_missing.md', basePostLines());
  const controlDir = makeControlDir({ postPath: post, approvalHash: null });
  const { result, payload } = runGate(['--post', post, '--mode', 'publish', '--control-dir', controlDir]);
  assert.strictEqual(result.status, 1);
  assertBlocked(payload, 'APPROVAL_HASH_MISSING');
  removeDir(dir);
  removeDir(controlDir);
}

function testApprovalHashMismatchBlocksPublish() {
  const { dir, post } = writeTempPost('989_hash_mismatch.md', basePostLines());
  const controlDir = makeControlDir({ postPath: post, approvalHash: '0'.repeat(64) });
  const { result, payload } = runGate(['--post', post, '--mode', 'publish', '--control-dir', controlDir]);
  assert.strictEqual(result.status, 1);
  assertBlocked(payload, 'APPROVAL_HASH_MISMATCH');
  removeDir(dir);
  removeDir(controlDir);
}

function testActualCaseWithoutEvidenceBlocksPublish() {
  const { dir, post } = writeTempPost(
    '988_case_no_evidence.md',
    basePostLines(['안산 고객님 현장에서는 ABS도어 교체 후 만족도가 높았습니다.']),
  );
  const controlDir = makeControlDir({ postPath: post, evidence: false });
  const { result, payload } = runGate(['--post', post, '--mode', 'publish', '--control-dir', controlDir]);
  assert.strictEqual(result.status, 1);
  assertBlocked(payload, 'EVIDENCE_REQUIRED');
  removeDir(dir);
  removeDir(controlDir);
}

function testDirectQuoteWithoutQuoteStatusBlocksPublish() {
  const { dir, post } = writeTempPost(
    '987_quote_no_status.md',
    basePostLines(['고객님은 "생각보다 훨씬 조용해졌어요"라고 말씀하셨습니다.']),
  );
  const controlDir = makeControlDir({
    postPath: post,
    evidenceData: { quote_status: null, evidence_refs: ['APPSHEET_CASE_20260613_001'] },
  });
  const { result, payload } = runGate(['--post', post, '--mode', 'publish', '--control-dir', controlDir]);
  assert.strictEqual(result.status, 1);
  assertBlocked(payload, 'QUOTE_EVIDENCE_REQUIRED');
  removeDir(dir);
  removeDir(controlDir);
}

function testConstructedExampleCannotLookLikeActualCase() {
  const { dir, post } = writeTempPost(
    '986_constructed_actual.md',
    basePostLines(['실제 안산 고객님 사례에서는 시공 후 바로 체감했다고 정리했습니다.']),
  );
  const controlDir = makeControlDir({
    postPath: post,
    evidenceData: {
      source_type: 'constructed_example',
      evidence_refs: ['CONSTRUCTED_EXAMPLE_001'],
      evidence_scope: { region: '안산', product: 'ABS도어', case_type: 'bathroom_door_replacement' },
    },
  });
  const { result, payload } = runGate(['--post', post, '--mode', 'publish', '--control-dir', controlDir]);
  assert.strictEqual(result.status, 1);
  assertBlocked(payload, 'CONSTRUCTED_CASE_MISREPRESENTED');
  removeDir(dir);
  removeDir(controlDir);
}

function testEvidenceRegionMismatchBlocksPublish() {
  const { dir, post } = writeTempPost(
    '985_region_mismatch.md',
    basePostLines(['안산 고객님 현장은 ABS도어 교체가 필요한 구조였습니다.']),
  );
  const controlDir = makeControlDir({
    postPath: post,
    evidenceData: {
      evidence_refs: ['APPSHEET_CASE_20260613_001'],
      evidence_scope: { region: '수원', product: 'ABS도어', case_type: 'bathroom_door_replacement' },
    },
  });
  const { result, payload } = runGate(['--post', post, '--mode', 'publish', '--control-dir', controlDir]);
  assert.strictEqual(result.status, 1);
  assertBlocked(payload, 'EVIDENCE_REGION_MISMATCH');
  removeDir(dir);
  removeDir(controlDir);
}

function testStrongClaimWithoutEvidenceBlocksPublish() {
  const { dir, post } = writeTempPost(
    '984_claim_no_evidence.md',
    basePostLines(['중문 설치 후 소음이 90% 줄어드는 확실한 효과를 기대할 수 있습니다.']),
  );
  const controlDir = makeControlDir({ postPath: post, evidenceData: { claims: [] } });
  const { result, payload } = runGate(['--post', post, '--mode', 'publish', '--control-dir', controlDir]);
  assert.strictEqual(result.status, 1);
  assertBlocked(payload, 'CLAIM_EVIDENCE_REQUIRED');
  removeDir(dir);
  removeDir(controlDir);
}

function testUnsupportedProductBlocksPublish() {
  const { dir, post } = writeTempPost(
    '983_unsupported_product.md',
    basePostLines(['현관문과 방화문까지 함께 교체 가능한 것처럼 쓰면 안 됩니다.']),
  );
  const controlDir = makeControlDir({ postPath: post });
  const { result, payload } = runGate(['--post', post, '--mode', 'publish', '--control-dir', controlDir]);
  assert.strictEqual(result.status, 1);
  assertBlocked(payload, 'UNSUPPORTED_PRODUCT_CLAIM');
  removeDir(dir);
  removeDir(controlDir);
}

function testHashtagSpacingBlocksPublish() {
  const { dir, post } = writeTempPost(
    '982_hashtag_spacing.md',
    basePostLines([], '#아파트 중문 #현관중문 #중문설치 #무료방문실측 #문장군 #문장군중문'),
  );
  const controlDir = makeControlDir({ postPath: post });
  const { result, payload } = runGate(['--post', post, '--mode', 'publish', '--control-dir', controlDir]);
  assert.strictEqual(result.status, 1);
  assertBlocked(payload, 'HASHTAG_SPACING_INVALID');
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
    testPublishModeDoesNotBlockTitleWithoutNumber,
    testMunjanggunSpecificForbiddenClaimsBlockPublish,
    testProductionNotesAndBodyHashtagsBlockPublish,
    testApprovalHashMissingBlocksPublish,
    testApprovalHashMismatchBlocksPublish,
    testActualCaseWithoutEvidenceBlocksPublish,
    testDirectQuoteWithoutQuoteStatusBlocksPublish,
    testConstructedExampleCannotLookLikeActualCase,
    testEvidenceRegionMismatchBlocksPublish,
    testStrongClaimWithoutEvidenceBlocksPublish,
    testUnsupportedProductBlocksPublish,
    testHashtagSpacingBlocksPublish,
  ].forEach((test) => test());
  console.log('blog quality gate tests passed');
}

main();
