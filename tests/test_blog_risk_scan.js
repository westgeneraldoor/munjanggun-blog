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

function main() {
  testScanContentExtractsEditorialRisks();
  console.log('blog risk scan tests passed');
}

main();
