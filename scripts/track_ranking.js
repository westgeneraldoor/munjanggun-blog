/**
 * 네이버 블로그 탭 실제 순위 추적 v3.0
 * 
 * Puppeteer(헤드리스 Chrome)로 실제 브라우저 렌더링 후 파싱
 * → 시크릿 모드에서 직접 검색한 것과 동일한 결과
 * 
 * 실행: node scripts/track_ranking.js
 */

// 환경변수 로드
require('./utils/env_loader');

const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

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

const BLOG_ID = process.env.NAVER_BLOG_ID || 'doorgeneral';
const CHROME_PATH = process.env.CHROME_PATH || getPlatformDefaultChromePath();
const DELAY_MS = 2000;

// ── 추적 대상 키워드 (POSTING_REGISTRY 전체 — 중복제거 53개) ──────
const TRACKING_KEYWORDS = [
  // ── 허브 H1: 중문 (001) ──
  { keyword: '아파트중문', hub: 'H1' },
  { keyword: '현관중문', hub: 'H1/H3' },
  { keyword: '아파트 현관 중문', hub: 'H1/H3' },
  { keyword: '중문 설치', hub: 'H1' },
  { keyword: '아파트 중문 설치', hub: 'H1' },
  // ── 허브 H2: 3연동중문 (002) ──
  { keyword: '3연동중문', hub: 'H2' },
  { keyword: '3연동 중문 설치', hub: 'H2' },
  { keyword: '3연동중문 설치 비용', hub: 'H2' },
  { keyword: '초슬림 3연동중문', hub: 'H2' },
  // ── 허브 H3: 현관중문 (003) ──
  { keyword: '현관 중문 종류', hub: 'H3' },
  { keyword: '좁은 현관 중문', hub: 'H3' },
  // ── 허브 H4: 방문교체 (004) ──
  { keyword: '방문교체', hub: 'H4' },
  { keyword: '아파트 방문 교체', hub: 'H4' },
  { keyword: '살면서 방문교체', hub: 'H4' },
  // ── 허브 H5: ABS도어 (005) ──
  { keyword: 'ABS도어', hub: 'H5' },
  { keyword: 'ABS도어 방문 교체', hub: 'H5' },
  { keyword: '멤브레인 도어', hub: 'H5' },
  { keyword: '타공도어', hub: 'H5/022' },
  // ── 006: 아파트중문 (거주중시공) ──
  { keyword: '거주중시공', hub: '006' },
  { keyword: '아파트 현관 중문 설치', hub: '006' },
  { keyword: '살면서 중문', hub: '006' },
  // ── 007: 화장실문교체 ──
  { keyword: '화장실문교체', hub: '007' },
  { keyword: '화장실문', hub: '007/013' },
  { keyword: '문틀교체', hub: '007' },
  // ── 010: 문짝교체비용 ──
  { keyword: '문짝교체비용', hub: '010' },
  { keyword: '방문교체비용', hub: '010' },
  // ── 011: 문장군중문 (브랜드) ──
  { keyword: '문장군중문', hub: '011' },
  { keyword: '문장군', hub: '011' },
  { keyword: '중문시공업체', hub: '011' },
  { keyword: '방문실측', hub: '011' },
  // ── 012: 원슬라이딩중문 ──
  { keyword: '원슬라이딩중문', hub: '012' },
  { keyword: '슬라이딩도어', hub: '012' },
  // ── 014: 중문가격 ──
  { keyword: '중문가격', hub: '014' },
  { keyword: '중문설치비용', hub: '014/018' },
  // ── 015: 셀프중문 ──
  { keyword: '셀프중문', hub: '015' },
  { keyword: '중문셀프시공', hub: '015' },
  // ── 016: 초슬림3연동중문 ──
  { keyword: '초슬림3연동중문', hub: '016' },
  { keyword: '아파트현관중문', hub: '016/020' },
  { keyword: '좁은현관중문', hub: '016/020/021' },
  // ── 017: 문짝교체 ──
  { keyword: '문짝교체', hub: '017' },
  { keyword: '도어교체', hub: '017' },
  // ── 018: 아파트중문설치비용 ──
  { keyword: '아파트중문설치비용', hub: '018' },
  // ── 019: 아파트중문가격 ──
  { keyword: '아파트중문가격', hub: '019' },
  { keyword: '중문견적', hub: '019' },
  { keyword: '3연동중문가격', hub: '019' },
  { keyword: '현관중문비용', hub: '019' },
  // ── 020: 좁은현관중문 ──
  { keyword: '천안중문', hub: '020' },
  // ── 021: 스윙도어 ──
  { keyword: '스윙도어', hub: '021' },
  { keyword: '스윙도어중문', hub: '021' },
  // ── 022: 욕실문교체 ──
  { keyword: '욕실문교체', hub: '022' },
];

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
const HISTORY_PATH = path.join(__dirname, '..', 'tracking_history.json');

function loadHistory() {
  if (fs.existsSync(HISTORY_PATH)) {
    const data = JSON.parse(fs.readFileSync(HISTORY_PATH, 'utf-8'));
    if (data.version === 3) return data;
  }
  return { version: 3, records: [] };
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

  fs.writeFileSync(path.join(__dirname, '..', 'ranking_report.md'), md, 'utf-8');
  console.log(`\n✅ 리포트 저장: ranking_report.md`);
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
  fs.writeFileSync(HISTORY_PATH, JSON.stringify(history, null, 2), 'utf-8');
  console.log(`✅ 이력 저장: tracking_history.json (v3, ${history.records.length}회 누적)`);

  generateReport(results, today, history);

  await browser.close();
}

main().catch(err => { console.error('❌ 실행 오류:', err.message); process.exit(1); });
