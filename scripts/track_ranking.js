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
const { buildTrackingTargets } = require('./lib/posting_registry');
const { collectUniquePostResults, findAccountRank } = require('./lib/naver_blog_results');

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
const HISTORY_PATH = paths.dataProcessed('tracking_history.json');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function findRanking(page, target) {
  try {
    const { keyword, postId } = target;
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

    const searchResults = collectUniquePostResults(links);
    const accountRank = findAccountRank(searchResults, BLOG_ID);

    if (postId) {
      for (let index = 0; index < searchResults.length; index += 1) {
        const item = searchResults[index];
        if (item.blogId === BLOG_ID && item.postId === postId) {
          return {
            rank: index + 1,
            accountRank,
            title: item.title,
            matchedTitle: item.title,
            matchedUrl: item.href,
            matchType: 'url',
            totalFound: searchResults.length,
          };
        }
      }
    }

    return {
      rank: 0,
      accountRank,
      totalFound: searchResults.length,
      matchType: postId ? 'url_not_found' : 'account_fallback',
      note: postId ? `target URL not found in TOP ${searchResults.length}` : `TOP ${searchResults.length} account fallback`,
    };
  } catch (err) {
    return { rank: -1, error: err.message };
  }
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
    md += `\n## 순위 추이 (최근 ${recent.length}회)\n\n| 키워드 |`;
    recent.forEach((record) => { md += ` ${record.date} |`; });
    md += '\n| --- |';
    recent.forEach(() => { md += ' --- |'; });
    md += '\n';

    keys.forEach((key) => {
      const label = results.find((result) => (result.trackingId || result.keyword) === key);
      md += `| ${label ? label.keyword : key} |`;
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

async function main() {
  const today = new Date().toISOString().split('T')[0];
  console.log(`\n문장군 블로그 순위 추적 v4.0 - ${today}`);
  console.log(`블로그: https://blog.naver.com/${BLOG_ID}`);
  console.log('상태: URL 기반 - POSTING_REGISTRY의 게시물 URL/logNo와 검색 결과 URL을 매칭합니다.');
  console.log('방식: Puppeteer headless Chrome URL 순위 수집');
  console.log(`추적 키워드: ${TRACKING_TARGETS.length}개`);
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
  const history = loadHistory();
  const lastRecord = history.records[history.records.length - 1] || null;

  for (let index = 0; index < TRACKING_TARGETS.length; index += 1) {
    const target = TRACKING_TARGETS[index];
    const { keyword, hub } = target;
    process.stdout.write(`  [${index + 1}/${TRACKING_TARGETS.length}] "${keyword}" (${hub}, ${target.postNo || 'no-url'}) -> `);

    const ranking = await findRanking(page, target);
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

    if (ranking.rank > 0) console.log(`${displayRank(ranking.rank)}${change}`);
    else if (ranking.rank === 0) console.log(ranking.note || 'TOP 밖');
    else console.log(`오류: ${ranking.error}`);

    results.push({
      trackingId: target.trackingId,
      keyword,
      hub,
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

    if (index < TRACKING_TARGETS.length - 1) await sleep(DELAY_MS);
  }

  console.log('-'.repeat(70));
  history.records.push({ date: today, timestamp: new Date().toISOString(), rankings: results });
  writeJsonFile(HISTORY_PATH, history);
  console.log(`이력 저장: tracking_history.json (v${history.version}, ${history.records.length}회 누적)`);

  generateReport(results, today, history);
  await browser.close();
}

main().catch((err) => {
  console.error('실행 오류:', err.message);
  process.exit(1);
});
