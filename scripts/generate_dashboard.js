const fs = require('fs');
const { paths } = require('./lib/paths');
const { readJsonFile, writeTextFile } = require('./lib/file_store');

const HISTORY_FILE = paths.dataProcessed('tracking_history.json');
const HTML_FILE = paths.outputDashboard('ranking_dashboard.html');

function analyzeKeyword(kw, hub) {
  let tier = 'B';
  let tierLabel = '일반/롱테일';
  
  const sTierKws = ['중문', '3연동중문', '현관중문', '방문교체', 'ABS도어', '아파트중문'];
  
  if (sTierKws.includes(kw)) {
    tier = 'S';
    tierLabel = '메인 트래픽';
  } else if (kw.includes('비용') || kw.includes('가격') || kw.includes('견적') || kw.includes('설치')) {
    tier = 'A';
    tierLabel = '구매 전환';
  }

  let group = '기타';
  if (kw.includes('3연동') || kw.includes('슬라이딩') || kw.includes('스윙') || kw.includes('연동')) {
    group = '3연동/특수';
  } else if (kw.includes('방문') || kw.includes('도어') || kw.includes('문짝') || kw.includes('문틀')) {
    group = '방문/도어';
  } else if (kw.includes('중문') || kw.includes('현관')) {
    group = '현관/아파트중문';
  }

  return { tier, tierLabel, group };
}

function generateDashboard() {
  if (!fs.existsSync(HISTORY_FILE)) {
    console.error('❌ tracking_history.json 파일이 없습니다.');
    return;
  }

  const data = readJsonFile(HISTORY_FILE, { version: 3, records: [] });
  const records = data.records;
  if (records.length === 0) return;

  const latest = records[records.length - 1];
  const previous = records.length > 1 ? records[records.length - 2] : null;
  const allKeywords = latest.rankings;

  const labels = records.map(r => {
    const d = new Date(r.timestamp);
    return `${d.getMonth()+1}/${d.getDate()} ${d.getHours()}:${d.getMinutes().toString().padStart(2, '0')}`;
  });

  const tableData = [];
  const datasets = [];

  const coreKws = ['현관중문', '아파트중문', '3연동중문', '방문교체', 'ABS도어'];
  const coreStats = {};

  // 등급별 평균을 계산하기 위한 데이터 구조
  const tierScores = { S: [], A: [], B: [] };
  records.forEach(() => {
    tierScores.S.push([]);
    tierScores.A.push([]);
    tierScores.B.push([]);
  });

  allKeywords.forEach((item, index) => {
    const trend = records.map((r, rIdx) => {
      const found = r.rankings.find(k => k.keyword === item.keyword);
      
      if (found) {
        const rank = found.rank > 0 ? found.rank : 31;
        const { tier } = analyzeKeyword(item.keyword, item.hub || '');
        tierScores[tier][rIdx].push(rank);
      }
      
      return found ? (found.rank > 0 ? found.rank : 31) : null;
    });

    let diff = 0;
    if (previous) {
      const prevItem = previous.rankings.find(k => k.keyword === item.keyword);
      if (prevItem) {
        const prevRank = prevItem.rank > 0 ? prevItem.rank : 31;
        const currRank = item.rank > 0 ? item.rank : 31;
        diff = prevRank - currRank;
      }
    }

    const { tier, tierLabel, group } = analyzeKeyword(item.keyword, item.hub || '');
    
    if (coreKws.includes(item.keyword)) {
      coreStats[item.keyword] = { rank: item.rank > 0 ? item.rank : 31, diff };
    }

    const isS = tier === 'S';

    let color = '#94a3b8';
    if (tier === 'S') color = '#ef4444'; 
    else if (tier === 'A') color = '#3b82f6';
    else if (tier === 'B') color = '#10b981';

    tableData.push({
      id: index,
      hub: item.hub || '-',
      keyword: item.keyword,
      rank: item.rank > 0 ? item.rank : 31,
      diff: diff,
      tier, tierLabel, group
    });

    datasets.push({
      label: item.keyword,
      data: trend,
      borderColor: color,
      backgroundColor: color,
      borderWidth: tier === 'S' ? 4 : (tier === 'A' ? 2 : 1),
      hidden: !isS,
      tension: 0.3,
      pointRadius: isS ? 5 : 3,
      pointHoverRadius: 7,
      _tier: tier,
      _group: group,
      _isAvg: false
    });
  });

  // 평균 데이터셋 3개 추가
  const avgColors = { S: '#dc2626', A: '#2563eb', B: '#059669' };
  ['S', 'A', 'B'].forEach(t => {
    const avgData = tierScores[t].map(scores => {
      if (scores.length === 0) return null;
      const sum = scores.reduce((a, b) => a + b, 0);
      return parseFloat((sum / scores.length).toFixed(1));
    });
    
    datasets.push({
      label: `${t}등급 전체 평균`,
      data: avgData,
      borderColor: avgColors[t],
      backgroundColor: avgColors[t],
      borderWidth: 5,
      borderDash: [8, 4], // 점선으로 표시해서 일반 키워드와 구분
      hidden: true, // 기본은 숨김
      tension: 0.2,
      pointRadius: 6,
      _tier: t,
      _group: '평균',
      _isAvg: true
    });
  });

  tableData.sort((a, b) => {
    const tierScore = { 'S': 0, 'A': 1, 'B': 2 };
    if (tierScore[a.tier] !== tierScore[b.tier]) return tierScore[a.tier] - tierScore[b.tier];
    return a.rank - b.rank;
  });

  function renderCoreStat(kw) {
    const stat = coreStats[kw] || { rank: 31, diff: 0 };
    const rankStr = stat.rank === 31 ? 'OUT' : stat.rank + '위';
    let diffStr = '<span class="diff-none">-</span>';
    if (stat.diff > 0) diffStr = `<span class="diff-up">▲${stat.diff}</span>`;
    if (stat.diff < 0) diffStr = `<span class="diff-down">▼${Math.abs(stat.diff)}</span>`;
    return `
      <div class="core-card">
        <div class="core-title">${kw}</div>
        <div class="core-value">${rankStr}</div>
        <div class="core-diff">${diffStr}</div>
      </div>
    `;
  }

  const htmlContent = `
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <title>문장군 전략적 SEO 대시보드</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <style>
    body { font-family: 'Pretendard', -apple-system, sans-serif; background: #f1f5f9; color: #334155; margin: 0; padding: 20px; }
    .header { margin-bottom: 20px; display: flex; justify-content: space-between; align-items: flex-end; }
    h1 { margin: 0; color: #0f172a; font-size: 24px; }
    
    .core-metrics { display: flex; gap: 12px; margin-bottom: 20px; }
    .core-card { background: linear-gradient(135deg, #1e293b, #0f172a); color: white; padding: 15px 20px; border-radius: 12px; flex: 1; text-align: center; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); }
    .core-title { font-size: 13px; color: #94a3b8; margin-bottom: 5px; }
    .core-value { font-size: 26px; font-weight: bold; color: #fff; }
    .core-diff { font-size: 13px; margin-top: 5px; }
    .core-diff .diff-up { color: #f87171; }
    .core-diff .diff-down { color: #60a5fa; }
    .core-diff .diff-none { color: #64748b; }

    .grid { display: grid; grid-template-columns: 1fr 500px; gap: 20px; align-items: start; }
    .panel { background: white; padding: 20px; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .chart-wrapper { height: 500px; width: 100%; margin-top: 15px; }
    
    .filter-group { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 10px; padding-bottom: 10px; border-bottom: 1px dashed #e2e8f0; }
    .filter-label { font-size: 12px; font-weight: bold; color: #64748b; width: 100%; margin-bottom: 2px; }
    button { padding: 6px 14px; border: 1px solid #cbd5e1; background: white; border-radius: 20px; cursor: pointer; font-size: 12px; font-weight: 500; color: #475569; transition: all 0.2s; }
    button:hover { background: #f1f5f9; }
    button.active-s { background: #fee2e2; color: #b91c1c; border-color: #fca5a5; }
    button.active-a { background: #e0f2fe; color: #0369a1; border-color: #7dd3fc; }
    button.active-grp { background: #f1f5f9; color: #0f172a; border-color: #94a3b8; }
    button.active-avg { background: #4f46e5; color: white; border-color: #4338ca; }

    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th, td { padding: 10px 8px; text-align: left; border-bottom: 1px solid #e2e8f0; }
    th { background: #f8fafc; font-weight: 600; color: #475569; position: sticky; top: 0; z-index: 10; }
    tr:hover { background: #f8fafc; cursor: pointer; }
    
    .tier-badge { display: inline-block; padding: 2px 6px; border-radius: 4px; font-weight: 800; font-size: 10px; margin-right: 5px; }
    .tier-s { background: #fee2e2; color: #dc2626; border: 1px solid #fca5a5; }
    .tier-a { background: #e0f2fe; color: #2563eb; border: 1px solid #bfdbfe; }
    .tier-b { background: #f1f5f9; color: #64748b; border: 1px solid #e2e8f0; }
    
    .rank-badge { display: inline-block; width: 36px; text-align: center; padding: 2px 0; border-radius: 12px; font-weight: bold; font-size: 12px; }
    .rank-top3 { background: #dcfce7; color: #166534; }
    .rank-top10 { background: #e0f2fe; color: #0369a1; }
    .rank-out { background: #f1f5f9; color: #94a3b8; }
    
    .diff-up { color: #ef4444; font-weight: bold; }
    .diff-down { color: #3b82f6; font-weight: bold; }
    .diff-none { color: #cbd5e1; }
    
    .table-container { max-height: 650px; overflow-y: auto; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1>🚀 문장군 전략적 SEO 대시보드</h1>
      <span style="color: #64748b; font-size: 13px;">진짜 누적된 실제 데이터만 표시합니다. (가짜 데이터 제거)</span>
    </div>
  </div>

  <div class="core-metrics">
    ${renderCoreStat('현관중문')}
    ${renderCoreStat('아파트중문')}
    ${renderCoreStat('3연동중문')}
    ${renderCoreStat('방문교체')}
    ${renderCoreStat('ABS도어')}
  </div>

  <div class="grid">
    <div class="panel">
      
      <div class="filter-group">
        <div class="filter-label">🎯 중요도(Tier) 별 보기</div>
        <button onclick="filterByTier('S')" class="active-s" id="btn-tier-S">🔥 S등급 (메인 트래픽)</button>
        <button onclick="filterByTier('A')" id="btn-tier-A">💰 A등급 (구매/전환 특화)</button>
        <button onclick="filterByTier('B')" id="btn-tier-B">🌱 B등급 (일반/롱테일)</button>
        <!-- 새 기능: 평균 라인 3개만 보기 -->
        <button onclick="showAverages()" id="btn-avg" style="margin-left: 10px;">📊 S/A/B 등급별 평균 흐름</button>
      </div>
      
      <div class="filter-group" style="border-bottom:none;">
        <div class="filter-label">🚪 제품군(Group) 별 보기</div>
        <button onclick="filterByGroup('현관/아파트중문')" id="btn-grp-1">현관/아파트중문</button>
        <button onclick="filterByGroup('3연동/특수')" id="btn-grp-2">3연동/특수중문</button>
        <button onclick="filterByGroup('방문/도어')" id="btn-grp-3">방문/ABS도어</button>
        <button onclick="clearAll()" id="btn-clear" style="margin-left:auto; background:#f8fafc;">🗑️ 비우기</button>
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
            <th>키워드</th>
            <th width="70">그룹</th>
            <th width="40">순위</th>
            <th width="40">어제대비</th>
          </tr>
        </thead>
        <tbody>
          ${tableData.map((row) => `
            <tr onclick="toggleChart(${row.id})" id="row-${row.id}">
              <td style="text-align:center;">
                <input type="checkbox" id="chk-${row.id}" ${row.tier === 'S' ? 'checked' : ''} style="pointer-events: none;">
              </td>
              <td>
                <span class="tier-badge tier-${row.tier.toLowerCase()}">${row.tier}</span>
                <strong>${row.keyword}</strong>
              </td>
              <td style="font-size:11px; color:#64748b;">${row.group}</td>
              <td>
                <span class="rank-badge ${row.rank <= 3 ? 'rank-top3' : (row.rank <= 10 ? 'rank-top10' : 'rank-out')}">
                  ${row.rank === 31 ? 'OUT' : row.rank}
                </span>
              </td>
              <td style="text-align:center;">
                ${row.diff > 0 ? `<span class="diff-up">▲${row.diff}</span>` : 
                  row.diff < 0 ? `<span class="diff-down">▼${Math.abs(row.diff)}</span>` : 
                  `<span class="diff-none">-</span>`}
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  </div>

  <script>
    const chartData = ${JSON.stringify(datasets)};
    const ctx = document.getElementById('mainChart').getContext('2d');
    
    const chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: ${JSON.stringify(labels)},
        datasets: chartData
      },
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
                let val = context.parsed.y;
                return context.dataset.label + ': ' + (val === 31 ? 'OUT' : val + '위');
              }
            }
          }
        },
        scales: {
          y: {
            reverse: true,
            min: 1, max: 31,
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
        if (!ds._isAvg) document.getElementById('chk-' + i).checked = show;
      });
      chart.update();
      clearButtonStates();
      document.getElementById('btn-tier-' + tier).classList.add('active-' + tier.toLowerCase());
    }

    function filterByGroup(groupName) {
      chart.data.datasets.forEach((ds, i) => {
        const show = ds._group === groupName && !ds._isAvg;
        chart.getDatasetMeta(i).hidden = !show;
        if (!ds._isAvg) document.getElementById('chk-' + i).checked = show;
      });
      chart.update();
      clearButtonStates();
      document.querySelectorAll('button').forEach(b => {
        if(b.innerText.includes(groupName.split('/')[0])) b.classList.add('active-grp');
      });
    }

    function showAverages() {
      chart.data.datasets.forEach((ds, i) => {
        const show = ds._isAvg === true;
        chart.getDatasetMeta(i).hidden = !show;
        if (!ds._isAvg) document.getElementById('chk-' + i).checked = false;
      });
      chart.update();
      clearButtonStates();
      document.getElementById('btn-avg').classList.add('active-avg');
    }

    function clearAll() {
      chart.data.datasets.forEach((ds, i) => {
        chart.getDatasetMeta(i).hidden = true;
        if (!ds._isAvg) document.getElementById('chk-' + i).checked = false;
      });
      chart.update();
      clearButtonStates();
      document.getElementById('btn-clear').classList.add('active-grp');
    }

    function clearButtonStates() {
      document.querySelectorAll('button').forEach(b => {
        b.className = '';
      });
    }
  </script>
</body>
</html>
  `;

  writeTextFile(HTML_FILE, htmlContent);
  console.log('✅ 대시보드 스크립트 업데이트 완료! (실제 데이터 반영 및 평균 라인 추가)');
}

generateDashboard();
