const { paths } = require('./lib/paths');
const { readJsonFile, writeTextFile } = require('./lib/file_store');

function trackingKey(item) {
  return item.trackingId || item.keyword;
}

function rankScore(rank) {
  if (rank > 0) return rank;
  return 31;
}

function rankLabel(rank) {
  if (rank > 0) return `${rank}위`;
  if (rank === 0) return 'TOP 밖';
  if (rank == null) return '-';
  return '오류';
}

function recordIsUrlBased(record) {
  return Boolean((record.rankings || []).some((item) => item.trackingId || item.postUrl || item.postId || item.matchType));
}

function classifySignal(currentRank, diff) {
  if (currentRank > 0 && currentRank <= 5) return '상위 노출 참고';
  if (currentRank > 0 && currentRank <= 10) return '내부링크 점검 참고';
  if (currentRank > 0 && currentRank <= 20) return diff < 0 ? '하락 관찰 참고' : '유입부/제목 점검 참고';
  return '신규 각도 또는 리라이팅 검토 참고';
}

function comparablePreviousRecord(records, latestIndex) {
  const latest = records[latestIndex];
  const latestUrlBased = recordIsUrlBased(latest);

  for (let index = latestIndex - 1; index >= 0; index -= 1) {
    const candidate = records[index];
    if (latestUrlBased && !recordIsUrlBased(candidate)) continue;
    if (!latestUrlBased && recordIsUrlBased(candidate)) continue;
    return candidate;
  }

  return null;
}

function main() {
  const historyPath = paths.dataProcessed('tracking_history.json');
  const history = readJsonFile(historyPath, { version: 4, records: [] });

  if (!Array.isArray(history.records) || history.records.length === 0) {
    throw new Error('순위 변화 요약에는 tracking_history records가 필요합니다.');
  }

  const latestIndex = history.records.length - 1;
  const latest = history.records[latestIndex];
  const previous = comparablePreviousRecord(history.records, latestIndex);
  const urlBased = recordIsUrlBased(latest);
  const hasComparison = Boolean(previous);
  const previousByKey = new Map((previous?.rankings || []).map((item) => [trackingKey(item), item]));

  const rows = (latest.rankings || []).map((item) => {
    const prev = previousByKey.get(trackingKey(item));
    const previousRank = prev ? prev.rank : null;
    const hasPreviousRow = Boolean(prev);
    const diff = hasComparison && hasPreviousRow ? rankScore(previousRank) - rankScore(item.rank) : 0;
    return {
      hub: item.hub || '-',
      postNo: item.postNo || '',
      postUrl: item.postUrl || '',
      keyword: item.keyword,
      previousRank,
      currentRank: item.rank,
      accountRank: item.accountRank || 0,
      matchType: item.matchType || '',
      diff,
      hasPreviousRow,
      title: item.matchedTitle || item.title || '',
      signal: classifySignal(item.rank, diff),
    };
  });

  const comparableRows = hasComparison ? rows.filter((row) => row.hasPreviousRow) : [];
  const improved = comparableRows.filter((row) => row.diff >= 5).sort((a, b) => b.diff - a.diff);
  const declined = comparableRows.filter((row) => row.diff <= -5).sort((a, b) => a.diff - b.diff);
  const enteredTop10 = hasComparison
    ? comparableRows.filter((row) => rankScore(row.previousRank) > 10 && row.currentRank > 0 && row.currentRank <= 10)
    : [];
  const leftTop10 = hasComparison
    ? comparableRows.filter((row) => row.previousRank > 0 && row.previousRank <= 10 && rankScore(row.currentRank) > 10)
    : [];
  const rewriteCandidates = hasComparison
    ? comparableRows
      .filter((row) => row.signal.includes('리라이팅') || row.signal.includes('신규 각도'))
      .sort((a, b) => rankScore(b.currentRank) - rankScore(a.currentRank))
      .slice(0, 10)
    : [];

  function renderTable(items) {
    if (items.length === 0) return '_해당 없음_\n';
    let md = '| 글 | 허브 | 키워드 | 이전 | 현재 URL | 계정 | 변화 | 매칭 | 참고 신호 |\n';
    md += '| --- | --- | --- | --- | --- | --- | ---: | --- | --- |\n';
    items.forEach((row) => {
      const postCell = row.postUrl ? `[${row.postNo || '-'}](${row.postUrl})` : row.postNo || '-';
      const accountCell = row.accountRank > 0 ? rankLabel(row.accountRank) : '-';
      const diffCell = row.diff > 0 ? `+${row.diff}` : row.diff;
      md += `| ${postCell} | ${row.hub} | ${row.keyword} | ${rankLabel(row.previousRank)} | ${rankLabel(row.currentRank)} | ${accountCell} | ${diffCell} | ${row.matchType || '-'} | ${row.signal} |\n`;
    });
    return md;
  }

  const title = urlBased ? '# URL 기반 순위 변화 요약' : '# 순위 변화 요약 (experimental)';
  let md = `${title}\n\n`;
  if (previous) md += `> 비교 기간: ${previous.date} → ${latest.date}\n`;
  else md += `> 비교 기간: ${latest.date} 단일 측정\n`;
  md += '> 기준: TOP 밖은 31위로 환산\n';
  if (urlBased) {
    md += '> 상태: URL 기반 v4. POSTING_REGISTRY의 게시물 URL/logNo와 검색 결과 URL을 매칭합니다. 계정 첫 등장 순위는 보조 지표입니다.\n';
  } else {
    md += '> 상태: EXPERIMENTAL. 특정 게시물 URL 순위가 아니라 블로그 계정 첫 등장 위치 기반 참고 신호입니다.\n';
  }
  if (!hasComparison) {
    md += '> 비교 제한: 같은 방식의 직전 측정이 없어 이번 회차는 변화량을 계산하지 않습니다.\n';
  }
  md += '> 사용 제한: 신규 글감, 보호 글, 리라이팅의 단독 근거로 사용하지 않습니다. daily report, POSTING_REGISTRY, topic scorecard와 함께 봅니다.\n\n';

  md += '## 요약\n\n';
  md += '| 항목 | 수치 |\n';
  md += '| --- | ---: |\n';
  md += `| 5계단 이상 상승 | ${improved.length} |\n`;
  md += `| 5계단 이상 하락 | ${declined.length} |\n`;
  md += `| TOP10 신규 진입 | ${enteredTop10.length} |\n`;
  md += `| TOP10 이탈 | ${leftTop10.length} |\n`;
  md += `| 리라이팅/신규 각도 참고 신호 | ${rewriteCandidates.length} |\n\n`;
  md += `## 5계단 이상 상승\n\n${renderTable(improved)}\n`;
  md += `## 5계단 이상 하락\n\n${renderTable(declined)}\n`;
  md += `## TOP10 신규 진입\n\n${renderTable(enteredTop10)}\n`;
  md += `## TOP10 이탈\n\n${renderTable(leftTop10)}\n`;
  md += `## 리라이팅/신규 각도 참고 신호 Top 10\n\n${renderTable(rewriteCandidates)}\n`;

  const outputPath = paths.outputReport('ranking_changes_summary.md');
  writeTextFile(outputPath, md);
  console.log(md);
  console.log(`저장: ${outputPath}`);
}

main();
