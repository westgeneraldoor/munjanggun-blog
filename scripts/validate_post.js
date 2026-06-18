const fs = require('fs');
const path = require('path');
const { ROOT_DIR } = require('./lib/paths');
const { writeTextFile } = require('./lib/file_store');

const DEFAULT_FROM_NUMBER = 68;

const bannedTerms = [
  '물론',
  '또한',
  '더불어',
  '이처럼',
  '결론적으로',
  '안녕하세요',
  '보양',
  '현관문',
  '무조건',
  '완벽 방음',
  '완전 방음',
  '완벽',
];

const allowedProducts = [
  'ABS도어',
  '문짝교체',
  '문짝+문틀세트',
  '12mm슬림문선',
  '12mm 슬림문선',
  '문짝교체+문틀필름',
  'ABS슬라이딩도어',
  '3연동',
  '3연동중문',
  '3연동ㄱ자',
  '2짝미서기',
  '2짝 미서기',
  '미서기양개',
  '3연동양개',
  '4연동',
  '3연동자동',
  '원슬라이딩',
  '원슬라이딩중문',
  '스윙',
  '스윙도어',
  '천정몰딩',
  '천장몰딩',
  '걸레받이',
  '걸레받이몰딩',
];

const unsupportedProducts = [
  { term: '현관문', reason: 'DEC-017: 현관문 관련 콘텐츠는 블로그 전략에서 영구 제외되었습니다.' },
  { term: '방화문', reason: '현관문/방화문 계열은 블로그 발행 대상 제품이 아닙니다.' },
  { term: '비대칭양개형중문', reason: '문장군 미취급 중문 제품입니다.' },
  { term: '중문파티션', reason: '문장군 공식 중문 제품군에서 제외된 소재입니다.' },
];

const unavailableRegions = ['영종도', '연천', '동두천', '포천', '양평', '가평', '여주'];

function parseArgs(argv) {
  const options = {
    strict: false,
    all: false,
    from: DEFAULT_FROM_NUMBER,
    writeReports: true,
    files: [],
  };

  argv.forEach((arg) => {
    if (arg === '--strict') options.strict = true;
    else if (arg === '--all') options.all = true;
    else if (arg === '--no-write-report') options.writeReports = false;
    else if (arg.startsWith('--from=')) options.from = Number(arg.slice('--from='.length));
    else options.files.push(arg);
  });

  if (!Number.isFinite(options.from)) options.from = DEFAULT_FROM_NUMBER;
  return options;
}

function postNumber(filePath) {
  const name = path.basename(filePath);
  const match = name.match(/^(\d{3})/);
  return match ? Number(match[1]) : 0;
}

function listPostFiles(options) {
  if (options.files.length > 0) {
    return options.files.map((file) => path.resolve(ROOT_DIR, file));
  }

  const postsDir = path.join(ROOT_DIR, 'posts');
  return fs.readdirSync(postsDir)
    .filter((name) => name.endsWith('.md'))
    .map((name) => path.join(postsDir, name))
    .filter((file) => options.all || postNumber(file) >= options.from)
    .sort();
}

function firstMeaningfulLine(content) {
  return content.split(/\r?\n/).map((line) => line.trim()).find(Boolean) || '';
}

function extractTitle(content) {
  const first = firstMeaningfulLine(content);
  if (first.startsWith('# ')) return first.slice(2).trim();

  const recommended = content.match(/추천 제목:\s*(.+)/);
  if (recommended) return recommended[1].trim();

  return first.replace(/^#+\s*/, '').trim();
}

function extractHashtags(content) {
  const hashtagSection = content.match(/# 해시태그[\s\S]*?\n\n([\s\S]*)$/);
  const target = hashtagSection ? hashtagSection[1] : content;
  return (target.match(/#[^\s#]+/g) || []).map((tag) => tag.trim());
}

function classifyTitlePattern(title) {
  if (/비용|가격|견적/.test(title)) return 'cost';
  if (/비교|vs|VS|차이/.test(title)) return 'compare';
  if (/사례|현장/.test(title)) return 'case';
  if (/후회|실패|주의|폭탄/.test(title)) return 'failure';
  if (/기준|조건|확인|체크/.test(title)) return 'criteria';
  return 'other';
}

function addIssue(issues, level, message) {
  issues.push({ level, message });
}

function validateProductScope(content, issues) {
  const unsupportedHits = unsupportedProducts
    .filter(({ term }) => content.includes(term))
    .filter(({ term }) => !allowedProducts.includes(term));

  unsupportedHits.forEach(({ term, reason }) => {
    addIssue(issues, 'fail', `미취급/제외 제품 언급: ${term} - ${reason}`);
  });

  const doorFrameOnlyPattern = /문틀만[^\r\n]{0,12}(교체|가능|바꾸|새로)|문틀[^\r\n]{0,8}단독[^\r\n]{0,12}(교체|가능|바꾸|새로)/g;
  const positivePattern = /(가능|할 수|됩니다|진행합니다|가능합니다|교체할 수|바꿀 수|새로 할 수)/;
  const negativePattern = /(하지 않습니다|진행하지 않습니다|안 됩니다|불가|어렵|아닙니다|못합니다|맞지 않습니다)/;
  const inquiryPattern = /(\?|까요|있나요|되나요|될까요|얼마일까요|궁금)/;
  for (const match of content.matchAll(doorFrameOnlyPattern)) {
    const windowStart = Math.max(0, match.index - 30);
    const windowEnd = Math.min(content.length, match.index + match[0].length + 40);
    const localContext = content.slice(windowStart, windowEnd);
    if (positivePattern.test(localContext) && !negativePattern.test(localContext) && !inquiryPattern.test(localContext)) {
      addIssue(issues, 'fail', '문틀만 단독 교체 가능처럼 표현하면 안 됩니다. 문짝교체+문선마감 또는 문짝+문틀세트 범위로 안내해야 합니다.');
      break;
    }
  }
}

function validateFile(filePath, options) {
  const content = fs.readFileSync(filePath, 'utf8');
  const rel = path.relative(ROOT_DIR, filePath).replace(/\\/g, '/');
  const number = postNumber(filePath);
  const isV2Target = number >= options.from;
  const title = extractTitle(content);
  const hashtags = extractHashtags(content);
  const links = content.match(/https:\/\/blog\.naver\.com\/doorgeneral\/\d+/g) || [];
  const issues = [];

  if (!title) addIssue(issues, 'fail', '제목을 찾을 수 없습니다.');
  if (firstMeaningfulLine(content) === '# 제목 후보') {
    addIssue(issues, isV2Target ? 'fail' : 'warn', '`# 제목 후보`가 발행 본문에 남아 있습니다.');
  }

  if (title && !/\d/.test(title)) addIssue(issues, 'warn', '제목에 숫자가 없습니다.');
  if (title && /[?？]|할까|인가|일까|는지|뭘까|어떨까/.test(title)) {
    addIssue(issues, 'fail', '질문형 제목은 금지입니다.');
  }
  if (title && title.replace(/\s/g, '') === '중문') {
    addIssue(issues, 'fail', '`중문` 단독 제목은 금지입니다.');
  }
  if (title && (title.length < 24 || title.length > 40)) {
    addIssue(issues, 'warn', `제목 길이가 권장 범위 밖입니다: ${title.length}자`);
  }

  bannedTerms.forEach((term) => {
    if (content.includes(term)) addIssue(issues, isV2Target ? 'fail' : 'warn', `금지/주의 표현 포함: ${term}`);
  });

  unavailableRegions.forEach((region) => {
    const possiblePattern = new RegExp(`${region}.{0,12}(가능|시공|방문|실측|견적)`);
    if (possiblePattern.test(content)) {
      addIssue(issues, 'fail', `불가 지역을 가능 지역처럼 표현했을 수 있습니다: ${region}`);
    }
  });

  if (content.includes('프렌치중문') && !/정확한 제품명|제품명이라기보다|스타일|디자인 취향/.test(content)) {
    addIssue(issues, 'fail', '프렌치중문은 공식 제품명이 아니라 스타일/디자인 취향으로 설명해야 합니다.');
  }

  if (!/무료 방문실측|무료 실측|네이버 예약|방문실측견적/.test(content)) {
    addIssue(issues, 'warn', '무료 방문실측 또는 네이버 예약 CTA가 없습니다.');
  }

  if (hashtags.length < 5 || hashtags.length > 10) {
    addIssue(issues, 'warn', `해시태그 개수가 권장 범위 밖입니다: ${hashtags.length}개`);
  }
  if (!hashtags.includes('#문장군') || !hashtags.includes('#문장군중문')) {
    addIssue(issues, 'warn', '브랜드 해시태그 #문장군 #문장군중문이 모두 필요합니다.');
  }
  hashtags.forEach((tag) => {
    if (/\s/.test(tag.slice(1))) addIssue(issues, 'fail', `해시태그에 띄어쓰기가 있습니다: ${tag}`);
  });

  if (links.length < 2) addIssue(issues, 'warn', `내부링크가 2개 미만입니다: ${links.length}개`);
  if (/현재 발행 예정|기존 \d{3}번|등록된 \d{3}번/.test(content)) {
    addIssue(issues, 'fail', '미완성 내부링크 문구가 남아 있습니다.');
  }
  if (content.includes('[사진:')) addIssue(issues, 'warn', '사진 플레이스홀더는 제작 노트로 분리하는 편이 좋습니다.');

  validateProductScope(content, issues);

  return {
    file: rel,
    title,
    pattern: classifyTitlePattern(title),
    links: links.length,
    hashtags: hashtags.length,
    issues,
  };
}

function summarizePatternQuota(results) {
  const recent = results
    .filter((result) => postNumber(result.file) > 0)
    .sort((a, b) => postNumber(a.file) - postNumber(b.file))
    .slice(-5);

  const counts = {};
  recent.forEach((result) => {
    counts[result.pattern] = (counts[result.pattern] || 0) + 1;
  });

  const repeated = Object.entries(counts).find(([, count]) => count >= 4);
  if (!repeated) return null;
  return `최근 5편 중 ${repeated[1]}편이 같은 제목 패턴(${repeated[0]})입니다. 다음 글은 다른 패턴을 권장합니다.`;
}

function renderCheckReport(result) {
  let md = `# 원고 검수 리포트: ${path.basename(result.file)}\n\n`;
  md += `| 항목 | 값 |\n`;
  md += `| --- | --- |\n`;
  md += `| 제목 | ${result.title || '-'} |\n`;
  md += `| 제목 패턴 | ${result.pattern} |\n`;
  md += `| 내부링크 | ${result.links}개 |\n`;
  md += `| 해시태그 | ${result.hashtags}개 |\n`;
  md += `| 상태 | ${result.issues.some((issue) => issue.level === 'fail') ? 'FAIL' : (result.issues.length ? 'WARN' : 'PASS')} |\n\n`;

  if (result.issues.length === 0) {
    md += `## 이슈\n\n없음\n`;
    return md;
  }

  md += `## 이슈\n\n`;
  result.issues.forEach((issue) => {
    md += `- **${issue.level.toUpperCase()}** ${issue.message}\n`;
  });
  return md;
}

function writeCheckReports(results, patternWarning) {
  const checksDir = path.join(ROOT_DIR, 'outputs', 'checks');
  let summary = `# 원고 검수 종합 리포트\n\n`;
  summary += `> 생성일: ${new Date().toISOString().split('T')[0]}\n\n`;
  summary += `| 파일 | 제목 | 링크 | 해시태그 | 상태 |\n`;
  summary += `| --- | --- | ---: | ---: | --- |\n`;

  results.forEach((result) => {
    const status = result.issues.some((issue) => issue.level === 'fail')
      ? 'FAIL'
      : (result.issues.length ? 'WARN' : 'PASS');
    summary += `| ${result.file} | ${result.title || '-'} | ${result.links} | ${result.hashtags} | ${status} |\n`;

    const baseName = path.basename(result.file, '.md');
    writeTextFile(path.join(checksDir, `${baseName}_check.md`), renderCheckReport(result));
  });

  if (patternWarning) {
    summary += `\n## 제목 패턴 경고\n\n- ${patternWarning}\n`;
  }

  writeTextFile(path.join(checksDir, 'posts_validation_summary.md'), summary);
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const files = listPostFiles(options);
  if (files.length === 0) {
    console.log('검수할 posts 파일이 없습니다.');
    return;
  }

  const results = files.map((file) => validateFile(file, options));
  const patternWarning = summarizePatternQuota(results);

  let failCount = 0;
  let warnCount = 0;

  console.log(`\n문장군 블로그 원고 검수: ${results.length}개 파일\n`);
  results.forEach((result) => {
    const fails = result.issues.filter((issue) => issue.level === 'fail');
    const warns = result.issues.filter((issue) => issue.level === 'warn');
    failCount += fails.length;
    warnCount += warns.length;

    const status = fails.length > 0 ? 'FAIL' : (warns.length > 0 ? 'WARN' : 'PASS');
    console.log(`[${status}] ${result.file}`);
    console.log(`  제목: ${result.title || '-'}`);
    console.log(`  링크 ${result.links}개, 해시태그 ${result.hashtags}개, 패턴 ${result.pattern}`);
    result.issues.forEach((issue) => {
      console.log(`  - ${issue.level.toUpperCase()}: ${issue.message}`);
    });
  });

  if (patternWarning) {
    warnCount += 1;
    console.log(`\n[WARN] ${patternWarning}`);
  }

  if (options.writeReports) {
    writeCheckReports(results, patternWarning);
  }

  console.log(`\n검수 결과: fail ${failCount}개, warn ${warnCount}개`);

  if (failCount > 0 || (options.strict && warnCount > 0)) {
    process.exit(1);
  }
}

main();
