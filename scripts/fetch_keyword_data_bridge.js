#!/usr/bin/env node

require('./lib/env_loader');

const crypto = require('crypto');
const https = require('https');
const { paths } = require('./lib/paths');
const { readJsonFile, writeJsonFile, writeTextFile } = require('./lib/file_store');
const { hasReplacementChar } = require('./lib/public_safety');

const BASE_URL = 'api.searchad.naver.com';
const KEYWORD_TOOL_PATH = '/keywordstool';

function uniqueStrings(values) {
  return [...new Set((values || []).map((value) => String(value || '').trim()).filter(Boolean))];
}

function parseSeeds(argv, defaults) {
  const args = argv || [];
  const equals = args.find((arg) => arg.startsWith('--seeds='));
  const index = args.indexOf('--seeds');
  let raw = null;
  if (equals) raw = equals.slice('--seeds='.length);
  else if (index >= 0) raw = args[index + 1] || '';
  return uniqueStrings(raw === null ? defaults : raw.split(','));
}

function parseVolume(value) {
  if (typeof value === 'number') return { value, estimated: false };
  if (typeof value === 'string') {
    if (value.includes('<')) return { value: 5, estimated: true };
    return { value: Number.parseInt(value, 10) || 0, estimated: false };
  }
  return { value: 0, estimated: false };
}

function keywordRow(item, seed) {
  const pc = parseVolume(item.monthlyPcQcCnt);
  const mobile = parseVolume(item.monthlyMobileQcCnt);
  return {
    keyword: item.relKeyword,
    pcRaw: item.monthlyPcQcCnt,
    mobileRaw: item.monthlyMobileQcCnt,
    pc: pc.value,
    mobile: mobile.value,
    total: pc.value + mobile.value,
    pcEstimated: pc.estimated,
    mobileEstimated: mobile.estimated,
    totalEstimated: pc.estimated || mobile.estimated,
    competition: item.compIdx || '-',
    seedParents: [seed],
  };
}

function mergeSeedResults(seedResults) {
  const byKeyword = new Map();
  (seedResults || []).forEach(({ seed, keywords }) => {
    (keywords || [])
      .filter((item) => item && item.relKeyword && !hasReplacementChar(JSON.stringify(item)))
      .forEach((item) => {
        const existing = byKeyword.get(item.relKeyword);
        if (!existing) {
          byKeyword.set(item.relKeyword, keywordRow(item, seed));
          return;
        }
        existing.seedParents = uniqueStrings([...existing.seedParents, seed]).sort((a, b) => a.localeCompare(b, 'ko'));
      });
  });
  return [...byKeyword.values()].sort((a, b) => b.total - a.total || a.keyword.localeCompare(b.keyword, 'ko'));
}

function formatBridgeResults(rows, metadata) {
  let markdown = '# 문장군 브릿지 부모 키워드 발굴 결과 (네이버 API)\n\n';
  markdown += `> 조회일: ${metadata.data_date}\n`;
  markdown += `> 수집 시드: ${(metadata.seeds || []).join(', ')}\n`;
  markdown += '> 이 시드는 기본 허용 목록이 아니라 이번 수집 시드다. 새로운 부모 키워드는 CLI로 언제든 조회할 수 있다.\n';
  markdown += `> 총 발굴: ${rows.length}개 (중복 제거 후)\n\n`;
  markdown += '| 키워드 | PC | 모바일 | 합계 | 경쟁도 | 발견 시드 |\n';
  markdown += '| --- | ---: | ---: | ---: | --- | --- |\n';
  rows.forEach((item) => {
    markdown += `| ${item.keyword} | ${item.pc} | ${item.mobile} | ${item.total} | ${item.competition} | ${item.seedParents.join(', ')} |\n`;
  });
  return markdown;
}

function signature(secret, timestamp, method, uri) {
  return crypto.createHmac('sha256', secret).update(`${timestamp}.${method}.${uri}`).digest('base64');
}

function fetchKeywordData(seed, credentials) {
  return new Promise((resolve, reject) => {
    const timestamp = Date.now().toString();
    const requestPath = `${KEYWORD_TOOL_PATH}?${new URLSearchParams({ hintKeywords: seed.replace(/\s+/g, ''), showDetail: '1' })}`;
    const request = https.request({
      hostname: BASE_URL,
      path: requestPath,
      method: 'GET',
      headers: {
        'X-Timestamp': timestamp,
        'X-API-KEY': credentials.apiKey,
        'X-Customer': credentials.customerId,
        'X-Signature': signature(credentials.secretKey, timestamp, 'GET', KEYWORD_TOOL_PATH),
        'Content-Type': 'application/json',
      },
    }, (response) => {
      let body = '';
      response.on('data', (chunk) => { body += chunk; });
      response.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          if (Array.isArray(parsed.keywordList)) resolve(parsed.keywordList);
          else if (Array.isArray(parsed)) resolve(parsed);
          else reject(new Error(parsed.message || `검색광고 API 응답 형식 오류 (${response.statusCode})`));
        } catch (error) {
          reject(new Error(`검색광고 API JSON 파싱 실패: ${body.slice(0, 160)}`));
        }
      });
    });
    request.on('error', reject);
    request.end();
  });
}

function buildMetadata(rows, seeds, generatedAt = new Date()) {
  return {
    generated_at: generatedAt.toISOString(),
    data_date: generatedAt.toISOString().slice(0, 10),
    source: 'naver-searchad-keywordstool',
    row_count: rows.length,
    seeds,
    estimate_policy: 'lt10_as_5',
  };
}

async function main() {
  const defaults = readJsonFile(paths.config('bridge_seed_keywords.json'), []);
  const seeds = parseSeeds(process.argv.slice(2), defaults);
  if (seeds.length === 0) {
    console.error('브릿지 수집 시드가 없다. config/bridge_seed_keywords.json 또는 --seeds를 확인하세요.');
    process.exitCode = 1;
    return;
  }

  const credentials = {
    apiKey: process.env.NAVER_AD_API_KEY,
    secretKey: process.env.NAVER_AD_SECRET_KEY,
    customerId: process.env.NAVER_AD_CUSTOMER_ID,
  };
  if (!credentials.apiKey || !credentials.secretKey || !credentials.customerId) {
    console.error('API 인증 정보 없음. 브릿지 데이터 파일을 쓰지 않습니다.');
    process.exitCode = 1;
    return;
  }

  const seedResults = [];
  for (let index = 0; index < seeds.length; index += 1) {
    const seed = seeds[index];
    console.log(`[${index + 1}/${seeds.length}] 브릿지 시드 "${seed}" 조회 중...`);
    try {
      const keywords = await fetchKeywordData(seed, credentials);
      console.log(`  → ${keywords.length}개 발견`);
      seedResults.push({ seed, keywords });
    } catch (error) {
      console.error(`  → 실패: ${error.message}`);
      process.exitCode = 1;
      return;
    }
    if (index < seeds.length - 1) await new Promise((resolve) => setTimeout(resolve, 1100));
  }

  const rows = mergeSeedResults(seedResults);
  if (rows.length === 0) {
    console.error('수집 결과가 없어 브릿지 데이터 파일을 쓰지 않습니다.');
    process.exitCode = 1;
    return;
  }
  const metadata = buildMetadata(rows, seeds);
  writeJsonFile(paths.dataRaw('keyword_data_bridge.json'), rows);
  writeJsonFile(paths.dataRaw('keyword_data_bridge.meta.json'), metadata);
  writeTextFile(paths.dataRaw('keyword_data_bridge.md'), formatBridgeResults(rows, metadata));
  console.log(`브릿지 키워드 ${rows.length}개 저장 완료`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = {
  parseSeeds,
  parseVolume,
  mergeSeedResults,
  formatBridgeResults,
  buildMetadata,
};
