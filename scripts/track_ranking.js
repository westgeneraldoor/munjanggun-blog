/**
 * EXPERIMENTAL: 네이버 블로그 탭 순위 추적 v3.0
 *
 * 현재 결과는 특정 게시물 URL 순위가 아니라 문장군 블로그 계정 첫 등장 위치에 가깝다.
 * URL 기반 추적 구현 전까지 신규 글/리라이팅 자동 판단 근거로 사용하지 않는다.
 * 
 * Puppeteer(헤드리스 Chrome)로 실제 브라우저 렌더링 후 파싱
 * → 시크릿 모드에서 직접 검색한 것과 동일한 결과
 * 
 * 실행: node scripts/track_ranking.js
 */

// 환경변수 로드
require('./lib/env_loader');

const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');
const { paths } = require('./lib/paths');
const { readJsonFile, writeJsonFile, writeTextFile } = require('./lib/file_store');

// 플랫폼별 기본 크롬 실행 파일 경로 자동 탐색 함수
function getPlatformDefaultChromePath() {
  const platform = process.platform;
  
  if (platform === 'win32') {
    const commonPaths = [
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      path.join(process.env.USERPROFILE || 'C:\\Users\\Default', 'AppData\\Local\\Google\\Chrome\\Application\\chrome.exe')
    ];
    for (const p of commonPaths) {
      if (fs.existsSync(p)) return p;
    }
  } else if (platform === 'darwin') {
    const macPath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
    if (fs.existsSync(macPath)) return macPath;
  } else if (platform === 'linux') {
    const linuxPaths = [
      '/usr/bin/google-chrome',
      '/usr/bin/chromium',
      '/usr/bin/chromium-browser'
    ];
    for (const p of linuxPaths) {
      if (fs.existsSync(p)) return p;
    }
  }
  
  // 찾지 못한 경우 기본 윈도우 설치 경로 폴백
  return 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
}

const appConfig = readJsonFile(paths.config('app.json'), {});
const BLOG_ID = process.env.NAVER_BLOG_ID || appConfig.defaultBlogId || 'doorgeneral';
const CHROME_PATH = process.env.CHROME_PATH || getPlatformDefaultChromePath();
const DELAY_MS = Number(process.env.TRACKING_DELAY_MS || appConfig.trackingDelayMs || 2000);

// ── 추적 대상 키워드 (POSTING_REGISTRY 전체 — 중복제거 53개) ──────
const TRACKING_KEYWORDS = readJsonFile(paths.config('tracking_keywords.json'), []);

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ── Puppeteer로 블로그 탭 순위 조회 ──────────────────────
async function findRanking(page, keyword) {
  try {
    const url = `https://search.naver.com/search.naver?ssc=tab.blog.all&sm=tab_jum&query=${encodeURIComponent(keyword)}`;
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 15000 });
    await sleep(1500); // JS 렌더링 대기

    // 렌더링된 DOM에서 블로그 링크 추출
    const blogIds = await page.evaluate((targetBlogId) => {
      const results = [];
      const seen = new Set();

      // 모든 a 태그에서 blog.naver.com 링크 찾기
      const links = document.querySelectorAll('a[href*="blog.naver.com"]');
      for (const link of links) {
        const href = link.getAttribute('href') || '';
        const match = href.match(/blog\.naver\.com\/([a-zA-Z0-9_]+)/);
        if (match) {
          const blogId = match[1];
          if (['PostView', 'PostList', 'NBlogTop', 'prologue'].includes(blogId)) continue;
          if (blogId.length < 3) continue;
          if (!seen.has(blogId)) {
            seen.add(blogId);
            // 제목도 함께 추출 시도
            const parentItem = link.closest('.lst, .api_txt_lines, [class*="item"], [class*="card"]');
            const titleEl = parentItem ? parentItem.querySelector('a.api_txt_lines, .title_link, .sub_txt') : null;
            results.push({
              blogId,
              title: titleEl ? titleEl.textContent.trim().substring(0, 60) : '',
            });
          }
        }
      }
      return results;
    }, BLOG_ID);

    // 우리 블로그 찾기
    for (let i = 0; i < blogIds.length; i++) {
      if (blogIds[i].blogId === BLOG_ID) {
        return { rank: i + 1, title: blogIds[i].title, totalFound: blogIds.length };
      }
    }

    return { rank: 0, totalFound: blogIds.length, note: `TOP ${blogIds.length} 밖` };
  } catch (err) {
    return { rank: -1, error: err.message };
  }
}

// ── 이력 & 리포트 ──────────────────────────────────────
const HISTORY_PATH = paths.dataProcessed('tracking_history.json');

function loadHistory() {
  const version = appConfig.rankingHistoryVersion || 3;
  const data = readJsonFile(HISTORY_PATH, { version, records: [] });
  if (data.version === version && Array.isArray(data.records)) return data;
  return { version, records: [] };
}

function generateReport(results, today, history) {
  let md = `# 📊 순위 추적 리포트 (v3 — Puppeteer 실제 렌더링)\n\n`;
  md += `> 조회일: ${today}\n`;
  md += `> 블로그: https://blog.naver.com/${BLOG_ID}\n`;
  md += `> 방식: 헤드리스 Chrome으로 실제 블로그 탭 렌더링 → 시크릿 모드와 동일\n\n`;

  const ranked = results.filter(r => r.rank > 0);
  const top5 = results.filter(r => r.rank > 0 && r.rank <= 5);
  const top10 = results.filter(r => r.rank > 0 && r.rank <= 10);

  md += `## 요약\n`;
  md += `| 항목 | 수치 |\n|------|------|\n`;
  md += `| 추적 키워드 | ${results.length}개 |\n`;
  md += `| 노출 중 | ${ranked.length}개 |\n`;
  md += `| TOP 5 | ${top5.length}개 |\n`;
  md += `| TOP 10 | ${top10.length}개 |\n\n`;

  md += `## 키워드별 순위\n\n`;
  md += `| 허브 | 키워드 | 순위 | 비고 |\n`;
  md += `|------|--------|------|------|\n`;
  results.forEach(r => {
    const rankStr = r.rank > 0 ? `${r.rank}위` : (r.rank === 0 ? r.note || 'TOP30밖' : '오류');
    md += `| ${r.hub} | ${r.keyword} | **${rankStr}** | ${r.title || ''} |\n`;
  });

  // 추이
  if (history.records.length > 1) {
    const recent = history.records.slice(-7);
    const keywords = [...new Set(results.map(r => r.keyword))];
    md += `\n## 순위 추이 (최근 ${recent.length}회)\n\n| 키워드 |`;
    recent.forEach(rec => { md += ` ${rec.date} |`; });
    md += `\n|--------|`;
    recent.forEach(() => { md += `------|`; });
    md += `\n`;
    keywords.forEach(kw => {
      md += `| ${kw} |`;
      recent.forEach(rec => {
        const f = rec.rankings.find(r => r.keyword === kw);
        md += f && f.rank > 0 ? ` ${f.rank}위 |` : ` - |`;
      });
      md += `\n`;
    });
  }

  const reportPath = paths.outputReport('ranking_report.md');
  writeTextFile(reportPath, md);
  console.log(`\n✅ 리포트 저장: ${reportPath}`);
}

// ── 메인 ────────────────────────────────────────────
async function main() {
  const today = new Date().toISOString().split('T')[0];
  console.log(`\n🔍 문장군 블로그 순위 추적 v3.0 — ${today}`);
  console.log(`블로그: https://blog.naver.com/${BLOG_ID}`);
  console.log(`방식: Puppeteer 헤드리스 Chrome (시크릿 모드 동일)`);
  console.log(`추적 키워드: ${TRACKING_KEYWORDS.length}개\n${'─'.repeat(70)}`);

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

  for (let i = 0; i < TRACKING_KEYWORDS.length; i++) {
    const { keyword, hub } = TRACKING_KEYWORDS[i];
    process.stdout.write(`  [${i + 1}/${TRACKING_KEYWORDS.length}] "${keyword}" (${hub}) → `);

    const ranking = await findRanking(page, keyword);

    let change = '';
    if (lastRecord) {
      const prev = lastRecord.rankings.find(r => r.keyword === keyword);
      if (prev && prev.rank > 0 && ranking.rank > 0) {
        const diff = prev.rank - ranking.rank;
        if (diff > 0) change = ` (↑${diff})`;
        else if (diff < 0) change = ` (↓${Math.abs(diff)})`;
        else change = ' (→)';
      } else if (!prev && ranking.rank > 0) {
        change = ' (NEW)';
      }
    }

    if (ranking.rank > 0) {
      console.log(`${ranking.rank}위${change}`);
    } else if (ranking.rank === 0) {
      console.log(ranking.note || 'TOP 밖');
    } else {
      console.log(`❌ ${ranking.error}`);
    }

    results.push({
      keyword, hub,
      rank: ranking.rank,
      title: ranking.title || '',
      note: ranking.note || '',
      totalFound: ranking.totalFound || 0,
    });

    if (i < TRACKING_KEYWORDS.length - 1) await sleep(DELAY_MS);
  }

  console.log('─'.repeat(70));

  history.records.push({ date: today, timestamp: new Date().toISOString(), rankings: results });
  writeJsonFile(HISTORY_PATH, history);
  console.log(`✅ 이력 저장: tracking_history.json (v3, ${history.records.length}회 누적)`);

  generateReport(results, today, history);

  await browser.close();
}

main().catch(err => { console.error('❌ 실행 오류:', err.message); process.exit(1); });
