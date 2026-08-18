const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const DEFAULT_LEDGER_PATH = path.join(ROOT_DIR, 'data', 'performance', 'post_performance.json');
const REWRITE_COHORT_POST_NOS = Array.from({ length: 12 }, (_, index) => String(180 + index));
const DAY_MS = 24 * 60 * 60 * 1000;

function addDays(dateText, count) {
  const value = Date.parse(`${dateText}T00:00:00Z`);
  if (!Number.isFinite(value)) throw new Error(`invalid publication date: ${dateText}`);
  return new Date(value + count * DAY_MS).toISOString().slice(0, 10);
}

function buildRewriteCohortRows(ledger) {
  const asOf = String((ledger || {}).updated_at || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(asOf)) throw new Error('missing performance data date');
  const posts = Array.isArray(ledger.posts) ? ledger.posts : [];

  return REWRITE_COHORT_POST_NOS.map((postNo) => {
    const post = posts.find((item) => item && item.post_no === postNo);
    if (!post) throw new Error(`missing rewrite cohort post: ${postNo}`);
    const publishedAt = String(post.published_at || '');
    const d14 = addDays(publishedAt, 14);
    const observations = Array.isArray(post.observations) ? post.observations : [];

    return {
      post_no: postNo,
      published_at: publishedAt,
      d14,
      window_closed: asOf >= d14,
      window_appearances: observations.filter((item) => (
        Number.isInteger(item.day) && item.day >= 3 && item.day <= 14
      )).length,
    };
  });
}

function renderRewriteCohortProgress(rows, asOf) {
  const lines = [
    '# 리라이팅 코호트 중간 기록',
    '',
    `> 데이터 기준일: ${asOf}`,
    '> 모수: 180~191번 12건. D3~D14 TOP20 실제 등장만 집계.',
    '',
    '| 글번호 | 발행일 | D14 | 창 마감 | D3~D14 TOP20 등장 |',
    '| --- | --- | --- | --- | ---: |',
  ];

  rows.forEach((row) => {
    lines.push(`| ${row.post_no} | ${row.published_at} | ${row.d14} | ${row.window_closed ? '완료' : '진행 중'} | ${row.window_appearances} |`);
  });
  return `${lines.join('\n')}\n`;
}

function main() {
  const ledger = JSON.parse(fs.readFileSync(DEFAULT_LEDGER_PATH, 'utf8'));
  const rows = buildRewriteCohortRows(ledger);
  process.stdout.write(renderRewriteCohortProgress(rows, ledger.updated_at));
}

if (require.main === module) main();

module.exports = {
  REWRITE_COHORT_POST_NOS,
  buildRewriteCohortRows,
  renderRewriteCohortProgress,
};
