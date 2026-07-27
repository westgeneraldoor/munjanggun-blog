const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const cli = path.join(root, 'scripts', 'validate_post.js');

function runValidate(postPath, extraArgs = []) {
  return spawnSync(process.execPath, [cli, postPath, ...extraArgs, '--no-write-report'], {
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
  const postsDir = path.join(root, 'posts');
  fs.mkdirSync(postsDir, { recursive: true });
  const post = path.join(postsDir, fileName);
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
  const post = writeRootPost('110_length_probe.md', basePostLines(['## 실제 시공 현장에서는 조금 다릅니다', '현장형 글인데 본문이 너무 짧으면 발행 기준을 통과하면 안 됩니다.']));
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
  const post = writeRootPost('111_missing_field_section.md', basePostLines(['현장형 글인데 실제 시공 현장 단락 없이 설명만 이어지면 발행하면 안 됩니다.']));
  try {
    const result = runValidate(post);
    assert.strictEqual(result.status, 1, result.stdout);
    assert.match(result.stdout, /실제 시공 현장에서는 조금 다릅니다/);
  } finally {
    fs.rmSync(post, { force: true });
  }
}

function testInternalMemoFailsValidation() {
  const post = writeRootPost('112_internal_memo.md', basePostLines([
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

function testQuestionTitleWarnsButDoesNotFailValidation() {
  const { dir, post } = writeTempPost(basePostLines([], '#아파트중문 #현관중문 #중문설치 #무료방문실측 #중문종류 #문장군 #문장군중문'));
  fs.writeFileSync(
    post,
    `${[
      '# 아파트 중문 설치 3가지, 우리 집에는 어떨까',
      '',
      '아파트 중문 설치는 현장 구조와 사용 동선을 먼저 확인해야 합니다.',
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
    ].join('\n')}\n`,
    'utf8',
  );
  try {
    const result = runValidate(post);
    assert.strictEqual(result.status, 0, result.stdout);
    assert.match(result.stdout, /질문형 제목/);
    assert.match(result.stdout, /fail 0개, warn 1개/);

    const strictResult = runValidate(post, ['--strict']);
    assert.strictEqual(strictResult.status, 1, strictResult.stdout);
    assert.match(strictResult.stdout, /질문형 제목/);
    assert.match(strictResult.stdout, /fail 0개, warn 1개/);
  } finally {
    removeDir(dir);
  }
}

function testStandaloneJungmunTitleStillFailsValidation() {
  const { dir, post } = writeTempPost(basePostLines());
  fs.writeFileSync(
    post,
    `${[
      '# 중문',
      '',
      '아파트 중문 설치는 현장 구조와 사용 동선을 먼저 확인해야 합니다.',
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
    ].join('\n')}\n`,
    'utf8',
  );
  try {
    const result = runValidate(post);
    assert.strictEqual(result.status, 1, result.stdout);
    assert.match(result.stdout, /`중문` 단독 제목은 금지/);
  } finally {
    removeDir(dir);
  }
}

function testCentralBrandClaimGateFailsValidation() {
  const { dir, post } = writeTempPost(basePostLines([
    '결정 후 3~4일 안에 시공됩니다.',
    '리뷰 15,000개와 4,000개를 전체 브랜드 리뷰처럼 씁니다.',
    '영종도도 무료 방문 실측이 가능합니다.',
  ]));
  try {
    const result = runValidate(post);
    assert.strictEqual(result.status, 1, result.stdout);
    assert.match(result.stdout, /BRAND_SCHEDULE_CLAIM_INVALID/);
    assert.match(result.stdout, /BRAND_REVIEW_CLAIM_INVALID/);
    assert.match(result.stdout, /UNAVAILABLE_REGION_CLAIM/);
  } finally {
    removeDir(dir);
  }
}

function testCentralBrandClaimGateAllowsSafeClaims() {
  const { dir, post } = writeTempPost(basePostLines([
    '네이버 상품 리뷰 3.5만 개 이상이라는 범위 안에서만 리뷰 표현을 사용합니다.',
    '중문은 결정 후 보통 3~6일 범위에서 일정이 잡히는 경우가 많습니다.',
    '영종도는 현재 무료 방문 실측이 어렵습니다.',
    '문 상태를 보여주는 신호를 함께 확인합니다.',
  ]));
  try {
    const result = runValidate(post);
    assert.strictEqual(result.status, 0, result.stdout);
    assert.doesNotMatch(result.stdout, /BRAND_REVIEW_CLAIM_INVALID/);
    assert.doesNotMatch(result.stdout, /BRAND_SCHEDULE_CLAIM_INVALID/);
    assert.doesNotMatch(result.stdout, /UNAVAILABLE_REGION_CLAIM/);
  } finally {
    removeDir(dir);
  }
}

function winningFormatPostLines(extraLines = []) {
  return [
    '# 방문교체 전에 문틀 상태부터 나눠야 하는 이유',
    '',
    '방문교체를 알아볼 때 대부분 문짝부터 떠올립니다.',
    '',
    '"문짝만 바꿔도 되지 않을까요?"',
    '',
    ...extraLines,
    '',
    '## 실제 시공 현장에서는 조금 다릅니다',
    '',
    '비슷한 구축 아파트 현장에서도 문틀 상태를 함께 확인한 경우가 있었습니다.',
    '',
    '무료 방문실측으로 현장 조건을 확인하고 네이버 예약으로 접수할 수 있습니다.',
    '',
    '## 관련 글',
    '',
    'https://blog.naver.com/doorgeneral/224317511025',
    'https://blog.naver.com/doorgeneral/224317523524',
    '',
    '## 해시태그',
    '',
    '#방문교체 #문짝교체 #문틀 #무료방문실측 #문장군 #문장군중문',
    '',
  ];
}

function numberedSections() {
  return [
    '## 1. 문틀이 틀어졌는지 먼저 봐야 합니다',
    '',
    '문틀이 틀어진 집은 문짝만 바꿔도 빛샘이 남습니다.',
    '',
    '## 2. 바닥 마감이 문짝 간격을 바꿉니다',
    '',
    '덧방한 바닥은 문짝 하단 간격을 줄입니다.',
    '',
    '## 3. 문선 경계는 도배 계획과 같이 정해집니다',
    '',
    '문선까지 바꾸면 벽지 끝선이 함께 드러납니다.',
  ];
}

function testWinningFormatMissingNumberedSectionsFails() {
  const post = writeRootPost('995_winning_format_sections.md', winningFormatPostLines([
    '## 문틀 상태를 봅니다',
    '',
    '서술형 소제목만 있으면 모바일에서 결론이 스캔되지 않습니다.',
  ]));
  try {
    const result = runValidate(post);
    assert.strictEqual(result.status, 1, result.stdout);
    assert.match(result.stdout, /번호 판단 단락이 3개 이상 필요합니다/);
  } finally {
    fs.rmSync(post, { force: true });
  }
}

function testWinningFormatMissingCustomerQuoteFails() {
  const lines = winningFormatPostLines(numberedSections())
    .filter((line) => !line.includes('문짝만 바꿔도 되지 않을까요?'));
  const post = writeRootPost('994_winning_format_quote.md', lines);
  try {
    const result = runValidate(post);
    assert.strictEqual(result.status, 1, result.stdout);
    assert.match(result.stdout, /큰따옴표로 1회 이상/);
  } finally {
    fs.rmSync(post, { force: true });
  }
}

function testWinningFormatHashtagHeadingLevelFails() {
  const lines = winningFormatPostLines(numberedSections())
    .map((line) => (line === '## 해시태그' ? '# 해시태그' : line));
  const post = writeRootPost('993_winning_format_hashtag.md', lines);
  try {
    const result = runValidate(post);
    assert.strictEqual(result.status, 1, result.stdout);
    assert.match(result.stdout, /`## 해시태그`로 씁니다/);
  } finally {
    fs.rmSync(post, { force: true });
  }
}

function testWinningFormatCompliantPostPasses() {
  const post = writeRootPost('992_winning_format_ok.md', winningFormatPostLines(numberedSections()));
  try {
    const result = runValidate(post);
    assert.strictEqual(result.status, 0, result.stdout);
    assert.doesNotMatch(result.stdout, /번호 판단 단락/);
    assert.doesNotMatch(result.stdout, /큰따옴표로/);
  } finally {
    fs.rmSync(post, { force: true });
  }
}

function testWinningFormatNotAppliedBeforeCutover() {
  const post = writeRootPost('169_winning_format_legacy.md', winningFormatPostLines([
    '## 문틀 상태를 봅니다',
    '',
    '컷오버 이전 번호는 승리 포맷 하드 FAIL 대상이 아닙니다.',
  ]).filter((line) => !line.includes('문짝만 바꿔도 되지 않을까요?')));
  try {
    const result = runValidate(post);
    assert.doesNotMatch(result.stdout, /번호 판단 단락이 3개 이상 필요합니다/);
    assert.doesNotMatch(result.stdout, /큰따옴표로 1회 이상/);
  } finally {
    fs.rmSync(post, { force: true });
  }
}

function main() {
  testWinningFormatMissingNumberedSectionsFails();
  testWinningFormatMissingCustomerQuoteFails();
  testWinningFormatHashtagHeadingLevelFails();
  testWinningFormatCompliantPostPasses();
  testWinningFormatNotAppliedBeforeCutover();
  testUnsupportedProductsFailValidation();
  testDoorFrameOnlyPositiveClaimFailsValidation();
  testShortFieldStoryPostWarnsValidation();
  testMissingFieldStorySectionFailsValidation();
  testInternalMemoFailsValidation();
  testTitleCandidateSectionDoesNotBecomePublishTitle();
  testTitleCandidateSectionExcludedFromBodyLength();
  testQuestionTitleWarnsButDoesNotFailValidation();
  testStandaloneJungmunTitleStillFailsValidation();
  testCentralBrandClaimGateFailsValidation();
  testCentralBrandClaimGateAllowsSafeClaims();
  console.log('validate_post product tests passed');
}

main();
