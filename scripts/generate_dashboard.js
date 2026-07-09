const fs = require('fs');
const path = require('path');
const { paths } = require('./lib/paths');
const { readJsonFile, writeTextFile } = require('./lib/file_store');

const HISTORY_FILE = paths.dataProcessed('tracking_history.json');
const HTML_FILE = paths.outputDashboard('ranking_dashboard.html');
const CHART_VENDOR_FILE = paths.outputDashboard(path.join('vendor', 'chart.umd.js'));
const CHART_SCRIPT_SRC = 'vendor/chart.umd.js';

function trackingKey(item) {
  return item.trackingId || item.keyword;
}

function rankValue(rank) {
  return rank > 0 ? rank : 31;
}

function rankLabel(rank) {
  return rank > 0 ? `${rank}위` : 'OUT';
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function analyzeKeyword(keyword, hub) {
  let tier = 'B';
  let tierLabel = '일반/롱테일';

  const sTierKeywords = ['중문', '3연동중문', '현관중문', '방문교체', 'ABS도어', '아파트중문'];
  if (sTierKeywords.includes(keyword)) {
    tier = 'S';
    tierLabel = '핵심 추적';
  } else if (keyword.includes('비용') || keyword.includes('가격') || keyword.includes('견적') || keyword.includes('설치')) {
    tier = 'A';
    tierLabel = '구매 전환';
  }

  let group = '기타';
  if (keyword.includes('3연동') || keyword.includes('슬라이딩') || keyword.includes('스윙') || keyword.includes('연동')) {
    group = '3연동/특수';
  } else if (keyword.includes('방문') || keyword.includes('도어') || keyword.includes('문짝') || keyword.includes('문틀')) {
    group = '방문/도어';
  } else if (keyword.includes('중문') || keyword.includes('현관') || hub.includes('중문')) {
    group = '현관/아파트중문';
  }

  return { tier, tierLabel, group };
}

function findChartVendorSource() {
  const chartEntry = require.resolve('chart.js');
  const chartDir = path.dirname(chartEntry);
  const candidates = [
    path.join(chartDir, 'chart.umd.js'),
    path.join(chartDir, 'chart.umd.min.js'),
  ];
  const source = candidates.find((candidate) => fs.existsSync(candidate));
  if (!source) {
    throw new Error(`Chart.js UMD bundle not found near ${chartEntry}`);
  }
  return source;
}

function ensureChartVendor() {
  const source = findChartVendorSource();
  fs.mkdirSync(path.dirname(CHART_VENDOR_FILE), { recursive: true });
  fs.copyFileSync(source, CHART_VENDOR_FILE);
}

function buildDashboardData(records) {
  const latest = records[records.length - 1];
  const previous = records.length > 1 ? records[records.length - 2] : null;
  const latestRankings = latest.rankings || [];
  const previousByKey = new Map((previous?.rankings || []).map((item) => [trackingKey(item), item]));

  const labels = records.map((record) => {
    const d = new Date(record.timestamp);
    return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${d.getMinutes().toString().padStart(2, '0')}`;
  });

  const tierScores = {
    S: records.map(() => []),
    A: records.map(() => []),
    B: records.map(() => []),
  };
  const tableData = [];
  const datasets = [];
  const coreStats = {};
  const coreKeywords = ['현관중문', '아파트중문', '3연동중문', '방문교체', 'ABS도어'];

  latestRankings.forEach((item, index) => {
    const key = trackingKey(item);
    const { tier, tierLabel, group } = analyzeKeyword(item.keyword, item.hub || '');
    const trend = records.map((record, recordIndex) => {
      const found = (record.rankings || []).find((candidate) => trackingKey(candidate) === key);
      if (!found) return null;
      const value = rankValue(found.rank);
      tierScores[tier][recordIndex].push(value);
      return value;
    });

    const previousItem = previousByKey.get(key);
    const diff = previousItem ? rankValue(previousItem.rank) - rankValue(item.rank) : 0;
    const isCore = coreKeywords.includes(item.keyword);
    if (isCore && !coreStats[item.keyword]) {
      coreStats[item.keyword] = { rank: rankValue(item.rank), diff };
    }

    const color = tier === 'S' ? '#dc2626' : tier === 'A' ? '#2563eb' : '#059669';
    const datasetLabel = item.postNo ? `${item.keyword} (${item.postNo})` : item.keyword;

    tableData.push({
      id: index,
      key,
      hub: item.hub || '-',
      keyword: item.keyword,
      postNo: item.postNo || '',
      postUrl: item.postUrl || '',
      rank: rankValue(item.rank),
      accountRank: item.accountRank || 0,
      matchType: item.matchType || '',
      diff,
      tier,
      tierLabel,
      group,
    });

    datasets.push({
      label: datasetLabel,
      data: trend,
      borderColor: color,
      backgroundColor: color,
      borderWidth: tier === 'S' ? 4 : tier === 'A' ? 2 : 1,
      hidden: tier !== 'S',
      tension: 0.3,
      pointRadius: tier === 'S' ? 5 : 3,
      pointHoverRadius: 7,
      _tier: tier,
      _group: group,
      _isAvg: false,
    });
  });

  const avgColors = { S: '#b91c1c', A: '#1d4ed8', B: '#047857' };
  ['S', 'A', 'B'].forEach((tier) => {
    const avgData = tierScores[tier].map((scores) => {
      if (scores.length === 0) return null;
      const sum = scores.reduce((a, b) => a + b, 0);
      return Number((sum / scores.length).toFixed(1));
    });

    datasets.push({
      label: `${tier} 등급 평균`,
      data: avgData,
      borderColor: avgColors[tier],
      backgroundColor: avgColors[tier],
      borderWidth: 5,
      borderDash: [8, 4],
      hidden: true,
      tension: 0.2,
      pointRadius: 6,
      _tier: tier,
      _group: '평균',
      _isAvg: true,
    });
  });

  tableData.sort((a, b) => {
    const tierScore = { S: 0, A: 1, B: 2 };
    if (tierScore[a.tier] !== tierScore[b.tier]) return tierScore[a.tier] - tierScore[b.tier];
    return a.rank - b.rank;
  });

  return { labels, tableData, datasets, coreStats };
}

function renderCoreStat(coreStats, keyword) {
  const stat = coreStats[keyword] || { rank: 31, diff: 0 };
  let diff = '<span class="diff-none">-</span>';
  if (stat.diff > 0) diff = `<span class="diff-up">▲${stat.diff}</span>`;
  if (stat.diff < 0) diff = `<span class="diff-down">▼${Math.abs(stat.diff)}</span>`;

  return `
    <div class="core-card">
      <div class="core-title">${escapeHtml(keyword)}</div>
      <div class="core-value">${escapeHtml(rankLabel(stat.rank === 31 ? 0 : stat.rank))}</div>
      <div class="core-diff">${diff}</div>
    </div>
  `;
}

function renderPostLink(row) {
  if (!row.postUrl) return '';
  const label = row.postNo ? `#${row.postNo}` : 'URL';
  return `<a href="${escapeHtml(row.postUrl)}" target="_blank" rel="noreferrer">${escapeHtml(label)}</a>`;
}

function renderDiff(row) {
  if (row.diff > 0) return `<span class="diff-up">▲${row.diff}</span>`;
  if (row.diff < 0) return `<span class="diff-down">▼${Math.abs(row.diff)}</span>`;
  return '<span class="diff-none">-</span>';
}

function generateDashboard() {
  if (!fs.existsSync(HISTORY_FILE)) {
    console.error('tracking_history.json 파일이 없습니다.');
    return;
  }

  ensureChartVendor();

  const data = readJsonFile(HISTORY_FILE, { version: 4, records: [] });
  const records = data.records || [];
  if (records.length === 0) return;

  const { labels, tableData, datasets, coreStats } = buildDashboardData(records);

  const htmlContent = `
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <title>문장군 URL 순위 대시보드</title>
  <script src="${CHART_SCRIPT_SRC}"></script>
  <style>
    body { font-family: Pretendard, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f8fafc; color: #334155; margin: 0; padding: 20px; }
    .header { margin-bottom: 20px; display: flex; justify-content: space-between; align-items: flex-end; gap: 12px; }
    h1 { margin: 0; color: #0f172a; font-size: 24px; }
    .subtitle { color: #64748b; font-size: 13px; margin-top: 6px; }
    .core-metrics { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 12px; margin-bottom: 20px; }
    .core-card { background: #111827; color: white; padding: 15px 18px; border-radius: 8px; text-align: center; box-shadow: 0 4px 10px rgba(15, 23, 42, 0.12); }
    .core-title { font-size: 13px; color: #cbd5e1; margin-bottom: 5px; }
    .core-value { font-size: 26px; font-weight: 800; color: #fff; }
    .core-diff { font-size: 13px; margin-top: 5px; }
    .grid { display: grid; grid-template-columns: minmax(0, 1fr) 540px; gap: 20px; align-items: start; }
    .panel { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 1px 3px rgba(15, 23, 42, 0.08); }
    .chart-wrapper { height: 520px; width: 100%; margin-top: 15px; }
    .filter-group { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 10px; padding-bottom: 10px; border-bottom: 1px dashed #e2e8f0; }
    .filter-label { font-size: 12px; font-weight: 700; color: #64748b; width: 100%; margin-bottom: 2px; }
    button { padding: 6px 14px; border: 1px solid #cbd5e1; background: white; border-radius: 6px; cursor: pointer; font-size: 12px; font-weight: 600; color: #475569; transition: all 0.2s; }
    button:hover { background: #f1f5f9; }
    button.active-s { background: #fee2e2; color: #991b1b; border-color: #fca5a5; }
    button.active-a { background: #dbeafe; color: #1d4ed8; border-color: #93c5fd; }
    button.active-b { background: #dcfce7; color: #166534; border-color: #86efac; }
    button.active-grp { background: #f1f5f9; color: #0f172a; border-color: #94a3b8; }
    button.active-avg { background: #312e81; color: white; border-color: #312e81; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th, td { padding: 10px 8px; text-align: left; border-bottom: 1px solid #e2e8f0; vertical-align: middle; }
    th { background: #f8fafc; font-weight: 700; color: #475569; position: sticky; top: 0; z-index: 10; }
    tr:hover { background: #f8fafc; cursor: pointer; }
    a { color: #2563eb; text-decoration: none; font-weight: 700; }
    .keyword-cell { display: flex; flex-direction: column; gap: 3px; }
    .keyword-meta { color: #64748b; font-size: 11px; }
    .tier-badge { display: inline-block; padding: 2px 6px; border-radius: 4px; font-weight: 800; font-size: 10px; margin-right: 5px; }
    .tier-s { background: #fee2e2; color: #dc2626; border: 1px solid #fca5a5; }
    .tier-a { background: #dbeafe; color: #2563eb; border: 1px solid #bfdbfe; }
    .tier-b { background: #dcfce7; color: #15803d; border: 1px solid #bbf7d0; }
    .rank-badge { display: inline-block; min-width: 36px; text-align: center; padding: 2px 6px; border-radius: 12px; font-weight: 800; font-size: 12px; }
    .rank-top3 { background: #dcfce7; color: #166534; }
    .rank-top10 { background: #dbeafe; color: #1d4ed8; }
    .rank-out { background: #f1f5f9; color: #94a3b8; }
    .diff-up { color: #dc2626; font-weight: 800; }
    .diff-down { color: #2563eb; font-weight: 800; }
    .diff-none { color: #cbd5e1; }
    .table-container { max-height: 690px; overflow-y: auto; }
    @media (max-width: 1100px) {
      .grid { grid-template-columns: 1fr; }
      .core-metrics { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1>문장군 URL 순위 대시보드</h1>
      <div class="subtitle">POSTING_REGISTRY URL/logNo와 네이버 검색 결과 URL을 매칭한 v4 추적 결과입니다.</div>
    </div>
  </div>

  <div class="core-metrics">
    ${['현관중문', '아파트중문', '3연동중문', '방문교체', 'ABS도어'].map((keyword) => renderCoreStat(coreStats, keyword)).join('')}
  </div>

  <div class="grid">
    <div class="panel">
      <div class="filter-group">
        <div class="filter-label">중요도별 보기</div>
        <button onclick="filterByTier('S')" class="active-s" id="btn-tier-S">S 핵심</button>
        <button onclick="filterByTier('A')" id="btn-tier-A">A 구매 전환</button>
        <button onclick="filterByTier('B')" id="btn-tier-B">B 롱테일</button>
        <button onclick="showAverages()" id="btn-avg">S/A/B 평균</button>
      </div>
      <div class="filter-group" style="border-bottom:none;">
        <div class="filter-label">제품군별 보기</div>
        <button onclick="filterByGroup('현관/아파트중문')" id="btn-grp-1">현관/아파트중문</button>
        <button onclick="filterByGroup('3연동/특수')" id="btn-grp-2">3연동/특수</button>
        <button onclick="filterByGroup('방문/도어')" id="btn-grp-3">방문/도어</button>
        <button onclick="clearAll()" id="btn-clear" style="margin-left:auto;">차트 비우기</button>
      </div>
      <div class="chart-wrapper">
        <canvas id="mainChart"></canvas>
      </div>
    </div>

    <div class="panel table-container">
      <table id="rankTable">
        <thead>
          <tr>
            <th width="30">V</th>
            <th>키워드/글</th>
            <th width="70">그룹</th>
            <th width="55">URL</th>
            <th width="54">계정</th>
            <th width="54">변화</th>
          </tr>
        </thead>
        <tbody>
          ${tableData.map((row) => `
            <tr onclick="toggleChart(${row.id})" id="row-${row.id}">
              <td style="text-align:center;">
                <input type="checkbox" id="chk-${row.id}" ${row.tier === 'S' ? 'checked' : ''} style="pointer-events: none;">
              </td>
              <td>
                <div class="keyword-cell">
                  <div>
                    <span class="tier-badge tier-${row.tier.toLowerCase()}">${escapeHtml(row.tier)}</span>
                    <strong>${escapeHtml(row.keyword)}</strong>
                    ${renderPostLink(row)}
                  </div>
                  <div class="keyword-meta">${escapeHtml(row.tierLabel)} · ${escapeHtml(row.matchType || 'unknown')}</div>
                </div>
              </td>
              <td style="font-size:11px; color:#64748b;">${escapeHtml(row.group)}</td>
              <td>
                <span class="rank-badge ${row.rank <= 3 ? 'rank-top3' : row.rank <= 10 ? 'rank-top10' : 'rank-out'}">
                  ${escapeHtml(row.rank === 31 ? 'OUT' : row.rank)}
                </span>
              </td>
              <td style="text-align:center;">${escapeHtml(row.accountRank > 0 ? row.accountRank : '-')}</td>
              <td style="text-align:center;">${renderDiff(row)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  </div>

  <script>
    const chartData = ${JSON.stringify(datasets)};
    const labels = ${JSON.stringify(labels)};
    const ctx = document.getElementById('mainChart').getContext('2d');
    const chart = new Chart(ctx, {
      type: 'line',
      data: { labels, datasets: chartData },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            mode: 'index',
            intersect: false,
            callbacks: {
              label: function(context) {
                const val = context.parsed.y;
                return context.dataset.label + ': ' + (val === 31 ? 'OUT' : val + '위');
              }
            }
          }
        },
        scales: {
          y: {
            reverse: true,
            min: 1,
            max: 31,
            ticks: { stepSize: 5, callback: val => val === 31 ? 'OUT' : val + '위' }
          }
        }
      }
    });

    function toggleChart(id) {
      const meta = chart.getDatasetMeta(id);
      meta.hidden = meta.hidden === null ? !chart.data.datasets[id].hidden : !meta.hidden;
      document.getElementById('chk-' + id).checked = !meta.hidden;
      chart.update();
      clearButtonStates();
    }

    function filterByTier(tier) {
      chart.data.datasets.forEach((ds, i) => {
        const show = ds._tier === tier && !ds._isAvg;
        chart.getDatasetMeta(i).hidden = !show;
        const checkbox = document.getElementById('chk-' + i);
        if (checkbox) checkbox.checked = show;
      });
      chart.update();
      clearButtonStates();
      document.getElementById('btn-tier-' + tier).classList.add('active-' + tier.toLowerCase());
    }

    function filterByGroup(groupName) {
      chart.data.datasets.forEach((ds, i) => {
        const show = ds._group === groupName && !ds._isAvg;
        chart.getDatasetMeta(i).hidden = !show;
        const checkbox = document.getElementById('chk-' + i);
        if (checkbox) checkbox.checked = show;
      });
      chart.update();
      clearButtonStates();
      document.querySelectorAll('button').forEach((button) => {
        if (button.innerText.includes(groupName.split('/')[0])) button.classList.add('active-grp');
      });
    }

    function showAverages() {
      chart.data.datasets.forEach((ds, i) => {
        const show = ds._isAvg === true;
        chart.getDatasetMeta(i).hidden = !show;
        const checkbox = document.getElementById('chk-' + i);
        if (checkbox) checkbox.checked = false;
      });
      chart.update();
      clearButtonStates();
      document.getElementById('btn-avg').classList.add('active-avg');
    }

    function clearAll() {
      chart.data.datasets.forEach((ds, i) => {
        chart.getDatasetMeta(i).hidden = true;
        const checkbox = document.getElementById('chk-' + i);
        if (checkbox) checkbox.checked = false;
      });
      chart.update();
      clearButtonStates();
      document.getElementById('btn-clear').classList.add('active-grp');
    }

    function clearButtonStates() {
      document.querySelectorAll('button').forEach((button) => {
        button.className = '';
      });
    }
  </script>
</body>
</html>
`;

  writeTextFile(HTML_FILE, htmlContent);
  console.log(`대시보드 생성 완료: ${HTML_FILE}`);
  console.log(`Chart.js 로컬 vendor 복사 완료: ${CHART_VENDOR_FILE}`);
}

generateDashboard();
