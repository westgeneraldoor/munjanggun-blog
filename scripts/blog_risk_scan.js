const fs = require('fs');
const path = require('path');
const { ROOT_DIR } = require('./lib/paths');
const { writeTextFile } = require('./lib/file_store');

const DEFAULT_FROM = 68;
const DEFAULT_TO = 85;

const regionTerms = [
  '서울', '인천', '수원', '화성', '안산', '성남', '용인', '세종', '천안', '아산', '청주',
  '대전', '강남', '고양', '남양주', '동탄', '평택', '파주', '광명', '송도',
];

const productTerms = [
  'ABS도어', '타공도어', '문짝교체', '문틀교체', '문짝+문틀세트', '문선', '9mm 문선',
  '12mm 문선', '중문', '3연동', '3연동중문', '원슬라이딩', '스윙도어', '스윙',
  '미서기', '프렌치중문', '걸레받이', '천장몰딩', '현관문', '방화문', '비대칭양개형중문',
  '중문파티션',
];

const performanceTerms = ['완벽', '확실', '보장', '방음', '차단', '해결', '대만족', '만족', '소음'];
const ctaTerms = ['무료 방문실측', '무료 실측', '네이버 예약', '브랜드스토어', '방문실측견적'];

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function splitLines(content) {
  return content.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

function extractHashtags(content) {
  const hashtagIndex = content.indexOf('# 해시태그');
  const target = hashtagIndex >= 0 ? content.slice(hashtagIndex) : content;
  return unique(target.match(/#[^\s#]+/g) || []);
}

function extractQuotes(content) {
  const quotes = [];
  const quoteRegex = /"([^"\r\n]{2,})"/g;
  let match = quoteRegex.exec(content);
  while (match) {
    quotes.push(match[1].trim());
    match = quoteRegex.exec(content);
  }
  return unique(quotes);
}

function lineHasAny(line, terms) {
  return terms.some((term) => line.includes(term));
}

function scanContent(content, file = '-') {
  const lines = splitLines(content);
  const quotes = extractQuotes(content);
  const caseLikeSentences = lines.filter((line) => (
    /고객님|사례|현장|실제로/.test(line)
    || regionTerms.some((region) => line.includes(region) && /시공|교체|설치/.test(line))
  ));
  const regions = unique(regionTerms.filter((term) => content.includes(term)));
  const products = unique(productTerms.filter((term) => content.includes(term)));
  const numericClaims = lines.filter((line) => /(\d{1,3}\s*%|100%|90%|35현장|15,000|4,000)/.test(line));
  const performanceClaims = lines.filter((line) => lineHasAny(line, performanceTerms));
  const ctas = lines.filter((line) => lineHasAny(line, ctaTerms));
  const hashtags = extractHashtags(content);
  const riskItems = [];

  caseLikeSentences.forEach((sentence) => {
    riskItems.push({
      status: 'NEEDS_EVIDENCE',
      type: 'case_like_sentence',
      text: sentence,
      reason: '실제 고객/현장 사례처럼 읽히므로 evidence_ref가 필요합니다.',
    });
  });

  quotes.forEach((quote) => {
    riskItems.push({
      status: 'NEEDS_EVIDENCE',
      type: 'quote',
      text: quote,
      reason: '따옴표 인용은 quote_status와 원문/요약/구성 여부가 필요합니다.',
    });
  });

  numericClaims.forEach((sentence) => {
    riskItems.push({
      status: 'FIX',
      type: 'numeric_claim',
      text: sentence,
      reason: '숫자/비율 주장은 근거가 없으면 완화해야 합니다.',
    });
  });

  performanceClaims
    .filter((sentence) => /완벽|확실|보장|완전 방음|완벽 방음|90%|100%/.test(sentence))
    .forEach((sentence) => {
      riskItems.push({
        status: 'FIX',
        type: 'strong_claim',
        text: sentence,
        reason: '강한 성능/보장 표현은 claim evidence가 필요합니다.',
      });
    });

  products
    .filter((product) => ['현관문', '방화문', '비대칭양개형중문', '중문파티션'].includes(product))
    .forEach((product) => {
      riskItems.push({
        status: 'FAIL',
        type: 'blocked_product',
        text: product,
        reason: '문장군 미취급/제외 제품 또는 영구 제외 소재입니다.',
      });
    });

  if (riskItems.length === 0) {
    riskItems.push({
      status: 'PASS',
      type: 'no_detected_risk',
      text: '',
      reason: '자동 스캔에서 주요 P1 리스크가 발견되지 않았습니다.',
    });
  }

  return {
    file,
    quotes,
    case_like_sentences: unique(caseLikeSentences),
    regions,
    products,
    numeric_claims: unique(numericClaims),
    performance_claims: unique(performanceClaims),
    ctas: unique(ctas),
    hashtags,
    risk_items: riskItems,
  };
}

function parseArgs(argv) {
  const options = {
    from: DEFAULT_FROM,
    to: DEFAULT_TO,
    out: path.join(ROOT_DIR, 'outputs', 'reports', 'risk', 'blog_risk_scan.md'),
  };

  argv.forEach((arg) => {
    if (arg.startsWith('--from=')) options.from = Number(arg.slice('--from='.length));
    else if (arg.startsWith('--to=')) options.to = Number(arg.slice('--to='.length));
    else if (arg.startsWith('--out=')) options.out = path.resolve(ROOT_DIR, arg.slice('--out='.length));
  });

  return options;
}

function postNumber(fileName) {
  const match = path.basename(fileName).match(/^(\d{3})/);
  return match ? Number(match[1]) : 0;
}

function listPosts(from, to) {
  const postsDir = path.join(ROOT_DIR, 'posts');
  return fs.readdirSync(postsDir)
    .filter((name) => name.endsWith('.md'))
    .filter((name) => {
      const number = postNumber(name);
      return number >= from && number <= to;
    })
    .sort()
    .map((name) => path.join(postsDir, name));
}

function renderReport(results) {
  let md = '# 블로그 P1 리스크 스캔 리포트\n\n';
  md += `> 생성일: ${new Date().toISOString().split('T')[0]}\n`;
  md += '> 분류: PASS / FIX / FAIL / NEEDS_EVIDENCE\n\n';

  results.forEach((result) => {
    md += `## ${result.file}\n\n`;
    md += `| 항목 | 값 |\n`;
    md += `| --- | --- |\n`;
    md += `| 지역명 | ${result.regions.join(', ') || '-'} |\n`;
    md += `| 제품명 | ${result.products.join(', ') || '-'} |\n`;
    md += `| 인용문 | ${result.quotes.length}개 |\n`;
    md += `| 사례형 문장 | ${result.case_like_sentences.length}개 |\n`;
    md += `| 숫자 주장 | ${result.numeric_claims.length}개 |\n`;
    md += `| 성능 주장 | ${result.performance_claims.length}개 |\n`;
    md += `| CTA | ${result.ctas.join(' / ') || '-'} |\n`;
    md += `| 해시태그 | ${result.hashtags.join(' ') || '-'} |\n\n`;
    md += `### 리스크 항목\n\n`;
    result.risk_items.forEach((item) => {
      md += `- **${item.status}** ${item.type}: ${item.text || '-'} — ${item.reason}\n`;
    });
    md += '\n';
  });

  return `${md.trimEnd()}\n`;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const results = listPosts(options.from, options.to).map((filePath) => {
    const content = fs.readFileSync(filePath, 'utf8');
    return scanContent(content, path.relative(ROOT_DIR, filePath).replace(/\\/g, '/'));
  });
  writeTextFile(options.out, renderReport(results));
  console.log(`risk scan complete: ${results.length} posts`);
  console.log(path.relative(ROOT_DIR, options.out).replace(/\\/g, '/'));
}

if (require.main === module) {
  main();
}

module.exports = {
  scanContent,
  renderReport,
};
