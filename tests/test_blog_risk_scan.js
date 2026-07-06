const assert = require('assert');

const { scanContent } = require('../scripts/blog_risk_scan');

function testScanContentExtractsEditorialRisks() {
  const content = [
    '# 안산 화장실문교체 전 확인할 3가지 기준',
    '',
    '실제로 안산 고객님은 "진작 바꿀 걸 그랬다"고 말씀하셨습니다.',
    'ABS도어로 바꾸면 생활 소음이 90% 줄어든다고 단정하면 위험합니다.',
    '무료 방문실측으로 현장 조건을 확인할 수 있습니다.',
    '',
    '# 해시태그',
    '',
    '#화장실문교체 #ABS도어 #문장군 #문장군중문',
    '',
  ].join('\n');

  const result = scanContent(content, 'posts/999_test.md');

  assert(result.quotes.includes('진작 바꿀 걸 그랬다'));
  assert(result.case_like_sentences.some((line) => line.includes('안산 고객님')));
  assert(result.regions.includes('안산'));
  assert(result.products.includes('ABS도어'));
  assert(result.numeric_claims.some((line) => line.includes('90%')));
  assert(result.performance_claims.some((line) => line.includes('소음')));
  assert(result.ctas.some((line) => line.includes('무료 방문실측')));
  assert(result.hashtags.includes('#화장실문교체'));
  assert(result.risk_items.some((item) => item.status === 'NEEDS_EVIDENCE'));
  assert(result.risk_items.some((item) => item.status === 'FIX'));
}

function testScanContentExtractsBrandClaimRisks() {
  const content = [
    '# 중문 일정과 리뷰 claim 점검',
    '',
    '결정 후 3~4일 안에 시공됩니다.',
    '리뷰 15,000개와 4,000개를 전체 브랜드 리뷰처럼 씁니다.',
    '영종도도 무료 방문 실측이 가능합니다.',
    '',
  ].join('\n');

  const result = scanContent(content, 'posts/998_brand_claim.md');
  const codes = result.brand_claim_issues.map((issue) => issue.code);

  assert(codes.includes('BRAND_SCHEDULE_CLAIM_INVALID'));
  assert(codes.includes('BRAND_REVIEW_CLAIM_INVALID'));
  assert(codes.includes('UNAVAILABLE_REGION_CLAIM'));
  assert(result.risk_items.some((item) => item.type === 'BRAND_SCHEDULE_CLAIM_INVALID'));
}

function testScanContentAllowsSafeBrandClaims() {
  const content = [
    '# 안전한 중앙 claim 점검',
    '',
    '네이버 상품 리뷰 3.5만 개 이상이라는 범위 안에서만 리뷰 표현을 사용합니다.',
    '중문은 결정 후 보통 3~6일 범위에서 시공 일정이 잡히는 경우가 많습니다.',
    '영종도는 현재 무료 방문 실측이 어렵습니다.',
    '',
  ].join('\n');

  const result = scanContent(content, 'posts/997_brand_safe.md');
  const codes = result.brand_claim_issues.map((issue) => issue.code);

  assert(!codes.includes('BRAND_SCHEDULE_CLAIM_INVALID'));
  assert(!codes.includes('BRAND_REVIEW_CLAIM_INVALID'));
  assert(!codes.includes('UNAVAILABLE_REGION_CLAIM'));
}

function main() {
  testScanContentExtractsEditorialRisks();
  testScanContentExtractsBrandClaimRisks();
  testScanContentAllowsSafeBrandClaims();
  console.log('blog risk scan tests passed');
}

main();
