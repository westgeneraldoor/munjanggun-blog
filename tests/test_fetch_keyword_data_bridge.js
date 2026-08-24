const assert = require('assert');
const {
  parseSeeds,
  parseVolume,
  mergeSeedResults,
  formatBridgeResults,
} = require('../scripts/fetch_keyword_data_bridge');

function testCliSeedsOverrideDefaults() {
  assert.deepStrictEqual(
    parseSeeds(['--seeds', '입주청소, 소파,입주청소'], ['도배']),
    ['입주청소', '소파'],
  );
}

function testEqualsSyntaxOverridesDefaults() {
  assert.deepStrictEqual(parseSeeds(['--seeds=침대,마루'], ['도배']), ['침대', '마루']);
}

function testDefaultsUsedWithoutOverride() {
  assert.deepStrictEqual(parseSeeds([], ['도배', '마루', '도배']), ['도배', '마루']);
}

function testLessThanTenUsesExistingEstimatePolicy() {
  assert.deepStrictEqual(parseVolume('< 10'), { value: 5, estimated: true });
  assert.deepStrictEqual(parseVolume(17), { value: 17, estimated: false });
}

function testDuplicateKeywordRetainsAllSeedParents() {
  const rows = mergeSeedResults([
    {
      seed: '소파',
      keywords: [{ relKeyword: '이삿짐', monthlyPcQcCnt: 10, monthlyMobileQcCnt: 20, compIdx: '높음' }],
    },
    {
      seed: '침대',
      keywords: [{ relKeyword: '이삿짐', monthlyPcQcCnt: 10, monthlyMobileQcCnt: 20, compIdx: '높음' }],
    },
  ]);
  assert.strictEqual(rows.length, 1);
  assert.deepStrictEqual(rows[0].seedParents, ['소파', '침대']);
  assert.strictEqual(rows[0].total, 30);
}

function testRowsSortByVolumeDescending() {
  const rows = mergeSeedResults([{
    seed: '도배',
    keywords: [
      { relKeyword: '낮은키워드', monthlyPcQcCnt: 10, monthlyMobileQcCnt: 10, compIdx: '낮음' },
      { relKeyword: '높은키워드', monthlyPcQcCnt: 100, monthlyMobileQcCnt: 100, compIdx: '높음' },
    ],
  }]);
  assert.deepStrictEqual(rows.map((item) => item.keyword), ['높은키워드', '낮은키워드']);
}

function testMarkdownIncludesSeedsAndKeywordRows() {
  const rows = [{ keyword: '입주청소', pc: 100, mobile: 200, total: 300, competition: '중간', totalEstimated: false, seedParents: ['입주청소'] }];
  const markdown = formatBridgeResults(rows, { data_date: '2026-08-24', seeds: ['입주청소'] });
  assert.match(markdown, /조회일: 2026-08-24/);
  assert.match(markdown, /기본 허용 목록이 아니라 이번 수집 시드/);
  assert.match(markdown, /\| 입주청소 \| 100 \| 200 \| 300 \| 중간 \| 입주청소 \|/);
}

function main() {
  testCliSeedsOverrideDefaults();
  testEqualsSyntaxOverridesDefaults();
  testDefaultsUsedWithoutOverride();
  testLessThanTenUsesExistingEstimatePolicy();
  testDuplicateKeywordRetainsAllSeedParents();
  testRowsSortByVolumeDescending();
  testMarkdownIncludesSeedsAndKeywordRows();
  console.log('bridge keyword collector tests passed');
}

main();
