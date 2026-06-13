/**
 * 네이버 검색광고 API - 제품/서비스 핵심 키워드 발굴
 * 
 * ★ 기존 fetch_keyword_data.js(지역 시드)와 별도로,
 *   제품·서비스·고객고민 중심 시드로 새 키워드를 발굴한다.
 * 
 * 실행: node scripts/fetch_keyword_data_product.js
 */

// 환경변수 로드
require('./lib/env_loader');

const crypto = require('crypto');
const https = require('https');
const { paths } = require('./lib/paths');
const { readJsonFile, writeJsonFile, writeTextFile } = require('./lib/file_store');

// ── 설정 ──────────────────────────────────────────
const API_KEY = process.env.NAVER_AD_API_KEY;
const SECRET_KEY = process.env.NAVER_AD_SECRET_KEY;
const CUSTOMER_ID = process.env.NAVER_AD_CUSTOMER_ID;

const BASE_URL = 'api.searchad.naver.com';
const KEYWORD_TOOL_PATH = '/keywordstool';

// ── 제품/서비스 핵심 시드 키워드 ────────────────────────
// 기존 keyword_data.json (2026-05-07)의 15개 시드 + 추가 확장 시드
const SEED_KEYWORDS = readJsonFile(paths.config('product_seed_keywords.json'), []);

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
  const allResults = new Map();

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
    if (val.includes('<')) return 5;
    return parseInt(val, 10) || 0;
  }
  return 0;
}

// ── 문장군 관련 키워드 필터링 ─────────────────────────
function isRelevantKeyword(keyword) {
  const relevantTerms = [
    '중문', '도어', '방문', '문짝', '문틀', '문선', '화장실문', '욕실문',
    '슬라이딩', '스윙', '원슬라이딩', '미닫이', '여닫이', '폴딩',
    '3연동', '4연동', '자동중문', '간살', 'ABS', '멤브레인',
    '현관', '인테리어문', '도어교체', '문교체',
    '걸레받이', '몰딩', '천장몰딩', '천정몰딩',
    '리모델링', '시공', '셀프', '견적', '실측',
    '타일', '습기', '분진', '소음',
    '영림', '문장군', '모루유리', '유리',
  ];
  
  const kw = keyword.toLowerCase();
  return relevantTerms.some(term => kw.includes(term.toLowerCase()));
}

// ── 결과 포맷팅 ─────────────────────────────────────
function formatResults(results) {
  const today = new Date().toISOString().split('T')[0];

  const enriched = results.map(item => {
    const pc = parseVolume(item.monthlyPcQcCnt);
    const mobile = parseVolume(item.monthlyMobileQcCnt);
    return {
      keyword: item.relKeyword,
      pcRaw: item.monthlyPcQcCnt,
      mobileRaw: item.monthlyMobileQcCnt,
      pc: pc,
      mobile: mobile,
      total: pc + mobile,
      competition: item.compIdx || '-',
    };
  });

  enriched.sort((a, b) => b.total - a.total);

  // 문장군 관련 키워드만 필터링
  const relevant = enriched.filter(item => isRelevantKeyword(item.keyword));

  let md = `# 문장군 제품/서비스 키워드 발굴 결과 (네이버 API)\n\n`;
  md += `> 조회일: ${today}\n`;
  md += `> 시드 키워드: ${SEED_KEYWORDS.join(', ')}\n`;
  md += `> 총 발굴: ${enriched.length}개 (중복 제거 후)\n`;
  md += `> 문장군 관련 필터링: ${relevant.length}개\n\n`;

  // 관련 키워드 전체 표 (검색량 100 이상만)
  const filtered100 = relevant.filter(item => item.total >= 100);
  md += `## 문장군 관련 키워드 (검색량 100 이상, ${filtered100.length}개)\n\n`;
  md += `| 순위 | 키워드 | PC | 모바일 | 합계 | 경쟁도 |\n`;
  md += `|------|--------|-----|--------|------|--------|\n`;

  filtered100.forEach((item, i) => {
    md += `| ${i + 1} | ${item.keyword} | ${item.pc} | ${item.mobile} | ${item.total} | ${item.competition} |\n`;
  });

  // 검색량 30~99 구간도 별도 표시 (틈새 키워드)
  const filtered30 = relevant.filter(item => item.total >= 30 && item.total < 100);
  if (filtered30.length > 0) {
    md += `\n## 틈새 키워드 (검색량 30~99, ${filtered30.length}개)\n\n`;
    md += `| 순위 | 키워드 | PC | 모바일 | 합계 | 경쟁도 |\n`;
    md += `|------|--------|-----|--------|------|--------|\n`;
    filtered30.forEach((item, i) => {
      md += `| ${i + 1} | ${item.keyword} | ${item.pc} | ${item.mobile} | ${item.total} | ${item.competition} |\n`;
    });
  }

  // 전체 원본 TOP 100도 별도 포함 (레퍼런스)
  md += `\n## 전체 원본 TOP 100 (필터 없음, 레퍼런스용)\n\n`;
  md += `| 순위 | 키워드 | PC | 모바일 | 합계 | 경쟁도 |\n`;
  md += `|------|--------|-----|--------|------|--------|\n`;
  enriched.slice(0, 100).forEach((item, i) => {
    md += `| ${i + 1} | ${item.keyword} | ${item.pc} | ${item.mobile} | ${item.total} | ${item.competition} |\n`;
  });

  md += `\n## 전체 키워드 수: ${enriched.length}개 (관련: ${relevant.length}개)\n`;

  return { markdown: md, data: enriched, relevant: relevant };
}

// ── 메인 실행 ───────────────────────────────────────
async function main() {
  if (!API_KEY || !SECRET_KEY || !CUSTOMER_ID) {
    console.error(`
❌ API 인증 정보 없음. .env 파일 또는 환경변수를 확인하세요.
    `);
    process.exit(1);
  }

  console.log('🔍 제품/서비스 핵심 시드 키워드에서 연관 키워드 발굴 시작...\n');
  console.log(`📋 시드 키워드 ${SEED_KEYWORDS.length}개: ${SEED_KEYWORDS.join(', ')}\n`);

  const results = await discoverAllKeywords();

  if (results.length === 0) {
    console.log('❌ 조회 결과가 없습니다.');
    return;
  }

  const { markdown, data, relevant } = formatResults(results);

  // 콘솔 출력 (관련 키워드 TOP 30)
  console.log('\n=== 문장군 관련 키워드 TOP 30 (검색량 순) ===\n');
  relevant.slice(0, 30).forEach((item, i) => {
    console.log(`  ${String(i + 1).padStart(2)}. ${item.keyword.padEnd(20)} | PC: ${String(item.pc).padStart(6)} | 모바일: ${String(item.mobile).padStart(6)} | 합계: ${String(item.total).padStart(6)} | 경쟁: ${item.competition}`);
  });

  // 저장
  const jsonPath = paths.dataRaw('keyword_data_product.json');
  writeJsonFile(jsonPath, data);
  console.log(`\n✅ JSON 저장 (전체): ${jsonPath}`);

  const relevantJsonPath = paths.dataProcessed('keyword_data_product_relevant.json');
  writeJsonFile(relevantJsonPath, relevant);
  console.log(`✅ JSON 저장 (관련만): ${relevantJsonPath}`);

  const mdPath = paths.dataRaw('keyword_data_product.md');
  writeTextFile(mdPath, markdown);
  console.log(`✅ 마크다운 저장: ${mdPath}`);

  console.log(`\n📊 총 ${data.length}개 발굴 → 문장군 관련 ${relevant.length}개 필터링 완료!`);
  console.log('👉 이 결과를 기반으로 CONTENT_PLAN Phase 5를 수립합니다.');
}

main().catch(console.error);
