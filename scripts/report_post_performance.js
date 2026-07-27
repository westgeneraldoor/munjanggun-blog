const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const DEFAULT_LEDGER_PATH = path.join(ROOT_DIR, 'data', 'performance', 'post_performance.json');
const DEFAULT_REPORT_PATH = path.join(ROOT_DIR, 'outputs', 'reports', 'performance_report.md');

function clusterRows(posts) {
  const clusters = new Map();

  posts.forEach((post) => {
    (post.cluster_ids || []).forEach((clusterId) => {
      const cluster = clusters.get(clusterId) || {
        cluster_id: clusterId,
        landed: 0,
        faded: 0,
        unobserved: 0,
        posts: [],
      };
      if (post.verdict === 'landed') cluster.landed += 1;
      if (post.verdict === 'faded') cluster.faded += 1;
      if (post.verdict === 'unobserved') cluster.unobserved += 1;
      cluster.posts.push(post);
      clusters.set(clusterId, cluster);
    });
  });

  return [...clusters.values()]
    .map((cluster) => {
      const performancePosts = cluster.posts
        .filter((post) => post.verdict === 'landed' || post.verdict === 'faded')
        .sort((left, right) => {
          const dateOrder = String(left.published_at || '').localeCompare(String(right.published_at || ''));
          return dateOrder || String(left.post_no || '').localeCompare(String(right.post_no || ''), 'en', { numeric: true });
        });
      let fadedStreak = 0;
      for (let index = performancePosts.length - 1; index >= 0; index -= 1) {
        if (performancePosts[index].verdict !== 'faded') break;
        fadedStreak += 1;
      }
      const denominator = cluster.landed + cluster.faded;
      const winRate = denominator === 0 ? '-' : `${((cluster.landed / denominator) * 100).toFixed(1)}%`;
      const status = fadedStreak >= 5 ? 'FAIL' : fadedStreak >= 3 ? 'WARN' : '정상';
      return {
        ...cluster,
        faded_streak: fadedStreak,
        win_rate: winRate,
        status,
      };
    })
    .sort((left, right) => left.cluster_id.localeCompare(right.cluster_id, 'en'));
}

function renderPerformanceReport(ledger) {
  const rows = clusterRows(ledger.posts || []);
  const lines = [
    '# 게시글 성과 클러스터 보고',
    '',
    `> 원장 기준일: ${ledger.updated_at || '-'}`,
    '> 승률 = landed / (landed + faded). unobserved는 분자와 분모에서 제외한다.',
    '',
    '| 클러스터 | landed | faded | unobserved | 승률 | faded 연속 | 상태 |',
    '| --- | ---: | ---: | ---: | ---: | ---: | --- |',
  ];

  if (rows.length === 0) {
    lines.push('| 분류된 클러스터 없음 | 0 | 0 | 0 | - | 0 | 정상 |');
  } else {
    rows.forEach((row) => {
      lines.push(`| ${row.cluster_id} | ${row.landed} | ${row.faded} | ${row.unobserved} | ${row.win_rate} | ${row.faded_streak} | ${row.status} |`);
    });
  }

  const warnings = rows.filter((row) => row.status !== '정상');
  if (warnings.length > 0) {
    lines.push('', '## 경고');
    warnings.forEach((row) => {
      if (row.status === 'FAIL') {
        lines.push(`FAIL: ${row.cluster_id} 같은 클러스터에서 faded 5연속 — 신규 발행을 멈추고 전술을 재설계한다.`);
      } else {
        lines.push(`WARN: ${row.cluster_id} 같은 클러스터에서 faded 3연속 — 다음 scorecard 신규 후보는 분리 각도를 밝혀야 한다.`);
      }
    });
  }

  return `${lines.join('\n')}\n`;
}

function parseArgs(argv) {
  return { writeReport: argv.includes('--write-report') };
}

function writeReport(content, reportPath = DEFAULT_REPORT_PATH) {
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, content, 'utf8');
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const ledger = JSON.parse(fs.readFileSync(DEFAULT_LEDGER_PATH, 'utf8'));
  const report = renderPerformanceReport(ledger);
  if (options.writeReport) writeReport(report);
  process.stdout.write(report);
  if (options.writeReport) console.log(`written: ${DEFAULT_REPORT_PATH}`);
}

if (require.main === module) main();

module.exports = {
  clusterRows,
  renderPerformanceReport,
  writeReport,
};
