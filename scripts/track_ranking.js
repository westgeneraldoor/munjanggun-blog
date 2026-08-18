/**
 * Naver Blog URL-based ranking tracker v4.
 *
 * The primary rank is the position of the exact POSTING_REGISTRY post URL/logNo
 * in Naver blog search results. accountRank is only a secondary signal for the
 * first Moonjanggun account post that appears in the same result set.
 */

require('./lib/env_loader');

const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');
const { paths } = require('./lib/paths');
const { readJsonFile, writeJsonFile, writeTextFile } = require('./lib/file_store');
const { buildTrackingTargets, registeredIdsByPostId } = require('./lib/posting_registry');
const {
  collectUniquePostResults,
  collectAccountMatches,
  groupTargetsByKeyword,
  evaluateTargetRanking,
  formatRankingTrendLabel,
  formatHistoryRecordLabels,
} = require('./lib/naver_blog_results');

function getPlatformDefaultChromePath() {
  const platform = process.platform;

  if (platform === 'win32') {
    const commonPaths = [
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      path.join(process.env.USERPROFILE || 'C:\\Users\\Default', 'AppData\\Local\\Google\\Chrome\\Application\\chrome.exe'),
    ];
    for (const candidate of commonPaths) {
      if (fs.existsSync(candidate)) return candidate;
    }
  }

  if (platform === 'darwin') {
    const macPath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
    if (fs.existsSync(macPath)) return macPath;
  }

  if (platform === 'linux') {
    const linuxPaths = ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'];
    for (const candidate of linuxPaths) {
      if (fs.existsSync(candidate)) return candidate;
    }
  }

  return 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
}

const appConfig = readJsonFile(paths.config('app.json'), {});
const BLOG_ID = process.env.NAVER_BLOG_ID || appConfig.defaultBlogId || 'doorgeneral';
const CHROME_PATH = process.env.CHROME_PATH || getPlatformDefaultChromePath();
const DELAY_MS = Number(process.env.TRACKING_DELAY_MS || appConfig.trackingDelayMs || 2000);
const NAVIGATION_TIMEOUT_MS = Number(process.env.TRACKING_NAVIGATION_TIMEOUT_MS || appConfig.trackingNavigationTimeoutMs || 30000);
const TRACKING_KEYWORDS = readJsonFile(paths.config('tracking_keywords.json'), []);
const TRACKING_TARGETS = buildTrackingTargets(TRACKING_KEYWORDS);
const REGISTRY_ID_BY_POST_ID = registeredIdsByPostId();
const HISTORY_PATH = paths.dataProcessed('tracking_history.json');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function collectSearchResults(page, keyword) {
  const url = `https://search.naver.com/search.naver?ssc=tab.blog.all&sm=tab_jum&query=${encodeURIComponent(keyword)}`;

  await page.goto(url, { waitUntil: 'networkidle2', timeout: NAVIGATION_TIMEOUT_MS });
  await sleep(1500);

  const links = await page.$$eval('a[href*="blog.naver.com"]', (anchors) => anchors.map((link) => {
    const parentItem = link.closest('.lst, .api_txt_lines, [class*="item"], [class*="card"]');
    const titleEl = parentItem ? parentItem.querySelector('a.api_txt_lines, .title_link, .sub_txt') : null;
    return {
      href: link.href || link.getAttribute('href') || '',
      title: titleEl ? titleEl.textContent.trim() : link.textContent.trim(),
    };
  }));

  return collectUniquePostResults(links);
}

function loadHistory() {
  const version = appConfig.rankingHistoryVersion || 4;
  const data = readJsonFile(HISTORY_PATH, { version, records: [] });
  if (Array.isArray(data.records)) return { ...data, version };
  return { version, records: [] };
}

function displayRank(rank) {
  if (rank > 0) return `${rank}위`;
  if (rank === 0) return 'TOP 밖';
  return '오류';
}

function generateReport(results, today, history) {
  let md = '# URL 기반 순위 추적 리포트\n\n';
  md += `> 조회일: ${today}\n`;
  md += `> 블로그: https://blog.naver.com/${BLOG_ID}\n`;
  md += '> 상태: URL 기반 v4. POSTING_REGISTRY의 게시물 URL/logNo와 검색 결과 URL을 매칭합니다.\n';
  md += '> 보조값: accountRank는 문장군 블로그 계정의 첫 게시글 등장 위치입니다. URL rank가 0이면 단독 의사결정 근거로 쓰지 않습니다.\n';
  md += '> 방식: Puppeteer headless Chrome으로 네이버 블로그 탭을 렌더링해 고유 게시글 URL 순서를 수집합니다.\n\n';

  const ranked = results.filter((result) => result.rank > 0);
  const top5 = results.filter((result) => result.rank > 0 && result.rank <= 5);
  const top10 = results.filter((result) => result.rank > 0 && result.rank <= 10);

  md += '## 요약\n';
  md += '| 항목 | 수치 |\n| --- | ---: |\n';
  md += `| 추적 키워드 | ${results.length}개 |\n`;
  md += `| URL 노출 중 | ${ranked.length}개 |\n`;
  md += `| TOP 5 | ${top5.length}개 |\n`;
  md += `| TOP 10 | ${top10.length}개 |\n\n`;

  md += '## 키워드별 순위\n\n';
  md += '| 글 | 허브 | 키워드 | URL 순위 | 계정 순위 | 매칭 | 비고 |\n';
  md += '| --- | --- | --- | --- | --- | --- | --- |\n';
  results.forEach((result) => {
    const rankCell = result.rank > 0 ? displayRank(result.rank) : (result.note || displayRank(result.rank));
    const accountRank = result.accountRank > 0 ? displayRank(result.accountRank) : '-';
    const postCell = result.postUrl ? `[${result.postNo || '-'}](${result.postUrl})` : (result.postNo || '-');
    md += `| ${postCell} | ${result.hub} | ${result.keyword} | **${rankCell}** | ${accountRank} | ${result.matchType || '-'} | ${result.matchedTitle || result.title || ''} |\n`;
  });

  const recent = history.records.slice(-7);
  if (recent.length > 1) {
    const keys = [...new Set(results.map((result) => result.trackingId || result.keyword))];
    const recentLabels = formatHistoryRecordLabels(recent);
    md += `\n## 순위 추이 (최근 ${recent.length}회)\n\n| 추적 대상 |`;
    recentLabels.forEach((label) => { md += ` ${label} |`; });
    md += '\n| --- |';
    recent.forEach(() => { md += ' --- |'; });
    md += '\n';

    keys.forEach((key) => {
      const label = results.find((result) => (result.trackingId || result.keyword) === key);
      md += `| ${label ? formatRankingTrendLabel(label) : key} |`;
      recent.forEach((record) => {
        const found = (record.rankings || []).find((item) => (item.trackingId || item.keyword) === key);
        md += found && found.rank > 0 ? ` ${displayRank(found.rank)} |` : ' - |';
      });
      md += '\n';
    });
  }

  const reportPath = paths.outputReport('ranking_report.md');
  writeTextFile(reportPath, md);
  console.log(`\n리포트 저장: ${reportPath}`);
}

function generateAccountMatchesReport(queryEvidence, today, timestamp) {
  let md = '# 문장군 계정 검색 결과 URL 계측\n\n';
  md += `> 조회일: ${today}\n`;
  md += `> 완료 시각: ${timestamp}\n`;
  md += '> 단위: 검색어별로 한 번 수집한 고유 블로그 URL 목록\n';
  md += '> 등록부 ID: POSTING_REGISTRY의 logNo와 일치할 때만 기록하며, 미일치 logNo는 `미상`으로 둡니다.\n\n';
  md += '| 검색어 | 수집 URL | 계정 URL | 순위 | 등록부 ID | logNo | URL | 화면 제목 | 상태 |\n';
  md += '| --- | ---: | ---: | ---: | --- | --- | --- | --- | --- |\n';

  queryEvidence.forEach((evidence) => {
    if (evidence.error) {
      md += `| ${evidence.keyword} | 0 | 0 | - | - | - | - | - | 오류: ${evidence.error.replace(/\|/g, '/')} |\n`;
      return;
    }
    if (evidence.accountMatches.length === 0) {
      const status = evidence.totalFound === 0 ? '빈 결과' : '계정 URL 미검출';
      md += `| ${evidence.keyword} | ${evidence.totalFound} | 0 | - | - | - | - | - | ${status} |\n`;
      return;
    }
    evidence.accountMatches.forEach((match) => {
      md += `| ${evidence.keyword} | ${evidence.totalFound} | ${evidence.accountMatches.length} | ${match.rank} | ${match.postNo || '미상'} | ${match.logNo} | [URL](${match.url}) | ${String(match.title || '').replace(/\|/g, '/')} | URL 검출 |\n`;
    });
  });

  const reportPath = paths.outputReport('ranking_account_matches.md');
  writeTextFile(reportPath, md);
  console.log(`계정 URL 증거 저장: ${reportPath}`);
}

async function main() {
  if (process.argv.includes('--report-only')) {
    const history = loadHistory();
    const latest = history.records[history.records.length - 1];
    if (!latest) throw new Error('리포트를 만들 순위 이력이 없습니다.');
    generateReport(latest.rankings || [], latest.date, history);
    generateAccountMatchesReport(latest.queryEvidence || [], latest.date, latest.timestamp || latest.date);
    console.log('기존 최신 이력으로 리포트만 다시 만들었습니다. 새 계측 기록은 추가하지 않았습니다.');
    return;
  }

  const today = new Date().toISOString().split('T')[0];
  console.log(`\n문장군 블로그 순위 추적 v4.0 - ${today}`);
  console.log(`블로그: https://blog.naver.com/${BLOG_ID}`);
  console.log('상태: URL 기반 - POSTING_REGISTRY의 게시물 URL/logNo와 검색 결과 URL을 매칭합니다.');
  console.log('방식: Puppeteer headless Chrome URL 순위 수집');
  const targetGroups = groupTargetsByKeyword(TRACKING_TARGETS);
  console.log(`추적 조합: ${TRACKING_TARGETS.length}개 / 고유 검색어: ${targetGroups.length}개`);
  console.log('-'.repeat(70));

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--incognito', '--lang=ko-KR'],
  });

  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36');
  await page.setViewport({ width: 1280, height: 900 });

  const results = [];
  const queryEvidence = [];
  const history = loadHistory();
  const lastRecord = history.records[history.records.length - 1] || null;

  for (let groupIndex = 0; groupIndex < targetGroups.length; groupIndex += 1) {
    const group = targetGroups[groupIndex];
    process.stdout.write(`  [${groupIndex + 1}/${targetGroups.length}] "${group.keyword}" (${group.targets.length}개 대상)`);

    let searchResults = [];
    let collectionError = '';
    try {
      searchResults = await collectSearchResults(page, group.keyword);
      console.log(` -> 고유 URL ${searchResults.length}개`);
    } catch (err) {
      collectionError = err.message;
      console.log(` -> 오류: ${collectionError}`);
    }

    const accountMatches = collectionError
      ? []
      : collectAccountMatches(searchResults, BLOG_ID, REGISTRY_ID_BY_POST_ID);
    queryEvidence.push({
      keyword: group.keyword,
      totalFound: searchResults.length,
      accountMatches,
      error: collectionError,
    });

    group.targets.forEach((target) => {
      const ranking = collectionError
        ? { rank: -1, accountRank: 0, totalFound: 0, matchType: target.matchMode || '', note: '', error: collectionError }
        : evaluateTargetRanking(searchResults, target, BLOG_ID);
      let change = '';
      if (lastRecord) {
        const previous = (lastRecord.rankings || []).find((item) => (item.trackingId || item.keyword) === target.trackingId);
        if (previous && previous.rank > 0 && ranking.rank > 0) {
          const diff = previous.rank - ranking.rank;
          if (diff > 0) change = ` (+${diff})`;
          else if (diff < 0) change = ` (-${Math.abs(diff)})`;
          else change = ' (=)';
        } else if (!previous && ranking.rank > 0) {
          change = ' (NEW)';
        }
      }

      if (ranking.rank > 0) console.log(`      ${target.postNo || '-'}: ${displayRank(ranking.rank)}${change}`);
      else if (ranking.rank === 0) console.log(`      ${target.postNo || '-'}: ${ranking.note || 'TOP 밖'}`);
      else console.log(`      ${target.postNo || '-'}: 오류: ${ranking.error}`);

      results.push({
        trackingId: target.trackingId,
        keyword: target.keyword,
        hub: target.hub,
        postNo: target.postNo || '',
        postUrl: target.postUrl || '',
        postId: target.postId || '',
        rank: ranking.rank,
        accountRank: ranking.accountRank || 0,
        title: ranking.title || '',
        matchedTitle: ranking.matchedTitle || '',
        matchedUrl: ranking.matchedUrl || '',
        matchType: ranking.matchType || target.matchMode || '',
        note: ranking.note || '',
        totalFound: ranking.totalFound || 0,
      });
    });

    if (groupIndex < targetGroups.length - 1) await sleep(DELAY_MS);
  }

  console.log('-'.repeat(70));
  const timestamp = new Date().toISOString();
  history.records.push({ date: today, timestamp, rankings: results, queryEvidence });
  writeJsonFile(HISTORY_PATH, history);
  console.log(`이력 저장: tracking_history.json (v${history.version}, ${history.records.length}회 누적)`);

  generateReport(results, today, history);
  generateAccountMatchesReport(queryEvidence, today, timestamp);
  await browser.close();
}

main().catch((err) => {
  console.error('실행 오류:', err.message);
  process.exit(1);
});
