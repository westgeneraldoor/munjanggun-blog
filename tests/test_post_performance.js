const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

let collectPostPerformance;
let verdictForPost;
try {
  ({ collectPostPerformance, verdictForPost } = require('../scripts/collect_post_performance'));
} catch (_error) {
  collectPostPerformance = undefined;
  verdictForPost = undefined;
}

let renderPerformanceReport;
try {
  ({ renderPerformanceReport } = require('../scripts/report_post_performance'));
} catch (_error) {
  renderPerformanceReport = undefined;
}

function makeTempDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function removeDir(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

function writeFile(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
}

function writeJson(filePath, value) {
  writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function registry(rows, extraBlocks = [], titleAliases = []) {
  return {
    schema_version: 1,
    id: 'posting_registry',
    title_aliases: titleAliases,
    blocks: [
      {
        type: 'table',
        header: ['#', '포스팅 제목', '발행일(TOP20 작성일 기준)'],
        rows,
      },
      ...extraBlocks,
      {
        type: 'table',
        header: ['글', '추적 키워드'],
        rows: [['999', '수집 대상이 아님']],
      },
    ],
  };
}

function taxonomy(postNos) {
  return {
    schema_version: 1,
    id: 'seo_taxonomy',
    migration: { cutover_post_no: 152 },
    assignments: Object.fromEntries(postNos.map((postNo) => [
      `post:${postNo}`,
      {
        source_refs: [`queue:Q-${postNo}`],
        hub_ids: ['H4'],
        cluster_ids: [`C-${postNo}`],
      },
    ])),
  };
}

function topTable(headers, rows, heading = '## 게시글 TOP20') {
  return [
    heading,
    '',
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${row.join(' | ')} |`),
    '',
  ].join('\n');
}

function padTop20Rows(rows, minimumRows = 10) {
  const padded = rows.map((row) => [...row]);
  for (let rank = padded.length + 1; rank <= minimumRows; rank += 1) {
    padded.push([String(rank), '채움 글 하나', '1']);
  }
  return padded;
}

function rankedRows(count, titlePrefix = '채움') {
  return Array.from({ length: count }, (_, index) => [
    String(index + 1),
    `${titlePrefix} ${index + 1}`,
    String(20 - index),
  ]);
}

function writeFixture({ files, registryRows, registryBlocks = [], titleAliases = [], postNos }) {
  const dir = makeTempDir('post-performance-');
  const reportsDir = path.join(dir, 'daily');
  const registryPath = path.join(dir, 'POSTING_REGISTRY.json');
  const taxonomyPath = path.join(dir, 'SEO_TAXONOMY.json');

  writeJson(registryPath, registry(registryRows, registryBlocks, titleAliases));
  writeJson(taxonomyPath, taxonomy(postNos));
  Object.entries(files).forEach(([date, content]) => {
    writeFile(path.join(reportsDir, `${date}_seo_watch.md`), content);
  });

  return { dir, reportsDir, registryPath, taxonomyPath };
}

function collect(fixture) {
  assert.strictEqual(
    typeof collectPostPerformance,
    'function',
    'collect_post_performance.js must export collectPostPerformance'
  );
  return collectPostPerformance({
    reportsDir: fixture.reportsDir,
    registryPath: fixture.registryPath,
    taxonomyPath: fixture.taxonomyPath,
  });
}

function postByNo(ledger, postNo) {
  const post = ledger.posts.find((item) => item.post_no === postNo);
  assert(post, `missing post ${postNo}`);
  return post;
}

function testParsesHeaderOrderedTablesByColumnName() {
  const fixture = writeFixture({
    registryRows: [
      ['152', '첫 글', '2026-07-05'],
      ['153', '둘째 글', '2026-07-05'],
      ['154', '채움 글 하나', '2026-07-01'],
      ['155', '채움 글 둘', '2026-07-01'],
      ['156', '채움 글 셋', '2026-07-01'],
      ['157', '채움 글 넷', '2026-07-01'],
    ],
    postNos: ['152', '153', '154', '155', '156', '157'],
    files: {
      '2026-07-10': topTable(
        ['조회수', '작성일', '게시글', '순위'],
        [
          ['10', '7/5', '첫 글!', '1'],
          ['9', '7/5', '둘째 글', '2'],
          ['8', '7/1', '채움 글 하나', '3'],
          ['7', '7/1', '채움 글 둘', '4'],
          ['6', '7/1', '채움 글 셋', '5'],
        ]
      ),
      '2026-07-11': topTable(
        ['작성일', '순위', '제목', '조회수'],
        [
          ['7/5', '1', '첫 글', '11'],
          ['7/5', '2', '둘째 글', '10'],
          ['7/1', '3', '채움 글 하나', '9'],
          ['7/1', '4', '채움 글 둘', '8'],
          ['7/1', '5', '채움 글 넷', '7'],
        ]
      ),
    },
  });

  try {
    const ledger = collect(fixture);
    const first = postByNo(ledger, '152');
    const second = postByNo(ledger, '153');

    assert.deepStrictEqual(first.observations, [
      { date: '2026-07-10', day: 5, rank: 1, views: 10 },
      { date: '2026-07-11', day: 6, rank: 1, views: 11 },
    ]);
    assert.strictEqual(first.queue_id, 'Q-152');
    assert.deepStrictEqual(first.hub_ids, ['H4']);
    assert.deepStrictEqual(first.cluster_ids, ['C-152']);
    assert.strictEqual(second.published_at, '2026-07-05');
  } finally {
    removeDir(fixture.dir);
  }
}

function testMarksFewerThanFiveValidDaysUnobserved() {
  const fixture = writeFixture({
    registryRows: [
      ['152', '관측 부족 글', '2026-07-07'],
      ['153', '채움 글 하나', '2026-07-01'],
      ['154', '채움 글 둘', '2026-07-01'],
      ['155', '채움 글 셋', '2026-07-01'],
      ['156', '채움 글 넷', '2026-07-01'],
    ],
    postNos: ['152', '153', '154', '155', '156'],
    files: {
      '2026-07-10': topTable(
        ['순위', '게시글', '조회수'],
        [
          ['1', '관측 부족 글', '10'],
          ['2', '채움 글 하나', '9'],
          ['3', '채움 글 둘', '8'],
          ['4', '채움 글 셋', '7'],
          ['5', '채움 글 넷', '6'],
        ]
      ),
    },
  });

  try {
    const post = postByNo(collect(fixture), '152');
    assert.strictEqual(post.observed_days, 1);
    assert.strictEqual(post.verdict, 'unobserved');
  } finally {
    removeDir(fixture.dir);
  }
}

function testExcludesDaysZeroThroughTwoFromVerdict() {
  const fixture = writeFixture({
    registryRows: [
      ['152', '신규 노출 글', '2026-07-10'],
      ['153', '채움 글 하나', '2026-07-01'],
      ['154', '채움 글 둘', '2026-07-01'],
      ['155', '채움 글 셋', '2026-07-01'],
      ['156', '채움 글 넷', '2026-07-01'],
    ],
    postNos: ['152', '153', '154', '155', '156'],
    files: Object.fromEntries(
      ['2026-07-10', '2026-07-11', '2026-07-12', '2026-07-13', '2026-07-14', '2026-07-15'].map((date, index) => [
        date,
        topTable(
          ['순위', '게시글', '조회수'],
          padTop20Rows([
            ...(index < 3 ? [['1', '신규 노출 글', String(10 - index)]] : []),
            ['2', '채움 글 하나', '9'],
            ['3', '채움 글 둘', '8'],
            ['4', '채움 글 셋', '7'],
            ['5', '채움 글 넷', '6'],
            ['6', '채움 글 하나', '5'],
          ])
        ),
      ])
    ),
  });

  try {
    const post = postByNo(collect(fixture), '152');
    assert.strictEqual(post.observations.length, 3);
    assert.strictEqual(post.observed_days, 6);
    assert.strictEqual(post.verdict, 'faded');
  } finally {
    removeDir(fixture.dir);
  }
}

function testHoldsFadedVerdictWhenTop20CaptureCoverageIsInsufficient() {
  const fixture = writeFixture({
    registryRows: [['152', '관측 보류 글', '2026-07-01']],
    postNos: ['152'],
    files: Object.fromEntries(
      ['2026-07-01', '2026-07-02', '2026-07-03', '2026-07-04', '2026-07-05'].map((date, index) => [
        date,
        topTable(
          ['순위', '게시글', '조회수'],
          rankedRows(index < 3 ? 10 : 5)
        ),
      ])
    ),
  });

  try {
    const post = postByNo(collect(fixture), '152');
    assert.strictEqual(post.observed_days, 5);
    assert.strictEqual(post.verdict, 'insufficient_coverage');
    assert.match(post.verdict_reason, /관측창 유효일 0일\(수집행 합 10\), 커버리지 부족으로 실패 판정 보류/);
  } finally {
    removeDir(fixture.dir);
  }
}

function testKeepsLandedVerdictWhenTop20CaptureCoverageIsInsufficient() {
  assert.strictEqual(typeof verdictForPost, 'function');
  const verdict = verdictForPost({
    publishedAt: '2026-07-01',
    latestReportDate: '2026-07-05',
    observations: [
      { date: '2026-07-04', day: 3, rank: 1, views: 10 },
      { date: '2026-07-05', day: 4, rank: 1, views: 9 },
    ],
    validDates: new Set(['2026-07-01', '2026-07-02', '2026-07-03', '2026-07-04', '2026-07-05']),
    top20RowCounts: new Map([
      ['2026-07-01', 10],
      ['2026-07-02', 10],
      ['2026-07-03', 10],
      ['2026-07-04', 5],
      ['2026-07-05', 5],
    ]),
  });
  assert.strictEqual(verdict.verdict, 'landed');
}

function testKeepsNewPostPendingUntilThirdFullTop20Day() {
  assert.strictEqual(typeof verdictForPost, 'function');
  const verdict = verdictForPost({
    publishedAt: '2026-08-01',
    latestReportDate: '2026-08-05',
    observations: [],
    validDates: new Set(['2026-08-01', '2026-08-02', '2026-08-03', '2026-08-04', '2026-08-05']),
    top20RowCounts: new Map([
      ['2026-08-04', 20],
      ['2026-08-05', 20],
    ]),
  });
  assert.strictEqual(verdict.verdict, 'pending');
  assert.match(verdict.verdict_reason, /세 번째 유효 TOP20 관측일 대기/);
}

function testRecordsUnmappedTitlesInsteadOfGuessing() {
  const fixture = writeFixture({
    registryRows: [
      ['152', '등록된 글', '2026-07-05'],
      ['153', '채움 글 하나', '2026-07-01'],
      ['154', '채움 글 둘', '2026-07-01'],
      ['155', '채움 글 셋', '2026-07-01'],
      ['156', '채움 글 넷', '2026-07-01'],
    ],
    postNos: ['152', '153', '154', '155', '156'],
    files: {
      '2026-07-10': topTable(
        ['순위', '게시글', '조회수'],
        [
          ['1', '등록부에 없는 제목', '10'],
          ['2', '채움 글 하나', '9'],
          ['3', '채움 글 둘', '8'],
          ['4', '채움 글 셋', '7'],
          ['5', '채움 글 넷', '6'],
        ]
      ),
    },
  });

  try {
    const ledger = collect(fixture);
    assert.deepStrictEqual(ledger.unmapped_titles, [
      {
        title: '등록부에 없는 제목',
        dates: ['2026-07-10'],
        reason: '등록부에서 글번호를 찾지 못함',
      },
    ]);
  } finally {
    removeDir(fixture.dir);
  }
}

function testUsesPostNumberColumnBeforeTitleMapping() {
  const fixture = writeFixture({
    registryRows: [
      ['152', '등록부 제목과 다른 값', '2026-07-05'],
      ['153', '채움 글 하나', '2026-07-01'],
      ['154', '채움 글 둘', '2026-07-01'],
      ['155', '채움 글 셋', '2026-07-01'],
      ['156', '채움 글 넷', '2026-07-01'],
    ],
    postNos: ['152', '153', '154', '155', '156'],
    files: {
      '2026-07-10': topTable(
        ['순위', '글번호', '게시글', '조회수', '작성일'],
        [
          ['1', '152', '제목 매핑에 없는 실제 제목', '10', '7/5'],
          ['2', '153', '채움 글 하나', '9', '7/1'],
          ['3', '154', '채움 글 둘', '8', '7/1'],
          ['4', '155', '채움 글 셋', '7', '7/1'],
          ['5', '156', '채움 글 넷', '6', '7/1'],
        ]
      ),
    },
  });

  try {
    const ledger = collect(fixture);
    const post = postByNo(ledger, '152');
    assert.deepStrictEqual(post.observations, [
      { date: '2026-07-10', day: 5, rank: 1, views: 10 },
    ]);
    assert(!ledger.unmapped_titles.some((item) => item.title === '제목 매핑에 없는 실제 제목'));
  } finally {
    removeDir(fixture.dir);
  }
}

function testRecordsReviewReelsIdentifierFromPostNumberColumn() {
  const fixture = writeFixture({
    registryRows: [
      ['152', '채움 글 하나', '2026-07-01'],
      ['153', '채움 글 둘', '2026-07-01'],
      ['154', '채움 글 셋', '2026-07-01'],
      ['155', '채움 글 넷', '2026-07-01'],
    ],
    postNos: ['152', '153', '154', '155'],
    files: {
      '2026-07-10': topTable(
        ['순위', '글번호', '게시글', '조회수', '작성일'],
        [
          ['1', '리뷰릴스-005', '리뷰 제목이 바뀌어도 식별자로 기록', '10', '7/5'],
          ['2', '152', '채움 글 하나', '9', '7/1'],
          ['3', '153', '채움 글 둘', '8', '7/1'],
          ['4', '154', '채움 글 셋', '7', '7/1'],
          ['5', '155', '채움 글 넷', '6', '7/1'],
        ]
      ),
    },
  });

  try {
    const review = postByNo(collect(fixture), '리뷰릴스-005');
    assert.deepStrictEqual(review.observations, [
      { date: '2026-07-10', day: 5, rank: 1, views: 10 },
    ]);
  } finally {
    removeDir(fixture.dir);
  }
}

function testFallsBackToTitleMappingWhenPostNumberIsDash() {
  const fixture = writeFixture({
    registryRows: [
      ['152', '제목으로 연결할 글', '2026-07-05'],
      ['153', '채움 글 하나', '2026-07-01'],
      ['154', '채움 글 둘', '2026-07-01'],
      ['155', '채움 글 셋', '2026-07-01'],
      ['156', '채움 글 넷', '2026-07-01'],
    ],
    postNos: ['152', '153', '154', '155', '156'],
    files: {
      '2026-07-10': topTable(
        ['순위', '글번호', '게시글', '조회수', '작성일'],
        [
          ['1', '-', '제목으로 연결할 글', '10', '7/5'],
          ['2', '153', '채움 글 하나', '9', '7/1'],
          ['3', '154', '채움 글 둘', '8', '7/1'],
          ['4', '155', '채움 글 셋', '7', '7/1'],
          ['5', '156', '채움 글 넷', '6', '7/1'],
        ]
      ),
    },
  });

  try {
    const post = postByNo(collect(fixture), '152');
    assert.deepStrictEqual(post.observations, [
      { date: '2026-07-10', day: 5, rank: 1, views: 10 },
    ]);
  } finally {
    removeDir(fixture.dir);
  }
}

function testParsesAllObservedTop20HeadingForms() {
  const headings = [
    '## 게시글 TOP20',
    '## 4. 게시글 TOP20',
    '## 4. 게시글 TOP 20',
    '## 3. 게시글 TOP 20',
    '## 3. 게시글 TOP 20 관찰',
    '## 5. 게시글 TOP20',
  ];
  const files = Object.fromEntries(headings.map((heading, index) => {
    const date = `2026-07-${String(index + 1).padStart(2, '0')}`;
    return [date, topTable(
      ['순위', '게시글', '조회수'],
      [
        ['1', '헤딩 회수 대상 글', String(20 - index)],
        ['2', '채움 글 하나', '9'],
        ['3', '채움 글 둘', '8'],
        ['4', '채움 글 셋', '7'],
        ['5', '채움 글 넷', '6'],
      ],
      heading
    )];
  }));
  const fixture = writeFixture({
    registryRows: [
      ['152', '헤딩 회수 대상 글', '2026-07-01'],
      ['153', '채움 글 하나', '2026-07-01'],
      ['154', '채움 글 둘', '2026-07-01'],
      ['155', '채움 글 셋', '2026-07-01'],
      ['156', '채움 글 넷', '2026-07-01'],
    ],
    postNos: ['152', '153', '154', '155', '156'],
    files,
  });

  try {
    const post = postByNo(collect(fixture), '152');
    assert.strictEqual(post.observations.length, headings.length);
  } finally {
    removeDir(fixture.dir);
  }
}

function testMapsOnlyExplicitRegistryTitleAliases() {
  const fixture = writeFixture({
    registryRows: [
      ['152', '정본 제목', '2026-07-01'],
      ['153', '채움 글 하나', '2026-07-01'],
      ['154', '채움 글 둘', '2026-07-01'],
      ['155', '채움 글 셋', '2026-07-01'],
      ['156', '채움 글 넷', '2026-07-01'],
    ],
    titleAliases: [{
      post_no: '152',
      titles: ['리포트에 옮겨 적힌 확인 별칭'],
      evidence: 'daily 표기 흔들림 직접 대조',
    }],
    postNos: ['152', '153', '154', '155', '156'],
    files: {
      '2026-07-10': topTable(
        ['순위', '게시글', '조회수'],
        [
          ['1', '리포트에 옮겨 적힌 확인 별칭', '10'],
          ['2', '채움 글 하나', '9'],
          ['3', '채움 글 둘', '8'],
          ['4', '채움 글 셋', '7'],
          ['5', '채움 글 넷', '6'],
        ]
      ),
    },
  });

  try {
    const ledger = collect(fixture);
    assert.strictEqual(postByNo(ledger, '152').observations.length, 1);
    assert(!ledger.unmapped_titles.some((item) => item.title === '리포트에 옮겨 적힌 확인 별칭'));
  } finally {
    removeDir(fixture.dir);
  }
}

function testBlocksConflictingRegistryAliases() {
  const fixture = writeFixture({
    registryRows: [
      ['152', '정본 제목 하나', '2026-07-01'],
      ['153', '정본 제목 둘', '2026-07-01'],
      ['154', '채움 글 하나', '2026-07-01'],
      ['155', '채움 글 둘', '2026-07-01'],
      ['156', '채움 글 셋', '2026-07-01'],
      ['157', '채움 글 넷', '2026-07-01'],
    ],
    titleAliases: [
      { post_no: '152', titles: ['충돌 별칭'], evidence: 'fixture' },
      { post_no: '153', titles: ['충돌 별칭'], evidence: 'fixture' },
    ],
    postNos: ['152', '153', '154', '155', '156', '157'],
    files: {
      '2026-07-10': topTable(
        ['순위', '게시글', '조회수'],
        [
          ['1', '충돌 별칭', '10'],
          ['2', '채움 글 하나', '9'],
          ['3', '채움 글 둘', '8'],
          ['4', '채움 글 셋', '7'],
          ['5', '채움 글 넷', '6'],
        ]
      ),
    },
  });

  try {
    assert.throws(
      () => collect(fixture),
      /title_aliases conflict.*충돌 별칭/
    );
  } finally {
    removeDir(fixture.dir);
  }
}

function testIncludesRegistryPostsWithoutTop20Appearances() {
  const fixture = writeFixture({
    registryRows: [
      ['152', '채움 글 하나', '2026-07-01'],
      ['154', '채움 글 둘', '2026-07-01'],
      ['155', '채움 글 셋', '2026-07-01'],
      ['156', '채움 글 넷', '2026-07-01'],
      ['157', '채움 글 다섯', '2026-07-01'],
    ],
    registryBlocks: [
      {
        type: 'table',
        header: ['#', '파일', '발행상태', '발행일', 'URL'],
        rows: [['153', '153_미등장.md', '발행완료', '2026-07-01', '-']],
      },
      {
        type: 'table',
        header: ['#', '파일', '원고상태', '발행상태', '운영상태', '메모'],
        rows: [['159', '159_폐기.md', '폐기', '미발행', '폐기', '폐기 결정']],
      },
    ],
    postNos: ['152', '153', '154', '155', '156', '157', '159'],
    files: Object.fromEntries(
      ['2026-07-04', '2026-07-05', '2026-07-06', '2026-07-07', '2026-07-08'].map((date) => [
        date,
        topTable(
          ['순위', '게시글', '조회수'],
          padTop20Rows([
            ['1', '채움 글 하나', '10'],
            ['2', '채움 글 둘', '9'],
            ['3', '채움 글 셋', '8'],
            ['4', '채움 글 넷', '7'],
            ['5', '채움 글 다섯', '6'],
          ])
        ),
      ])
    ),
  });

  try {
    const ledger = collect(fixture);
    const unseen = postByNo(ledger, '153');
    const retired = postByNo(ledger, '159');

    assert.deepStrictEqual(unseen.observations, []);
    assert.strictEqual(unseen.verdict, 'faded');
    assert.strictEqual(retired.published_at, null);
    assert.strictEqual(retired.verdict, 'unobserved');
    assert.match(retired.verdict_reason, /발행일 미상.*폐기/);
  } finally {
    removeDir(fixture.dir);
  }
}

function testMapsMemoPublishedTitleAlias() {
  const fixture = writeFixture({
    registryRows: [
      ['152', '내부 관리 제목', '2026-07-05'],
      ['153', '채움 글 하나', '2026-07-01'],
      ['154', '채움 글 둘', '2026-07-01'],
      ['155', '채움 글 셋', '2026-07-01'],
      ['156', '채움 글 넷', '2026-07-01'],
    ],
    registryBlocks: [
      {
        type: 'table',
        header: ['#', '파일', '원고상태', '발행상태', '운영상태', '메모'],
        rows: [[
          '152',
          '152_내부관리제목.md',
          '검수완료',
          '발행완료',
          '현장형',
          '[URL](https://example.test/152) 등록. 발행 제목: 실제 발행 제목. 이후 설명',
        ]],
      },
    ],
    postNos: ['152', '153', '154', '155', '156'],
    files: {
      '2026-07-10': topTable(
        ['순위', '게시글', '조회수'],
        [
          ['1', '실제 발행 제목', '10'],
          ['2', '채움 글 하나', '9'],
          ['3', '채움 글 둘', '8'],
          ['4', '채움 글 셋', '7'],
          ['5', '채움 글 넷', '6'],
        ]
      ),
    },
  });

  try {
    const ledger = collect(fixture);
    const post = postByNo(ledger, '152');
    assert.deepStrictEqual(post.observations, [
      { date: '2026-07-10', day: 5, rank: 1, views: 10 },
    ]);
    assert(!ledger.unmapped_titles.some((item) => item.title === '실제 발행 제목'));
  } finally {
    removeDir(fixture.dir);
  }
}

function testMapsConfirmedTitleHistoryAlias() {
  const fixture = writeFixture({
    registryRows: [
      ['086', '평수별 아파트 중문 설치 비용 확인할 3가지 기준', '2026-06-23'],
      ['152', '채움 글 하나', '2026-06-01'],
      ['153', '채움 글 둘', '2026-06-01'],
      ['154', '채움 글 셋', '2026-06-01'],
      ['155', '채움 글 넷', '2026-06-01'],
    ],
    titleAliases: [{
      post_no: '086',
      titles: ['평수별 중문 설치 비용 확인할 3가지 기준'],
      evidence: '사용자 확인 발행 제목 이력',
    }],
    postNos: ['086', '152', '153', '154', '155'],
    files: {
      '2026-07-10': topTable(
        ['순위', '게시글', '조회수'],
        [
          ['1', '평수별 중문 설치 비용 확인할 3가지 기준', '10'],
          ['2', '채움 글 하나', '9'],
          ['3', '채움 글 둘', '8'],
          ['4', '채움 글 셋', '7'],
          ['5', '채움 글 넷', '6'],
        ]
      ),
    },
  });

  try {
    const ledger = collect(fixture);
    assert.strictEqual(postByNo(ledger, '086').observations.length, 1);
    assert(!ledger.unmapped_titles.some((item) => item.title === '평수별 중문 설치 비용 확인할 3가지 기준'));
  } finally {
    removeDir(fixture.dir);
  }
}

function testUsesEarliestDailyWrittenDateWhenRegistryDateIsMissing() {
  const fixture = writeFixture({
    registryRows: [
      ['152', 'daily 작성일 보정 글', ''],
      ['153', '채움 글 하나', '2026-07-01'],
      ['154', '채움 글 둘', '2026-07-01'],
      ['155', '채움 글 셋', '2026-07-01'],
      ['156', '채움 글 넷', '2026-07-01'],
    ],
    postNos: ['152', '153', '154', '155', '156'],
    files: {
      '2026-07-10': topTable(
        ['순위', '게시글', '조회수', '작성일'],
        [
          ['1', 'daily 작성일 보정 글', '10', '7/5'],
          ['2', '채움 글 하나', '9', '7/1'],
          ['3', '채움 글 둘', '8', '7/1'],
          ['4', '채움 글 셋', '7', '7/1'],
          ['5', '채움 글 넷', '6', '7/1'],
        ]
      ),
      '2026-07-11': topTable(
        ['순위', '게시글', '조회수', '작성일'],
        [
          ['1', 'daily 작성일 보정 글', '11', '7/5'],
          ['2', '채움 글 하나', '9', '7/1'],
          ['3', '채움 글 둘', '8', '7/1'],
          ['4', '채움 글 셋', '7', '7/1'],
          ['5', '채움 글 넷', '6', '7/1'],
        ]
      ),
    },
  });

  try {
    const post = postByNo(collect(fixture), '152');
    assert.strictEqual(post.published_at, '2026-07-05');
    assert.strictEqual(post.published_at_source, 'daily');
    assert.deepStrictEqual(post.observations, [
      { date: '2026-07-10', day: 5, rank: 1, views: 10 },
      { date: '2026-07-11', day: 6, rank: 1, views: 11 },
    ]);
    assert.strictEqual(post.verdict, 'landed');
  } finally {
    removeDir(fixture.dir);
  }
}

function testPreservesObservationsWhenPublishedDateIsUnknown() {
  const fixture = writeFixture({
    registryRows: [
      ['152', '작성일 없는 관측 글', ''],
      ['153', '채움 글 하나', '2026-07-01'],
      ['154', '채움 글 둘', '2026-07-01'],
      ['155', '채움 글 셋', '2026-07-01'],
      ['156', '채움 글 넷', '2026-07-01'],
    ],
    postNos: ['152', '153', '154', '155', '156'],
    files: {
      '2026-07-10': topTable(
        ['순위', '게시글', '조회수'],
        [
          ['1', '작성일 없는 관측 글', '10'],
          ['2', '채움 글 하나', '9'],
          ['3', '채움 글 둘', '8'],
          ['4', '채움 글 셋', '7'],
          ['5', '채움 글 넷', '6'],
        ]
      ),
      '2026-07-11': topTable(
        ['순위', '게시글', '조회수'],
        [
          ['1', '작성일 없는 관측 글', '11'],
          ['2', '채움 글 하나', '9'],
          ['3', '채움 글 둘', '8'],
          ['4', '채움 글 셋', '7'],
          ['5', '채움 글 넷', '6'],
        ]
      ),
    },
  });

  try {
    const post = postByNo(collect(fixture), '152');
    assert.strictEqual(post.published_at, null);
    assert.strictEqual(post.published_at_source, 'unknown');
    assert.deepStrictEqual(post.observations, [
      { date: '2026-07-10', day: null, rank: 1, views: 10 },
      { date: '2026-07-11', day: null, rank: 1, views: 11 },
    ]);
    assert.strictEqual(post.verdict, 'unobserved');
  } finally {
    removeDir(fixture.dir);
  }
}

function testReportsClusterWinRatesAndFadedStreakWarnings() {
  assert.strictEqual(
    typeof renderPerformanceReport,
    'function',
    'report_post_performance.js must export renderPerformanceReport'
  );

  const report = renderPerformanceReport({
    updated_at: '2026-07-27',
    posts: [
      { post_no: '152', published_at: '2026-07-10', cluster_ids: ['C-ONE'], verdict: 'faded' },
      { post_no: '153', published_at: '2026-07-11', cluster_ids: ['C-ONE'], verdict: 'faded' },
      { post_no: '154', published_at: '2026-07-12', cluster_ids: ['C-ONE'], verdict: 'faded' },
      { post_no: '155', published_at: '2026-07-13', cluster_ids: ['C-ONE'], verdict: 'unobserved' },
      { post_no: '156', published_at: '2026-07-14', cluster_ids: ['C-TWO'], verdict: 'landed' },
      { post_no: '157', published_at: '2026-07-15', cluster_ids: ['C-TWO'], verdict: 'faded' },
      { post_no: '158', published_at: '2026-07-16', cluster_ids: ['C-ONE'], verdict: 'insufficient_coverage' },
    ],
  });

  assert.match(report, /\| C-ONE \| 0 \| 3 \| 1 \| 1 \| 0\.0% \| 3 \| WARN \|/);
  assert.match(report, /\| C-TWO \| 1 \| 1 \| 0 \| 0 \| 50\.0% \| 1 \| 정상 \|/);
  assert.match(report, /WARN: C-ONE 같은 클러스터에서 faded 3연속/);
}

function fadedPosts(clusterId, count, prefix) {
  const posts = [];
  for (let i = 1; i <= count; i += 1) {
    posts.push({
      post_no: prefix + i,
      verdict: 'faded',
      cluster_ids: [clusterId],
      published_at: '2026-07-0' + i,
    });
  }
  return posts;
}

// faded 5연속은 문자열 경고로 끝나면 안 된다. 종료 코드로 막아야 한다.
function testRedesignClusterBlocks() {
  const { redesignClusters } = require('../scripts/report_post_performance');
  const blocked = redesignClusters({ posts: fadedPosts('C-TEST-BLOCK', 5, '9') });
  assert.strictEqual(blocked.length, 1, JSON.stringify(blocked));
  assert.strictEqual(blocked[0].cluster_id, 'C-TEST-BLOCK');
  assert.strictEqual(blocked[0].faded_streak, 5);
}

// 3연속은 WARN 이므로 막지 않는다.
function testThreeStreakDoesNotBlock() {
  const { redesignClusters } = require('../scripts/report_post_performance');
  assert.strictEqual(redesignClusters({ posts: fadedPosts('C-TEST-WARN', 3, '8') }).length, 0);
}

function main() {
  testParsesHeaderOrderedTablesByColumnName();
  testMarksFewerThanFiveValidDaysUnobserved();
  testExcludesDaysZeroThroughTwoFromVerdict();
  testHoldsFadedVerdictWhenTop20CaptureCoverageIsInsufficient();
  testKeepsLandedVerdictWhenTop20CaptureCoverageIsInsufficient();
  testKeepsNewPostPendingUntilThirdFullTop20Day();
  testRecordsUnmappedTitlesInsteadOfGuessing();
  testUsesPostNumberColumnBeforeTitleMapping();
  testRecordsReviewReelsIdentifierFromPostNumberColumn();
  testFallsBackToTitleMappingWhenPostNumberIsDash();
  testParsesAllObservedTop20HeadingForms();
  testMapsOnlyExplicitRegistryTitleAliases();
  testBlocksConflictingRegistryAliases();
  testIncludesRegistryPostsWithoutTop20Appearances();
  testMapsMemoPublishedTitleAlias();
  testMapsConfirmedTitleHistoryAlias();
  testUsesEarliestDailyWrittenDateWhenRegistryDateIsMissing();
  testPreservesObservationsWhenPublishedDateIsUnknown();
  testReportsClusterWinRatesAndFadedStreakWarnings();
  testRedesignClusterBlocks();
  testThreeStreakDoesNotBlock();
  console.log('post performance tests passed');
}

main();
