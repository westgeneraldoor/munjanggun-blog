const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const dailyCli = path.join(root, 'scripts', 'validate_daily_report.js');
const scorecardCli = path.join(root, 'scripts', 'validate_topic_scorecard.js');
const freshnessReport = path.join(root, 'outputs', 'reports', 'freshness_check.md');

function makeTempDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function removeDir(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

function writeFile(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
}

function runNode(args) {
  return spawnSync(process.execPath, args, {
    cwd: root,
    encoding: 'utf8',
  });
}

function validDailyReport() {
  return [
    '# 2026-06-24 문장군 데일리 현황 보고',
    '',
    '> 보고일: 2026-06-25',
    '> 데이터 기준일: 2026-06-24',
    '',
    '## 1. 기본 통계',
    '',
    '| 항목 | 값 |',
    '| --- | ---: |',
    '| 조회수 | 1,036 |',
    '',
    '## 2. 유입경로 요약',
    '',
    '| 유입경로 | 비율 | 판단 |',
    '| --- | ---: | --- |',
    '| 네이버 통합검색_모바일 | 57.92% | 핵심 유입 |',
    '',
    '## 3. 검색어 클러스터',
    '',
    '- 아파트 중문 설치 비용',
    '- 문장군',
    '',
    '## 4. 게시글 TOP 20',
    '',
    '| 순위 | 제목 | 조회수 | 작성일 |',
    '| ---: | --- | ---: | --- |',
    '| 1 | 걸레받이몰딩 시공 전 꼭 봐야 할 3가지 체크리스트 | 53 | 2026-06-09 |',
    '',
    '## 5. 총괄 판단',
    '',
    '### 보강 후보',
    '',
    '- 거주중 중문시공 내부링크 보강',
    '',
    '### 신규 후보',
    '',
    '- 중문 유리 비교 후속',
    '',
    '## 6. 다음 액션',
    '',
    '1. 091 유리 비교 글 보호 관찰',
    '2. 094 거주중 중문시공 TOP20 유지 여부 확인',
    '',
  ].join('\n');
}

function validScorecard() {
  return [
    '# 2026-06-25 topic scorecard',
    '',
    '## 후보 1. 중문 유리 종류',
    '',
    '- 후보 키워드/원고 번호: 중문 유리 종류 / 106',
    '- 광고 API 시장 수요: 상',
    '- 블로그 실제 유입 반복성: 플루트유리, 모루유리 반복',
    '- TOP20 관련 반응: 091 유리 비교 글 TOP20 유지',
    '- 문장군 서비스 적합성: 가능',
    '- AppSheet 현장 연결성: 유리 샘플, 현관 Before/After 사진 연결 가능',
    '- 기존 글 중복/카니발 위험: 091과 관점 분리 필요',
    '- 발행 안전성: 보장성 표현 없음',
    '- 최종 판정: 작성 후보',
    '',
  ].join('\n');
}

function testValidDailyReportPasses() {
  const dir = makeTempDir('daily-report-');
  try {
    writeFile(path.join(dir, '2026-06-24_seo_watch.md'), validDailyReport());

    const result = runNode([dailyCli, '--reports-dir', dir, '--date', '2026-06-24']);

    assert.strictEqual(result.status, 0, result.stderr || result.stdout);
    assert.match(result.stdout, /ALLOW/);
    assert.match(result.stdout, /2026-06-24_seo_watch\.md/);
  } finally {
    removeDir(dir);
  }
}

function testDailyReportMissingTop20Fails() {
  const dir = makeTempDir('daily-report-missing-');
  try {
    writeFile(
      path.join(dir, '2026-06-24_seo_watch.md'),
      validDailyReport().replace('## 4. 게시글 TOP 20', '## 4. 게시글 요약')
    );

    const result = runNode([dailyCli, '--reports-dir', dir, '--date', '2026-06-24']);

    assert.strictEqual(result.status, 1, result.stdout);
    assert.match(result.stdout, /FAIL/);
    assert.match(result.stdout, /게시글 TOP20/);
  } finally {
    removeDir(dir);
  }
}

function testDailyReportEmptySectionFails() {
  const dir = makeTempDir('daily-report-empty-');
  try {
    writeFile(
      path.join(dir, '2026-06-24_seo_watch.md'),
      validDailyReport().replace(
        '## 6. 다음 액션\n\n1. 091 유리 비교 글 보호 관찰\n2. 094 거주중 중문시공 TOP20 유지 여부 확인',
        '## 6. 다음 액션\n\n'
      )
    );

    const result = runNode([dailyCli, '--reports-dir', dir, '--date', '2026-06-24']);

    assert.strictEqual(result.status, 1, result.stdout);
    assert.match(result.stdout, /다음 액션/);
    assert.match(result.stdout, /비어/);
  } finally {
    removeDir(dir);
  }
}

function testDailyReportPlaceholderSectionFails() {
  const dir = makeTempDir('daily-report-placeholder-');
  try {
    writeFile(
      path.join(dir, '2026-06-24_seo_watch.md'),
      validDailyReport().replace(
        '## 6. 다음 액션\n\n1. 091 유리 비교 글 보호 관찰\n2. 094 거주중 중문시공 TOP20 유지 여부 확인',
        '## 6. 다음 액션\n\n- 작성 예정'
      )
    );

    const result = runNode([dailyCli, '--reports-dir', dir, '--date', '2026-06-24']);

    assert.strictEqual(result.status, 1, result.stdout);
    assert.match(result.stdout, /다음 액션/);
    assert.match(result.stdout, /placeholder|작성 예정|실제 내용/);
  } finally {
    removeDir(dir);
  }
}

function testDailyReportContradictoryMissingFileFails() {
  const dir = makeTempDir('daily-report-contradiction-');
  try {
    writeFile(path.join(dir, '2026-06-23_seo_watch.md'), validDailyReport());
    writeFile(
      path.join(dir, '2026-06-24_seo_watch.md'),
      `${validDailyReport()}\n\n## 7. 23일 자료 상태\n\n파일 \`outputs/reports/daily/2026-06-23_seo_watch.md\`도 아직 없다.\n`
    );

    const result = runNode([dailyCli, '--reports-dir', dir, '--date', '2026-06-24']);

    assert.strictEqual(result.status, 1, result.stdout);
    assert.match(result.stdout, /claims missing file that exists/);
  } finally {
    removeDir(dir);
  }
}

function testValidTopicScorecardPasses() {
  const dir = makeTempDir('topic-scorecard-');
  try {
    writeFile(path.join(dir, '2026-06-25_topic_scorecard.md'), validScorecard());

    const result = runNode([scorecardCli, '--dir', dir, '--latest']);

    assert.strictEqual(result.status, 0, result.stderr || result.stdout);
    assert.match(result.stdout, /ALLOW/);
    assert.match(result.stdout, /2026-06-25_topic_scorecard\.md/);
  } finally {
    removeDir(dir);
  }
}

function testTopicScorecardEmptyFieldFails() {
  const dir = makeTempDir('topic-scorecard-empty-');
  try {
    writeFile(
      path.join(dir, '2026-06-25_topic_scorecard.md'),
      validScorecard().replace(
        '- 광고 API 시장 수요: 상',
        '- 광고 API 시장 수요:'
      )
    );

    const result = runNode([scorecardCli, '--dir', dir, '--latest']);

    assert.strictEqual(result.status, 1, result.stdout);
    assert.match(result.stdout, /광고 API 시장 수요/);
    assert.match(result.stdout, /비어|empty/);
  } finally {
    removeDir(dir);
  }
}

function testTopicScorecardTemplateFileFails() {
  const templatePath = path.join(root, 'outputs', 'reports', 'topic_candidates', 'TOPIC_SCORECARD_TEMPLATE.md');

  const result = runNode([scorecardCli, '--file', templatePath]);

  assert.strictEqual(result.status, 1, result.stdout);
  assert.match(result.stdout, /template|템플릿/i);
}

function testTopicScorecardMissingFieldFails() {
  const dir = makeTempDir('topic-scorecard-invalid-');
  try {
    writeFile(
      path.join(dir, '2026-06-25_topic_scorecard.md'),
      validScorecard().replace('- AppSheet 현장 연결성: 유리 샘플, 현관 Before/After 사진 연결 가능\n', '')
    );

    const result = runNode([scorecardCli, '--dir', dir, '--latest']);

    assert.strictEqual(result.status, 1, result.stdout);
    assert.match(result.stdout, /AppSheet 현장 연결성/);
  } finally {
    removeDir(dir);
  }
}

function testOpsDailyScriptUsesDailyContract() {
  const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const opsDaily = packageJson.scripts['ops:daily'];
  assert(opsDaily.includes('validate_daily_report.js'), opsDaily);
  assert(opsDaily.includes('validate_topic_scorecard.js'), opsDaily);
  assert(opsDaily.includes('check:freshness'), opsDaily);
  assert(opsDaily.includes('validate_active_queue.js'), opsDaily);
  assert(opsDaily.includes('--latest-daily'), opsDaily);
  assert(!opsDaily.includes('track'), opsDaily);
  assert(!opsDaily.includes('ranking:summary'), opsDaily);

  const opsDailyCheck = packageJson.scripts['ops:daily:check'];
  assert(opsDailyCheck.includes('ops:daily'), opsDailyCheck);

  const opsDailyWrite = packageJson.scripts['ops:daily:write'];
  assert(opsDailyWrite.includes('ops:daily'), opsDailyWrite);
  assert(opsDailyWrite.includes('--write-report'), opsDailyWrite);
}

function testFreshnessDefaultExcludesRanking() {
  const before = fs.existsSync(freshnessReport) ? fs.readFileSync(freshnessReport, 'utf8') : null;
  const beforeMtime = fs.existsSync(freshnessReport) ? fs.statSync(freshnessReport).mtimeMs : null;
  const result = runNode([path.join(root, 'scripts', 'check_freshness.js')]);
  assert.strictEqual(result.status, 0, result.stderr || result.stdout);
  assert(!result.stdout.includes('ranking_report.md'), result.stdout);
  assert(!result.stdout.includes('tracking_history.json'), result.stdout);
  assert.match(result.stdout, /keyword_data/);
  assert.match(result.stdout, /report not written/);
  const after = fs.existsSync(freshnessReport) ? fs.readFileSync(freshnessReport, 'utf8') : null;
  const afterMtime = fs.existsSync(freshnessReport) ? fs.statSync(freshnessReport).mtimeMs : null;
  assert.strictEqual(after, before, 'check_freshness.js should not write by default');
  assert.strictEqual(afterMtime, beforeMtime, 'check_freshness.js should not touch mtime by default');
}

function testFreshnessWeeklyIncludesRanking() {
  const result = runNode([path.join(root, 'scripts', 'check_freshness.js'), '--weekly']);
  assert.strictEqual(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /ranking_report\.md/);
  assert.match(result.stdout, /tracking_history\.json/);
}

function main() {
  testValidDailyReportPasses();
  testDailyReportMissingTop20Fails();
  testDailyReportEmptySectionFails();
  testDailyReportPlaceholderSectionFails();
  testDailyReportContradictoryMissingFileFails();
  testValidTopicScorecardPasses();
  testTopicScorecardEmptyFieldFails();
  testTopicScorecardTemplateFileFails();
  testTopicScorecardMissingFieldFails();
  testOpsDailyScriptUsesDailyContract();
  testFreshnessDefaultExcludesRanking();
  testFreshnessWeeklyIncludesRanking();
  console.log('ops daily contract tests passed');
}

main();
