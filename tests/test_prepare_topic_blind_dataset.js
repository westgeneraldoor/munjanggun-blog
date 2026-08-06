const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  assertSafeBlindDataset,
  blindId,
  buildBlindDataset,
  defaultOutputPath,
  forbiddenOutcomeFields,
  maskDateReferences,
  writeBlindDataset,
} = require('../scripts/prepare_topic_blind_dataset');

function registry(rows) {
  return {
    schema_version: 1,
    id: 'posting_registry',
    blocks: [{
      type: 'table',
      header: ['#', '파일', '허브', '타겟 키워드', '포스팅 제목', 'URL', '발행일', '다룬 소재 (중복 방지용)'],
      rows,
    }],
  };
}

function performance(posts) {
  return {
    schema_version: 1,
    updated_at: '2026-08-06',
    posts,
  };
}

function testBuildsDeterministicOutcomeBlindRecords() {
  const sourceRegistry = registry([
    ['152', '152_a.md', 'H1', '중문설치, 현관중문', '고객 고민 제목', 'https://example.test/152', '2026-07-01', '현관 폭과 스위치 간섭을 판단하는 글'],
    ['153', '153_b.md', 'H4', '방문교체', '두 번째 제목', 'https://example.test/153', '2026-07-02', '문틀 상태와 교체 범위를 판단하는 글'],
    ['154', '154_c.md', 'H4', 'ABS도어', '판정 전 글', 'https://example.test/154', '2026-07-03', '습기와 문짝 상태를 판단하는 글'],
  ]);
  const sourcePerformance = performance([
    { post_no: '153', verdict: 'faded', published_at: '2026-07-02', observations: [{ date: '2026-07-05', rank: 1 }] },
    { post_no: '152', verdict: 'landed', published_at: '2026-07-01', observations: [{ date: '2026-07-04', rank: 2 }] },
    { post_no: '154', verdict: 'pending', published_at: '2026-07-03', observations: [] },
  ]);

  const first = buildBlindDataset(sourceRegistry, sourcePerformance);
  const second = buildBlindDataset(sourceRegistry, performance([...sourcePerformance.posts].reverse()));

  assert.deepStrictEqual(first.records, second.records);
  assert.strictEqual(first.records.length, 2);
  assert(first.records.every((record) => /^T-[a-p]{12}$/.test(record.blind_id)));
  assert(first.records.every((record) => !record.blind_id.includes('152') && !record.blind_id.includes('153')));
  assert(first.records.some((record) => record.title === '고객 고민 제목'));
  assert(first.records.some((record) => record.target_keywords.includes('중문설치')));
}

function testBlindIdsCannotLookLikeFourDigitYears() {
  assert.strictEqual(blindId('162'), 'T-cafamffcnlie');
  assert.doesNotMatch(blindId('162'), /20\d\d/);
}

function testRemovesEveryOutcomeAndOrderingField() {
  const dataset = buildBlindDataset(
    registry([['152', '152_a.md', 'H1', '중문설치', '고객 고민 제목', 'https://example.test/152', '2026-07-01', '소재 요약']]),
    performance([{ post_no: '152', verdict: 'landed', published_at: '2026-07-01', observations: [{ date: '2026-07-04', rank: 2 }] }])
  );

  const serialized = JSON.stringify(dataset);
  forbiddenOutcomeFields.forEach((field) => {
    assert(!Object.prototype.hasOwnProperty.call(dataset.records[0], field), `forbidden field leaked: ${field}`);
  });
  assert(!serialized.includes('landed'));
  assert(!serialized.includes('2026-07-01'));
  assert(!serialized.includes('https://example.test/152'));
  assert(!serialized.includes('152_a.md'));
  assert.doesNotMatch(serialized, /20\d\d/);
}

function testMasksSupportedDateFormsWithoutChangingOrdinaryNumbers() {
  assert.strictEqual(
    maskDateReferences('2026-06-22 / 26-06-22 / 2026/06/22 / 6월 22일 / 6/22 / 12mm / 24평'),
    '[날짜 마스킹] / [날짜 마스킹] / [날짜 마스킹] / [날짜 마스킹] / [날짜 마스킹] / 12mm / 24평'
  );

  const dataset = buildBlindDataset(
    registry([[
      '152',
      '152_a.md',
      'H1',
      '중문설치, 6/22 중문',
      '2026/06/22 발행 제목',
      'https://example.test/152',
      '2026-07-01',
      '6월 22일 확인, 12mm 문선과 24평 현장',
    ]]),
    performance([{ post_no: '152', verdict: 'landed' }])
  );
  assert.strictEqual(dataset.records[0].title, '[날짜 마스킹] 발행 제목');
  assert.strictEqual(dataset.records[0].topic_summary, '[날짜 마스킹] 확인, 12mm 문선과 24평 현장');
  assert.deepStrictEqual(dataset.records[0].target_keywords, ['중문설치', '[날짜 마스킹] 중문']);
}

function testMarksRecordsWithoutSummaryOrKeywords() {
  const dataset = buildBlindDataset(
    registry([
      ['152', '152_a.md', 'H1', '중문설치', '키워드 있는 제목', '-', '', ''],
      ['153', '153_b.md', 'H1', '', '요약 있는 제목', '-', '', '고객 문제 요약'],
      ['154', '154_c.md', 'H1', '', '제목만 있는 글', '-', '', ''],
    ]),
    performance([
      { post_no: '152', verdict: 'landed' },
      { post_no: '153', verdict: 'faded' },
      { post_no: '154', verdict: 'faded' },
    ])
  );
  const byTitle = Object.fromEntries(dataset.records.map((record) => [record.title, record]));
  assert.strictEqual(byTitle['키워드 있는 제목'].has_summary, true);
  assert.strictEqual(byTitle['요약 있는 제목'].has_summary, true);
  assert.strictEqual(byTitle['제목만 있는 글'].has_summary, false);
  dataset.records.forEach((record) => {
    assert.deepStrictEqual(
      Object.keys(record).sort(),
      ['blind_id', 'has_summary', 'target_keywords', 'title', 'topic_summary']
    );
  });
}

function testRemovesOutcomeSentencesButPreservesTopicEvidence() {
  const dataset = buildBlindDataset(
    registry([
      ['001', '001_old.md', 'H1', '', '비교 대상', '-', '', '비교 글'],
      ['019-1', '019-1_old.md', 'H1', '', '두 번째 비교 대상', '-', '', '비교 글'],
      ['057', '057_old.md', 'H1', '', '세 번째 비교 대상', '-', '', '비교 글'],
      ['079', '079_old.md', 'H1', '', '네 번째 비교 대상', '-', '', '비교 글'],
      [
        '152',
        '152_a.md',
        'H1',
        '천장몰딩',
        '고객 고민 제목',
        '-',
        '',
        'Q-001 보호글. 천장몰딩 종류를 공정 범위와 끝선 기준으로 비교한다. TOP1 보호 자산이므로 대수술하지 않는다. 057/019-1/079 내부링크',
      ],
    ]),
    performance([{ post_no: '152', verdict: 'landed' }])
  );

  assert.strictEqual(
    dataset.records[0].topic_summary,
    '천장몰딩 종류를 공정 범위와 끝선 기준으로 비교한다. [다른 글]/[다른 글]/[다른 글] 내부링크'
  );
  assert.doesNotMatch(dataset.records[0].topic_summary, /Q-001|TOP1|보호글|보호 자산/);
}

function testMasksOnlyRegisteredPostReferencesInReferenceContexts() {
  const dataset = buildBlindDataset(
    registry([
      ['012', '012_old.md', 'H1', '', '비교 대상', '-', '', '비교 글'],
      ['100', '100_old.md', 'H1', '', '비교 대상', '-', '', '비교 글'],
      ['145', '145_old.md', 'H1', '', '비교 대상', '-', '', '비교 글'],
      ['153', '153_old.md', 'H1', '', '비교 대상', '-', '', '비교 글'],
      ['160', '160_old.md', 'H1', '', '비교 대상', '-', '', '비교 글'],
      ['162', '162_old.md', 'H1', '', '비교 대상', '-', '', '비교 글'],
      [
        '152',
        '152_a.md',
        'H1',
        '방문교체',
        '고객 고민 제목',
        '-',
        '',
        '160번의 진단과 구분한다. 153·162·145번의 상시 노출과 다르다. 100 내부링크도 확인한다. 100% 무료, 300mm 폭, 12개월 사용, 999번 사례를 비교한다.',
      ],
    ]),
    performance([{ post_no: '152', verdict: 'faded' }])
  );

  assert.strictEqual(
    dataset.records[0].topic_summary,
    '[다른 글]의 진단과 구분한다. [다른 글]·[다른 글]·[다른 글]의 상시 노출과 다르다. [다른 글] 내부링크도 확인한다. 100% 무료, 300mm 폭, 12개월 사용, 999번 사례를 비교한다.'
  );
}

function testRemovesHollowSummaryWithoutDiscardingKeywordContext() {
  const dataset = buildBlindDataset(
    registry([["152", '152_a.md', 'H1', '중문설치', '고객 고민 제목', '-', '', '순위·통계 기반 신규 글. TOP20 진입.']]),
    performance([{ post_no: '152', verdict: 'landed' }])
  );

  assert.strictEqual(dataset.records[0].topic_summary, '');
  assert.strictEqual(dataset.records[0].has_summary, true);
  assert.deepStrictEqual(dataset.records[0].target_keywords, ['중문설치']);
}

function testRejectsUnsafeDatasetBeforeWriting() {
  const unsafeDataset = {
    schema_version: 1,
    id: 'topic_outcome_blind_dataset',
    record_count: 1,
    records: [{
      blind_id: 'T-abcdefghijkl',
      title: '고객 고민 제목',
      target_keywords: ['중문설치'],
      topic_summary: 'TOP20 진입을 확인한 보호 자산',
      has_summary: true,
    }],
  };
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'topic-blind-gate-'));
  const outputPath = path.join(tempDir, 'unsafe.json');

  try {
    assert.throws(
      () => assertSafeBlindDataset(unsafeDataset, new Set(['160'])),
      /blind dataset leakage/i
    );
    assert.throws(
      () => writeBlindDataset(outputPath, unsafeDataset, new Set(['160'])),
      /blind dataset leakage/i
    );
    assert.strictEqual(fs.existsSync(outputPath), false);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

function testGateAllowsOrdinaryNumbersButRejectsRegisteredPostReferences() {
  const safeDataset = {
    schema_version: 1,
    id: 'topic_outcome_blind_dataset',
    record_count: 1,
    records: [{
      blind_id: 'T-abcdefghijkl',
      title: '100%가 아니라 12mm 기준',
      target_keywords: ['24평 중문'],
      topic_summary: '300mm 폭과 12개월 사용 조건을 비교한다.',
      has_summary: true,
    }],
  };
  assert.doesNotThrow(() => assertSafeBlindDataset(safeDataset, new Set(['012', '100', '160'])));

  const unsafeDataset = JSON.parse(JSON.stringify(safeDataset));
  unsafeDataset.records[0].topic_summary = '160번의 진단과 비교한다.';
  assert.throws(
    () => assertSafeBlindDataset(unsafeDataset, new Set(['160'])),
    /registered post reference/i
  );

  const unexpectedFieldDataset = JSON.parse(JSON.stringify(safeDataset));
  unexpectedFieldDataset.records[0].publication_cohort = 'late';
  assert.throws(
    () => assertSafeBlindDataset(unexpectedFieldDataset, new Set(['160'])),
    /unexpected field publication_cohort/i
  );
}

function testDatesDefaultOutputFromPerformanceSnapshot() {
  assert.match(
    defaultOutputPath('2026-08-15'),
    /2026-08-15_topic_blind_dataset\.json$/
  );
}

function main() {
  testBuildsDeterministicOutcomeBlindRecords();
  testBlindIdsCannotLookLikeFourDigitYears();
  testRemovesEveryOutcomeAndOrderingField();
  testMasksSupportedDateFormsWithoutChangingOrdinaryNumbers();
  testMarksRecordsWithoutSummaryOrKeywords();
  testRemovesOutcomeSentencesButPreservesTopicEvidence();
  testMasksOnlyRegisteredPostReferencesInReferenceContexts();
  testRemovesHollowSummaryWithoutDiscardingKeywordContext();
  testRejectsUnsafeDatasetBeforeWriting();
  testGateAllowsOrdinaryNumbersButRejectsRegisteredPostReferences();
  testDatesDefaultOutputFromPerformanceSnapshot();
  console.log('topic blind dataset tests passed');
}

main();
