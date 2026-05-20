/**
 * 네이버 검색광고 API - 키워드 발굴 + 검색량 조회
 * 
 * ★ 핵심: 대형 시드 키워드를 넣으면 → 연관 키워드를 자동 발굴 + 검색량 정렬
 * 
 * 실행: node scripts/fetch_keyword_data.js
 */

// 환경변수 로드
require('./utils/env_loader');

const crypto = require('crypto');
const https = require('https');
const fs = require('fs');
const path = require('path');

// ── 설정 ──────────────────────────────────────────
const API_KEY = process.env.NAVER_AD_API_KEY;
const SECRET_KEY = process.env.NAVER_AD_SECRET_KEY;
const CUSTOMER_ID = process.env.NAVER_AD_CUSTOMER_ID;

const BASE_URL = 'api.searchad.naver.com';
const KEYWORD_TOOL_PATH = '/keywordstool';

// ── 대형 시드 키워드 (여기서 연관 키워드를 뽑아냄) ────────
const SEED_KEYWORDS = [
  '서울중문', '수원중문', '대전중문', '청주중문', '세종중문',
  '성남중문', '분당중문', '평택중문', '인천중문', '화성중문',
  '용인중문', '안양중문', '안산중문', '남양주중문',
  '수원방문교체', '서울방문교체', '대전방문교체',
  '천안방문교체', '인천방문교체',
];

// ── HMAC 서명 생성 ──────────────────────────────────
function generateSignature(timestamp, method, uri) {
  const hmac = crypto.createHmac('sha256', SECRET_KEY);
  hmac.update(`${timestamp}.${method}.${uri}`);
  return hmac.digest('base64');
}

// ── API 요청 (시드 1개씩) ────────────────────────────
function fetchKeywordData(seedKeyword) {
  return new Promise((resolve, reject) => {
    const timestamp = Date.now().toString();
    const method = 'GET';
    const signature = generateSignature(timestamp, method, KEYWORD_TOOL_PATH);

    // 공백 제거
    const hint = seedKeyword.replace(/\s+/g, '');
    const queryParams = new URLSearchParams({
      hintKeywords: hint,
      showDetail: '1',
    });

    const requestPath = `${KEYWORD_TOOL_PATH}?${queryParams.toString()}`;

    const options = {
      hostname: BASE_URL,
      path: requestPath,
      method: method,
      headers: {
        'X-Timestamp': timestamp,
        'X-API-KEY': API_KEY,
        'X-Customer': CUSTOMER_ID,
        'X-Signature': signature,
        'Content-Type': 'application/json',
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.keywordList) {
            resolve(parsed.keywordList);
          } else if (Array.isArray(parsed)) {
            resolve(parsed);
          } else if (parsed.code) {
            console.warn(`  ⚠️ [${hint}] API 에러: ${parsed.message}`);
            resolve([]);
          } else {
            resolve([]);
          }
        } catch (e) {
          reject(new Error(`JSON 파싱 실패: ${data.substring(0, 200)}`));
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

// ── 전체 시드 키워드 순회 ────────────────────────────
async function discoverAllKeywords() {
  const allResults = new Map(); // 중복 제거용

  for (let i = 0; i < SEED_KEYWORDS.length; i++) {
    const seed = SEED_KEYWORDS[i];
    console.log(`[${i + 1}/${SEED_KEYWORDS.length}] 시드 "${seed}" → 연관 키워드 발굴 중...`);

    try {
      const keywords = await fetchKeywordData(seed);
      console.log(`  → ${keywords.length}개 연관 키워드 발견`);

      keywords.forEach(item => {
        const key = item.relKeyword;
        if (!allResults.has(key)) {
          allResults.set(key, item);
        }
      });
    } catch (err) {
      console.error(`  ❌ 오류: ${err.message}`);
    }

    // API 속도 제한: 1초 대기
    if (i < SEED_KEYWORDS.length - 1) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  return Array.from(allResults.values());
}

// ── 검색량 파싱 (< 10 처리) ─────────────────────────
function parseVolume(val) {
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    if (val.includes('<')) return 5; // "< 10" → 5로 추정
    return parseInt(val, 10) || 0;
  }
  return 0;
}

// ── 결과 포맷팅 ─────────────────────────────────────
function formatResults(results) {
  const today = new Date().toISOString().split('T')[0];

  // 검색량 합계 계산 + 정렬
  const enriched = results.map(item => {
    const pc = parseVolume(item.monthlyPcQcCnt);
    const mobile = parseVolume(item.monthlyMobileQcCnt);
    return {
      keyword: item.relKeyword,
      pcRaw: item.monthlyPcQcCnt,
      mobileRaw: item.monthlyMobileQcCnt,
      pc: pc,
      mobile: mobile,
      pcNum: pc,
      mobileNum: mobile,
      total: pc + mobile,
      competition: item.compIdx || '-',
    };
  });

  // 검색량 합계 내림차순 정렬
  enriched.sort((a, b) => b.total - a.total);

  // 마크다운 생성
  let md = `# 문장군 키워드 발굴 결과 (네이버 API)\n\n`;
  md += `> 조회일: ${today}\n`;
  md += `> 시드 키워드: ${SEED_KEYWORDS.join(', ')}\n`;
  md += `> 총 발굴: ${enriched.length}개 (중복 제거 후)\n\n`;

  // TOP 50만 표시
  const top = enriched.slice(0, 50);
  md += `## TOP 50 키워드 (검색량 순)\n\n`;
  md += `| 순위 | 키워드 | PC | 모바일 | 합계(추정) | 경쟁도 |\n`;
  md += `|------|--------|-----|--------|-----------|--------|\n`;

  top.forEach((item, i) => {
    md += `| ${i + 1} | ${item.keyword} | ${item.pc} | ${item.mobile} | ${item.total} | ${item.competition} |\n`;
  });

  // 50~100위도 별도 표
  if (enriched.length > 50) {
    const next50 = enriched.slice(50, 100);
    md += `\n## 51~100위 키워드\n\n`;
    md += `| 순위 | 키워드 | PC | 모바일 | 합계(추정) | 경쟁도 |\n`;
    md += `|------|--------|-----|--------|-----------|--------|\n`;
    next50.forEach((item, i) => {
      md += `| ${i + 51} | ${item.keyword} | ${item.pc} | ${item.mobile} | ${item.total} | ${item.competition} |\n`;
    });
  }

  // 전체 데이터
  md += `\n## 전체 키워드 수: ${enriched.length}개\n`;

  return { markdown: md, data: enriched };
}

// ── 메인 실행 ───────────────────────────────────────
async function main() {
  if (!API_KEY || !SECRET_KEY || !CUSTOMER_ID) {
    console.error(`
❌ API 인증 정보 없음. 환경변수를 설정하세요:
  $env:NAVER_AD_API_KEY="..."
  $env:NAVER_AD_SECRET_KEY="..."
  $env:NAVER_AD_CUSTOMER_ID="..."
    `);
    process.exit(1);
  }

  console.log('🔍 대형 시드 키워드에서 연관 키워드 발굴 시작...\n');

  const results = await discoverAllKeywords();

  if (results.length === 0) {
    console.log('❌ 조회 결과가 없습니다.');
    return;
  }

  const { markdown, data } = formatResults(results);

  // 콘솔 출력 (TOP 30만)
  console.log('\n=== TOP 30 키워드 (검색량 순) ===\n');
  data.slice(0, 30).forEach((item, i) => {
    console.log(`  ${String(i + 1).padStart(2)}. ${item.keyword.padEnd(20)} | PC: ${String(item.pc).padStart(6)} | 모바일: ${String(item.mobile).padStart(6)} | 합계: ${String(item.total).padStart(6)} | 경쟁: ${item.competition}`);
  });

  // 저장
  const jsonPath = path.join(__dirname, '..', 'keyword_data_지역.json');
  fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2), 'utf-8');
  console.log(`\n✅ JSON 저장: ${jsonPath}`);

  const mdPath = path.join(__dirname, '..', 'keyword_data_지역.md');
  fs.writeFileSync(mdPath, markdown, 'utf-8');
  console.log(`✅ 마크다운 저장: ${mdPath}`);

  console.log(`\n📊 총 ${data.length}개 키워드 발굴 완료!`);
  console.log('👉 이 결과를 기반으로 SEO_KEYWORD_RESEARCH.md와 CONTENT_PLAN.md를 재수립합니다.');
}

main().catch(console.error);
