/**
 * 네이버 블로그 TOP 10 분석기
 * 
 * 키워드별 상위 10개 글을 분석 → "이기는 글의 공식" 도출
 * - 제목 패턴 (숫자? 질문형? 길이?)
 * - 발행일 (최신성이 중요한 키워드인지?)
 * - 우리 글 위치
 * 
 * 실행:
 *   $env:NAVER_CLIENT_ID="..."
 *   $env:NAVER_CLIENT_SECRET="..."
 *   node scripts/analyze_top10.js
 */

const https = require('https');

// ── 환경변수 로드 ────────────────────────────────────
require('./lib/env_loader');
const { paths } = require('./lib/paths');
const { readJsonFile, writeTextFile } = require('./lib/file_store');

const CLIENT_ID = process.env.NAVER_CLIENT_ID;
const CLIENT_SECRET = process.env.NAVER_CLIENT_SECRET;
const appConfig = readJsonFile(paths.config('app.json'), {});
const BLOG_ID = process.env.NAVER_BLOG_ID || appConfig.defaultBlogId || 'doorgeneral';

// ── 분석 대상 키워드 ────────────────────────────────
const KEYWORDS = readJsonFile(paths.config('top10_keywords.json'), []);

// ── API 호출 ────────────────────────────────────────
function searchBlog(query) {
  return new Promise((resolve, reject) => {
    const params = new URLSearchParams({ query, display: '10', start: '1', sort: 'sim' });
    const options = {
      hostname: 'openapi.naver.com',
      path: `/v1/search/blog.json?${params.toString()}`,
      method: 'GET',
      headers: { 'X-Naver-Client-Id': CLIENT_ID, 'X-Naver-Client-Secret': CLIENT_SECRET },
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

// ── 제목 패턴 분석 ──────────────────────────────────
function analyzeTitle(rawTitle) {
  const title = rawTitle.replace(/<[^>]*>/g, ''); // HTML 태그 제거
  return {
    title,
    length: title.length,
    hasNumber: /\d/.test(title),
    numberValue: (title.match(/\d+/) || [null])[0],
    isQuestion: /[?？]/.test(title) || /할까|인가|일까|는지|뭘까|어떨까/.test(title),
    isList: /\d+가지|\d+개|\d+선|TOP|BEST/.test(title),
    isHowTo: /방법|하는법|하기|비결|노하우|팁/.test(title),
    hasPrice: /가격|비용|견적|얼마/.test(title),
    hasComparison: /비교|차이|vs|VS/.test(title),
    hasBefore: /전에|전 |먼저|확인/.test(title),
  };
}

// ── 발행일 분석 ──────────────────────────────────────
function analyzeFreshness(postdate) {
  // postdate: "20260508"
  if (!postdate || postdate.length !== 8) return { daysAgo: -1, freshness: '알수없음' };
  const y = postdate.substring(0, 4);
  const m = postdate.substring(4, 6);
  const d = postdate.substring(6, 8);
  const postDate = new Date(`${y}-${m}-${d}`);
  const now = new Date();
  const days = Math.floor((now - postDate) / (1000 * 60 * 60 * 24));

  let freshness;
  if (days <= 7) freshness = '🟢 1주 이내';
  else if (days <= 30) freshness = '🟡 1달 이내';
  else if (days <= 90) freshness = '🟠 3달 이내';
  else freshness = '🔴 3달+';

  return { daysAgo: days, freshness };
}

// ── 메인 ────────────────────────────────────────────
async function main() {
  if (!CLIENT_ID || !CLIENT_SECRET) {
    console.error('❌ 환경변수 NAVER_CLIENT_ID, NAVER_CLIENT_SECRET 설정 필요');
    process.exit(1);
  }

  const today = new Date().toISOString().split('T')[0];
  console.log(`\n📊 TOP 10 분석 — ${today}\n`);

  const allResults = [];

  for (let i = 0; i < KEYWORDS.length; i++) {
    const { keyword, hub } = KEYWORDS[i];
    console.log(`[${i + 1}/${KEYWORDS.length}] "${keyword}" (${hub}) 분석 중...`);

    const result = await searchBlog(keyword);
    if (result.errorCode) {
      console.log(`  ❌ ${result.errorMessage}`);
      continue;
    }

    const items = (result.items || []).slice(0, 10);
    const analyzed = items.map((item, idx) => {
      const titleInfo = analyzeTitle(item.title);
      const freshInfo = analyzeFreshness(item.postdate);
      const isOurs = (item.link || '').includes(BLOG_ID);
      return { rank: idx + 1, ...titleInfo, ...freshInfo, bloggername: item.bloggername, isOurs };
    });

    allResults.push({ keyword, hub, total: result.total, items: analyzed });

    if (i < KEYWORDS.length - 1) await new Promise(r => setTimeout(r, 300));
  }

  // ── 패턴 집계 ──────────────────────────────────────
  const patterns = { number: 0, question: 0, list: 0, howto: 0, price: 0, comparison: 0, before: 0, total: 0 };
  const freshCounts = { '🟢 1주 이내': 0, '🟡 1달 이내': 0, '🟠 3달 이내': 0, '🔴 3달+': 0 };
  const titleLengths = [];

  allResults.forEach(kw => {
    kw.items.forEach(item => {
      patterns.total++;
      if (item.hasNumber) patterns.number++;
      if (item.isQuestion) patterns.question++;
      if (item.isList) patterns.list++;
      if (item.isHowTo) patterns.howto++;
      if (item.hasPrice) patterns.price++;
      if (item.hasComparison) patterns.comparison++;
      if (item.hasBefore) patterns.before++;
      if (freshCounts[item.freshness] !== undefined) freshCounts[item.freshness]++;
      titleLengths.push(item.length);
    });
  });

  if (patterns.total === 0) {
    throw new Error('TOP 10 분석 결과가 비어 있어 리포트를 생성할 수 없습니다.');
  }

  const avgLength = Math.round(titleLengths.reduce((a, b) => a + b, 0) / titleLengths.length);

  // ── 리포트 생성 ────────────────────────────────────
  let md = `# 📊 TOP 10 분석 리포트\n\n`;
  md += `> 분석일: ${today}\n`;
  md += `> 분석 키워드: ${KEYWORDS.length}개\n\n`;

  // 승리 공식 요약
  md += `## 🏆 상위 글의 승리 공식\n\n`;
  md += `### 제목 패턴 (상위 ${patterns.total}개 글 기준)\n\n`;
  md += `| 패턴 | 비율 | 해석 |\n`;
  md += `|------|------|------|\n`;
  md += `| 숫자 포함 ("3가지", "5개") | **${Math.round(patterns.number / patterns.total * 100)}%** | ${patterns.number / patterns.total > 0.4 ? '✅ 숫자 제목이 유리' : '보통'} |\n`;
  md += `| 질문형 ("~할까?") | **${Math.round(patterns.question / patterns.total * 100)}%** | ${patterns.question / patterns.total > 0.3 ? '✅ 질문형이 유리' : '보통'} |\n`;
  md += `| 리스트형 ("N가지/N선") | **${Math.round(patterns.list / patterns.total * 100)}%** | ${patterns.list / patterns.total > 0.3 ? '✅ 리스트형이 유리' : '보통'} |\n`;
  md += `| 하우투 ("방법/노하우") | **${Math.round(patterns.howto / patterns.total * 100)}%** | - |\n`;
  md += `| 가격/비용 언급 | **${Math.round(patterns.price / patterns.total * 100)}%** | - |\n`;
  md += `| 비교형 ("비교/vs") | **${Math.round(patterns.comparison / patterns.total * 100)}%** | - |\n`;
  md += `| 사전확인형 ("전에/확인") | **${Math.round(patterns.before / patterns.total * 100)}%** | - |\n`;
  md += `| 평균 제목 길이 | **${avgLength}자** | - |\n\n`;

  // 최신성 분석
  md += `### 최신성 분석\n\n`;
  md += `| 발행 시기 | 상위 글 수 | 비율 |\n`;
  md += `|----------|----------|------|\n`;
  Object.entries(freshCounts).forEach(([label, count]) => {
    md += `| ${label} | ${count}개 | ${Math.round(count / patterns.total * 100)}% |\n`;
  });
  md += `\n`;

  // 키워드별 상세
  md += `---\n\n## 키워드별 TOP 10 상세\n\n`;

  allResults.forEach(kw => {
    md += `### "${kw.keyword}" (${kw.hub}) — 전체 ${kw.total?.toLocaleString()}개 글\n\n`;
    md += `| 순위 | 제목 | 블로거 | 발행 | 우리글 |\n`;
    md += `|------|------|--------|------|--------|\n`;
    kw.items.forEach(item => {
      const ours = item.isOurs ? '⭐' : '';
      md += `| ${item.rank} | ${item.title} | ${item.bloggername} | ${item.freshness} (${item.daysAgo}일전) | ${ours} |\n`;
    });
    md += `\n`;
  });

  // 액션 제안
  md += `---\n\n## 💡 블로그엔진 튜닝 제안\n\n`;
  if (patterns.number / patterns.total > 0.4) {
    md += `- ✅ **제목에 숫자 넣기** — 상위 글의 ${Math.round(patterns.number / patterns.total * 100)}%가 숫자 포함\n`;
  }
  if (patterns.question / patterns.total > 0.3) {
    md += `- ✅ **질문형 제목** — 상위 글의 ${Math.round(patterns.question / patterns.total * 100)}%가 질문형\n`;
  }
  if (avgLength > 20 && avgLength < 35) {
    md += `- ✅ **제목 ${avgLength}자 내외** — 상위 글 평균 길이\n`;
  }
  const freshPercent = Math.round((freshCounts['🟢 1주 이내'] + freshCounts['🟡 1달 이내']) / patterns.total * 100);
  if (freshPercent > 50) {
    md += `- ⚠️ **최신성 중요** — 상위 글의 ${freshPercent}%가 1달 이내 발행. 주기적 리라이팅 필요\n`;
  } else {
    md += `- 📌 **품질 우선** — 오래된 글도 상위에 있음. 한 번 잘 쓰면 오래 간다\n`;
  }

  const reportPath = paths.outputReport('top10_analysis.md');
  writeTextFile(reportPath, md);
  console.log(`\n✅ 분석 리포트 저장: ${reportPath}`);
}

main().catch(console.error);
