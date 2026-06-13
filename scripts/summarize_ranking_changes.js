const { paths } = require('./lib/paths');
const { readJsonFile, writeTextFile } = require('./lib/file_store');

function rankScore(rank) {
  if (rank > 0) return rank;
  return 31;
}

function rankLabel(rank) {
  if (rank > 0) return `${rank}위`;
  if (rank === 0) return 'TOP 밖';
  return '오류';
}

function classifyAction(currentRank, diff) {
  if (currentRank > 0 && currentRank <= 5) return '보호';
  if (currentRank > 0 && currentRank <= 10) return '내부링크 보강';
  if (currentRank > 0 && currentRank <= 20) return diff < 0 ? '리라이팅 검토' : '도입부/제목 보강';
  return '신규 각도 또는 리라이팅 후보';
}

function main() {
  const historyPath = paths.dataProcessed('tracking_history.json');
  const history = readJsonFile(historyPath, { records: [] });

  if (!Array.isArray(history.records) || history.records.length < 2) {
    throw new Error('순위 변화 요약에는 최소 2회 이상의 tracking_history records가 필요합니다.');
  }

  const previous = history.records[history.records.length - 2];
  const latest = history.records[history.records.length - 1];
  const previousMap = new Map(previous.rankings.map((item) => [item.keyword, item]));
  const rows = latest.rankings.map((item) => {
    const prev = previousMap.get(item.keyword);
    const prevRank = prev ? prev.rank : 0;
    const diff = rankScore(prevRank) - rankScore(item.rank);
    return {
      hub: item.hub || '-',
      keyword: item.keyword,
      previousRank: prevRank,
      currentRank: item.rank,
      diff,
      title: item.title || '',
      action: classifyAction(item.rank, diff),
    };
  });

  const improved = rows.filter((row) => row.diff >= 5).sort((a, b) => b.diff - a.diff);
  const declined = rows.filter((row) => row.diff <= -5).sort((a, b) => a.diff - b.diff);
  const enteredTop10 = rows.filter((row) => rankScore(row.previousRank) > 10 && row.currentRank > 0 && row.currentRank <= 10);
  const leftTop10 = rows.filter((row) => row.previousRank > 0 && row.previousRank <= 10 && rankScore(row.currentRank) > 10);
  const rewriteCandidates = rows
    .filter((row) => row.action.includes('리라이팅') || row.action.includes('신규 각도'))
    .sort((a, b) => rankScore(b.currentRank) - rankScore(a.currentRank))
    .slice(0, 10);

  function renderTable(items) {
    if (items.length === 0) return '_해당 없음_\n';
    let md = `| 허브 | 키워드 | 이전 | 현재 | 변화 | 액션 |\n`;
    md += `| --- | --- | --- | --- | ---: | --- |\n`;
    items.forEach((row) => {
      md += `| ${row.hub} | ${row.keyword} | ${rankLabel(row.previousRank)} | ${rankLabel(row.currentRank)} | ${row.diff > 0 ? `+${row.diff}` : row.diff} | ${row.action} |\n`;
    });
    return md;
  }

  let md = `# 순위 변화 요약\n\n`;
  md += `> 비교 기간: ${previous.date} → ${latest.date}\n`;
  md += `> 기준: TOP 밖은 31위로 환산\n\n`;
  md += `## 요약\n\n`;
  md += `| 항목 | 수치 |\n`;
  md += `| --- | ---: |\n`;
  md += `| 5계단 이상 상승 | ${improved.length} |\n`;
  md += `| 5계단 이상 하락 | ${declined.length} |\n`;
  md += `| TOP10 신규 진입 | ${enteredTop10.length} |\n`;
  md += `| TOP10 이탈 | ${leftTop10.length} |\n`;
  md += `| 리라이팅/신규 각도 후보 | ${rewriteCandidates.length} |\n\n`;
  md += `## 5계단 이상 상승\n\n${renderTable(improved)}\n`;
  md += `## 5계단 이상 하락\n\n${renderTable(declined)}\n`;
  md += `## TOP10 신규 진입\n\n${renderTable(enteredTop10)}\n`;
  md += `## TOP10 이탈\n\n${renderTable(leftTop10)}\n`;
  md += `## 리라이팅 후보 Top 10\n\n${renderTable(rewriteCandidates)}\n`;

  const outputPath = paths.outputReport('ranking_changes_summary.md');
  writeTextFile(outputPath, md);
  console.log(md);
  console.log(`저장: ${outputPath}`);
}

main();
