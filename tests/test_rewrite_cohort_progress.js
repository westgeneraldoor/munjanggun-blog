const assert = require('assert');

let buildRewriteCohortRows;
let renderRewriteCohortProgress;
try {
  ({
    buildRewriteCohortRows,
    renderRewriteCohortProgress,
  } = require('../scripts/report_rewrite_cohort_progress'));
} catch (_error) {
  buildRewriteCohortRows = undefined;
  renderRewriteCohortProgress = undefined;
}

assert.strictEqual(
  typeof buildRewriteCohortRows,
  'function',
  'report_rewrite_cohort_progress.js must export buildRewriteCohortRows'
);
assert.strictEqual(
  typeof renderRewriteCohortProgress,
  'function',
  'report_rewrite_cohort_progress.js must export renderRewriteCohortProgress'
);

function post(postNo, publishedAt, observations, verdict) {
  return {
    post_no: postNo,
    published_at: publishedAt,
    observations,
    verdict,
  };
}

function completeFixture() {
  const posts = [];
  for (let value = 180; value <= 191; value += 1) {
    posts.push(post(String(value), `2026-08-${String(value - 174).padStart(2, '0')}`, [], 'faded'));
  }
  posts[0] = post('180', '2026-08-06', [
    { day: 2, date: '2026-08-08' },
    { day: 3, date: '2026-08-09' },
    { day: 14, date: '2026-08-20' },
    { day: 15, date: '2026-08-21' },
  ], 'landed');
  posts[1] = post('181', '2026-08-07', [
    { day: 4, date: '2026-08-11' },
  ], 'faded');
  return { updated_at: '2026-08-20', posts };
}

function testCountsOnlyD3ThroughD14AndReportsWindowClosure() {
  const rows = buildRewriteCohortRows(completeFixture());

  assert.deepStrictEqual(rows.slice(0, 2), [
    {
      post_no: '180',
      published_at: '2026-08-06',
      d14: '2026-08-20',
      window_closed: true,
      window_appearances: 2,
    },
    {
      post_no: '181',
      published_at: '2026-08-07',
      d14: '2026-08-21',
      window_closed: false,
      window_appearances: 1,
    },
  ]);
}

function testOutputDoesNotTurnProgressIntoAVerdict() {
  const rows = buildRewriteCohortRows(completeFixture());
  const output = renderRewriteCohortProgress(rows, '2026-08-20');

  assert.match(output, /\| 180 \| 2026-08-06 \| 2026-08-20 \| 완료 \| 2 \|/);
  assert.match(output, /\| 181 \| 2026-08-07 \| 2026-08-21 \| 진행 중 \| 1 \|/);
  assert.doesNotMatch(output, /landed|faded|회복|실패|판정/i);
}

function testMissingCohortPostFailsInsteadOfChangingTheDenominator() {
  const fixture = completeFixture();
  fixture.posts = fixture.posts.filter((item) => item.post_no !== '191');

  assert.throws(
    () => buildRewriteCohortRows(fixture),
    /missing rewrite cohort post: 191/
  );
}

testCountsOnlyD3ThroughD14AndReportsWindowClosure();
testOutputDoesNotTurnProgressIntoAVerdict();
testMissingCohortPostFailsInsteadOfChangingTheDenominator();

console.log('rewrite cohort progress tests passed');
