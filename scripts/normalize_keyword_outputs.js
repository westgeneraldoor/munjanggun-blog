const fs = require('fs');
const path = require('path');
const { paths } = require('./lib/paths');
const { readJsonFile, writeJsonFile, writeTextFile } = require('./lib/file_store');
const { hasReplacementChar } = require('./lib/public_safety');

const TODAY = new Date().toISOString().slice(0, 10);
const LEGACY_DATA_DATE = '2026-05-07';

const RELEVANT_TERMS = [
  '중문', '도어', '방문', '문짝', '문틀', '문선', '화장실문', '욕실문',
  '슬라이딩', '스윙', '원슬라이딩', '미닫이', '여닫이', '폴딩',
  '3연동', '4연동', '자동중문', '간살', 'ABS', '멤브레인',
  '현관', '인테리어문', '도어교체', '문교체',
  '걸레받이', '몰딩', '천장몰딩', '천정몰딩',
  '리모델링', '시공', '셀프', '견적', '실측',
  '타일', '습기', '분진', '소음',
  '영림', '문장군', '모루유리', '유리',
];

function parseVolume(raw, fallback) {
  if (typeof raw === 'string' && raw.includes('<')) return { value: 5, estimated: true };
  if (typeof fallback === 'number') return { value: fallback, estimated: false };
  if (typeof raw === 'number') return { value: raw, estimated: false };
  const parsed = parseInt(raw, 10);
  return { value: Number.isFinite(parsed) ? parsed : 0, estimated: false };
}

function normalizeRows(rows, options = {}) {
  const addEstimateFlags = options.addEstimateFlags !== false;
  return rows
    .filter((row) => !hasReplacementChar(JSON.stringify(row)))
    .map((row) => {
      const pc = parseVolume(row.pcRaw, row.pc ?? row.pcNum);
      const mobile = parseVolume(row.mobileRaw, row.mobile ?? row.mobileNum);
      const normalized = { ...row };
      normalized.pc = pc.value;
      normalized.mobile = mobile.value;
      if ('pcNum' in normalized) normalized.pcNum = pc.value;
      if ('mobileNum' in normalized) normalized.mobileNum = mobile.value;
      normalized.total = pc.value + mobile.value;
      if (addEstimateFlags) {
        normalized.pcEstimated = pc.estimated;
        normalized.mobileEstimated = mobile.estimated;
        normalized.totalEstimated = pc.estimated || mobile.estimated;
      } else {
        delete normalized.pcEstimated;
        delete normalized.mobileEstimated;
        delete normalized.totalEstimated;
      }
      return normalized;
    })
    .sort((a, b) => (b.total || 0) - (a.total || 0));
}

function extractDataDateFromMarkdown(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const match = fs.readFileSync(filePath, 'utf8').match(/조회일:\s*(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
}

function sourceDataDate(metaPath, markdownPath, fallback = TODAY) {
  const meta = readJsonFile(metaPath, null);
  if (meta && /^\d{4}-\d{2}-\d{2}$/.test(String(meta.data_date || ''))) return meta.data_date;
  return extractDataDateFromMarkdown(markdownPath) || fallback;
}

function metadata(rowCount, dataDate, options = {}) {
  const generatedAt = options.generatedAt || new Date();
  return {
    generated_at: generatedAt.toISOString(),
    data_date: dataDate,
    source: 'naver-searchad-keywordstool',
    row_count: rowCount,
    estimate_policy: options.estimatePolicy || 'lt10_as_5',
  };
}

function renderKeywordTable({ title, rows, subtitle, dataDate, limit = 100 }) {
  let md = `# ${title}\n\n`;
  md += `> 조회일: ${dataDate}\n`;
  if (subtitle) md += `> ${subtitle}\n`;
  md += `> 깨진 문자 포함 행은 공개 산출물 안전 기준에 따라 제외\n\n`;
  md += `| 순위 | 키워드 | PC | 모바일 | 합계(추정) | 경쟁도 |\n`;
  md += `| ---: | --- | ---: | ---: | ---: | --- |\n`;
  rows.slice(0, limit).forEach((row, index) => {
    md += `| ${index + 1} | ${row.keyword} | ${row.pc} | ${row.mobile} | ${row.total} | ${row.competition || '-'} |\n`;
  });
  md += `\n## 전체 키워드 수: ${rows.length}개\n`;
  return md;
}

function isRelevant(row) {
  const keyword = String(row.keyword || '').toLowerCase();
  return RELEVANT_TERMS.some((term) => keyword.includes(term.toLowerCase()));
}

function regionalBaseName() {
  return fs.readdirSync(paths.dataRaw(''))
    .find((name) => name.startsWith('keyword_data_') && name.endsWith('.json') && !name.endsWith('.meta.json') && name !== 'keyword_data_product.json')
    .replace(/\.json$/, '');
}

function normalizeRegional() {
  const base = regionalBaseName();
  const dataDate = sourceDataDate(
    paths.dataRaw(`${base}.meta.json`),
    paths.dataRaw(`${base}.md`)
  );
  const rows = normalizeRows(readJsonFile(paths.dataRaw(`${base}.json`), []));
  const rows30 = rows.filter((row) => row.total >= 30);
  const meta = metadata(rows.length, dataDate);
  const meta30 = metadata(rows30.length, dataDate);

  writeJsonFile(paths.dataRaw(`${base}.json`), rows);
  writeJsonFile(paths.dataRaw(`${base}.meta.json`), meta);
  writeTextFile(paths.dataRaw(`${base}.md`), renderKeywordTable({
    title: '문장군 지역 키워드 발굴 결과 (네이버 API)',
    rows,
    subtitle: `총 발굴: ${rows.length}개`,
    dataDate,
  }));

  const regional30Name = fs.readdirSync(paths.dataProcessed(''))
    .find((name) => name.startsWith(`${base}_30`) && name.endsWith('.md'));
  writeTextFile(paths.dataProcessed(regional30Name), renderKeywordTable({
    title: '지역 키워드 30이상',
    rows: rows30,
    subtitle: '기준: PC+모바일 합계 30 이상',
    dataDate,
    limit: rows30.length,
  }));
  writeJsonFile(paths.dataProcessed(regional30Name.replace(/\.md$/, '.meta.json')), meta30);

  return { base, rows: rows.length, rows30: rows30.length };
}

function normalizeProduct() {
  const dataDate = sourceDataDate(
    paths.dataRaw('keyword_data_product.meta.json'),
    paths.dataRaw('keyword_data_product.md')
  );
  const rows = normalizeRows(readJsonFile(paths.dataRaw('keyword_data_product.json'), []));
  const relevant = rows.filter(isRelevant);

  writeJsonFile(paths.dataRaw('keyword_data_product.json'), rows);
  writeJsonFile(paths.dataRaw('keyword_data_product.meta.json'), metadata(rows.length, dataDate));
  writeTextFile(paths.dataRaw('keyword_data_product.md'), renderKeywordTable({
    title: '문장군 제품/서비스 키워드 발굴 결과 (네이버 API)',
    rows: relevant,
    subtitle: `문장군 관련 필터링: ${relevant.length}개`,
    dataDate,
    limit: 1000,
  }));

  writeJsonFile(paths.dataProcessed('keyword_data_product_relevant.json'), relevant);
  writeJsonFile(paths.dataProcessed('keyword_data_product_relevant.meta.json'), metadata(relevant.length, dataDate));

  return { rows: rows.length, relevant: relevant.length };
}

function normalizeLegacy() {
  const rows = normalizeRows(readJsonFile(paths.dataRaw('keyword_data.json'), []), { addEstimateFlags: false });
  writeJsonFile(paths.dataRaw('keyword_data.json'), rows);
  writeJsonFile(paths.dataRaw('keyword_data.meta.json'), metadata(rows.length, LEGACY_DATA_DATE, {
    estimatePolicy: 'not_available_legacy_no_raw_thresholds',
  }));
  writeTextFile(paths.dataRaw('keyword_data.md'), renderKeywordTable({
    title: '문장군 키워드 발굴 결과 (네이버 API)',
    rows,
    subtitle: `총 발굴: ${rows.length}개`,
    dataDate: LEGACY_DATA_DATE,
  }));
  return { rows: rows.length };
}

function main() {
  const result = {
    regional: normalizeRegional(),
    product: normalizeProduct(),
    legacy: normalizeLegacy(),
  };
  console.log(JSON.stringify(result, null, 2));
}

main();
