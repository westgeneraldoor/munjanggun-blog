const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const queueCli = path.join(root, 'scripts', 'validate_active_queue.js');

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

function runQueue(filePath, extraArgs = []) {
  return spawnSync(process.execPath, [queueCli, '--file', filePath, '--today', '2026-06-29', ...extraArgs], {
    cwd: root,
    encoding: 'utf8',
  });
}

function queueTable(rows) {
  return [
    '# Active Queue Fixture',
    '',
    '| id | lane | status | topic | primary_keyword | market_volume | current_signal | linked_asset | next_action | due | risk | updated_at |',
    '| --- | --- | --- | --- | --- | ---: | --- | --- | --- | --- | --- | --- |',
    ...rows,
    '',
  ].join('\n');
}

function validRows() {
  return [
    '| Q-001 | protect | internal_link | 걸레받이몰딩 보호 | 걸레받이몰딩 | 6430 | TOP20 강함 | posts/051_걸레받이몰딩.md | 내부링크 보강 | 2026-07-01 | 과장 금지 | 2026-06-29 |',
    '| Q-002 | protect | publish_waiting | 9mm/12mm 문선 정리 | 12mm 슬림문선 | 4430 | 문선 검색 반복 | posts/118_9mm문선12mm슬림문선.md | 발행 후 관찰 | 2026-07-01 | 9mm 서비스 오해 금지 | 2026-06-29 |',
    '| Q-003 | attack | scorecard_needed | 중문설치 과정 | 중문설치 | 2650 | 시장 큼, 현재 성과 약함 | posts/047_중문설치.md | scorecard 작성 | 2026-07-02 | 기존 글 중복 | 2026-06-29 |',
    '| Q-004 | attack | rewrite_candidate | 현관중문 허브 보강 | 현관중문 | 11750 | 시장 큼, 회복 필요 | posts/003_현관중문.md | 허브 보강안 검토 | 2026-07-03 | 카니발 위험 | 2026-06-29 |',
    '| Q-005 | attack | scorecard_needed | ABS도어 방문교체 연결 | ABS도어 | 6910 | 방문교체 축 반복 | posts/005_ABS도어.md | scorecard 작성 | 2026-07-04 | 문틀만 단독 교체 가능 주장 금지 | 2026-06-29 |',
    '| Q-006 | experiment | monitor_7d | 화장실문 아래쪽 썩음 | 화장실문 아래쪽 썩음 | 0 | 롱테일 전환 의도 | posts/117_화장실문아래썩음.md | 7일 반복 관찰 | 2026-07-06 | 원인 단정 금지 | 2026-06-29 |',
    '| Q-007 | exclude | excluded | 싱크대문짝교체 확장 금지 | 싱크대 문짝교체 비용 | 3450 | 유입 가능성 있음 | - | 확장 금지 | 2026-07-05 | 주방가구 오해 | 2026-06-29 |',
    '| Q-008 | exclude | excluded | 현관문/방화문 영구 제외 | 현관문교체 | 12000 | 검색량 큼 | - | 영구 제외 | 2026-07-05 | 서비스 범위 밖 | 2026-06-29 |',
  ];
}

function validDaily(ids = ['Q-001', 'Q-003', 'Q-007']) {
  return [
    '# 2026-06-28 daily fixture',
    '',
    '## 다음 액션',
    '',
    '- queue 반영 필요',
    '',
    '## 오늘 보드 반영',
    '',
    '| queue_id | 처리 | 판단 |',
    '| --- | --- | --- |',
    ...ids.map((id) => `| ${id} | 유지 | ${id} 판단 유지 |`),
    '',
  ].join('\n');
}

function runWithTempQueue(testName, mutateRows, extraArgs = []) {
  const dir = makeTempDir(`active-queue-${testName}-`);
  try {
    const filePath = path.join(dir, 'ACTIVE_TOPIC_QUEUE.md');
    const rows = validRows();
    writeFile(filePath, queueTable(mutateRows ? mutateRows(rows, dir) : rows));
    return runQueue(filePath, extraArgs);
  } finally {
    removeDir(dir);
  }
}

function testValidQueuePasses() {
  const result = runWithTempQueue('valid');
  assert.strictEqual(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /ALLOW/);
}

function testTooFewRowsFails() {
  const result = runWithTempQueue('too-few', (rows) => rows.slice(0, 7));
  assert.strictEqual(result.status, 1, result.stdout);
  assert.match(result.stdout, /too few rows/);
}

function testTooManyRowsFails() {
  const result = runWithTempQueue('too-many', (rows) => {
    for (let index = 9; index <= 16; index += 1) {
      rows.push(`| Q-${String(index).padStart(3, '0')} | experiment | monitor_7d | 실험 ${index} | 중문 실험 ${index} | 0 | 관찰 | posts/020_좁은현관중문.md | 7일 반복 관찰 | 2026-07-06 | 과장 금지 | 2026-06-29 |`);
    }
    return rows;
  });
  assert.strictEqual(result.status, 1, result.stdout);
  assert.match(result.stdout, /too many rows/);
}

function testInvalidLaneFails() {
  const result = runWithTempQueue('invalid-lane', (rows) => {
    rows[0] = rows[0].replace('| protect |', '| publish_waiting |');
    return rows;
  });
  assert.strictEqual(result.status, 1, result.stdout);
  assert.match(result.stdout, /invalid lane/);
}

function testInvalidStatusFails() {
  const result = runWithTempQueue('invalid-status', (rows) => {
    rows[0] = rows[0].replace('| internal_link |', '| protect |');
    return rows;
  });
  assert.strictEqual(result.status, 1, result.stdout);
  assert.match(result.stdout, /invalid status/);
}

function testAttackMarketVolumeRequired() {
  const result = runWithTempQueue('attack-volume', (rows) => {
    rows[2] = rows[2].replace('| 2650 |', '| - |');
    return rows;
  });
  assert.strictEqual(result.status, 1, result.stdout);
  assert.match(result.stdout, /attack lane needs numeric market_volume/);
}

function testExcludeScorecardFails() {
  const result = runWithTempQueue('exclude-scorecard', (rows) => {
    rows[6] = rows[6]
      .replace('| excluded |', '| scorecard_needed |')
      .replace('| 확장 금지 |', '| scorecard 작성 |');
    return rows;
  });
  assert.strictEqual(result.status, 1, result.stdout);
  assert.match(result.stdout, /exclude lane/);
}

function testPublishWaitingNeedsLinkedAsset() {
  const result = runWithTempQueue('publish-waiting-link', (rows) => {
    rows[1] = rows[1].replace('| posts/118_9mm문선12mm슬림문선.md |', '| - |');
    return rows;
  });
  assert.strictEqual(result.status, 1, result.stdout);
  assert.match(result.stdout, /publish_waiting needs linked_asset/);
}

function testDailyUnknownQueueIdFails() {
  const dir = makeTempDir('active-queue-daily-unknown-');
  try {
    const queuePath = path.join(dir, 'ACTIVE_TOPIC_QUEUE.md');
    const dailyPath = path.join(dir, '2026-06-28_seo_watch.md');
    writeFile(queuePath, queueTable(validRows()));
    writeFile(dailyPath, validDaily(['Q-999']));

    const result = runQueue(queuePath, ['--daily-file', dailyPath]);

    assert.strictEqual(result.status, 1, result.stdout);
    assert.match(result.stdout, /queue_id not found/);
  } finally {
    removeDir(dir);
  }
}

function testDailyLaneStatusConflictFails() {
  const dir = makeTempDir('active-queue-daily-conflict-');
  try {
    const queuePath = path.join(dir, 'ACTIVE_TOPIC_QUEUE.md');
    const dailyPath = path.join(dir, '2026-06-28_seo_watch.md');
    writeFile(queuePath, queueTable(validRows()));
    writeFile(
      dailyPath,
      [
        '# 2026-06-28 daily fixture',
        '',
        '## 오늘 보드 반영',
        '',
        '| queue_id | 처리 | 판단 |',
        '| --- | --- | --- |',
        '| Q-003 | 제외 | 중문설치 exclude / excluded 처리 |',
        '',
      ].join('\n')
    );

    const result = runQueue(queuePath, ['--daily-file', dailyPath]);

    assert.strictEqual(result.status, 1, result.stdout);
    assert.match(result.stdout, /daily lane exclude conflicts with queue lane attack/);
    assert.match(result.stdout, /daily status excluded conflicts with queue status scorecard_needed/);
  } finally {
    removeDir(dir);
  }
}

function testDailyMissingReflectionFails() {
  const dir = makeTempDir('active-queue-daily-missing-');
  try {
    const queuePath = path.join(dir, 'ACTIVE_TOPIC_QUEUE.md');
    const dailyPath = path.join(dir, '2026-06-28_seo_watch.md');
    writeFile(queuePath, queueTable(validRows()));
    writeFile(dailyPath, '# daily\n\n## 다음 액션\n\n- Q-001 유지\n');

    const result = runQueue(queuePath, ['--daily-file', dailyPath]);

    assert.strictEqual(result.status, 1, result.stdout);
    assert.match(result.stdout, /오늘 보드 반영/);
  } finally {
    removeDir(dir);
  }
}

function testDailyReflectionPasses() {
  const dir = makeTempDir('active-queue-daily-valid-');
  try {
    const queuePath = path.join(dir, 'ACTIVE_TOPIC_QUEUE.md');
    const dailyPath = path.join(dir, '2026-06-28_seo_watch.md');
    writeFile(queuePath, queueTable(validRows()));
    writeFile(dailyPath, validDaily());

    const result = runQueue(queuePath, ['--daily-file', dailyPath]);

    assert.strictEqual(result.status, 0, result.stderr || result.stdout);
    assert.match(result.stdout, /daily:/);
  } finally {
    removeDir(dir);
  }
}

function testAttackMinimumWarnsButPasses() {
  const result = runWithTempQueue('attack-warn', (rows) => {
    rows[4] = rows[4]
      .replace('| attack | scorecard_needed |', '| experiment | monitor_7d |')
      .replace('| scorecard 작성 |', '| 7일 반복 관찰 |');
    return rows;
  });
  assert.strictEqual(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /WARN: attack lane has fewer than 3 rows/);
}

function testProtectShareWarnsButPasses() {
  const result = runWithTempQueue('protect-share', (rows) => {
    rows[2] = rows[2]
      .replace('| attack | scorecard_needed |', '| protect | internal_link |')
      .replace('| scorecard 작성 |', '| 내부링크 보강 |');
    rows[3] = rows[3]
      .replace('| attack | rewrite_candidate |', '| protect | internal_link |')
      .replace('| 허브 보강안 검토 |', '| 내부링크 보강 |');
    rows[4] = rows[4]
      .replace('| attack | scorecard_needed |', '| protect | internal_link |')
      .replace('| scorecard 작성 |', '| 내부링크 보강 |');
    return rows;
  });
  assert.strictEqual(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /WARN: protect lane exceeds 50%/);
}

function testForbiddenActiveTermFails() {
  const result = runWithTempQueue('forbidden-active', (rows) => {
    rows[0] = rows[0].replace('걸레받이몰딩 보호', '싱크대문짝교체 작성');
    return rows;
  });
  assert.strictEqual(result.status, 1, result.stdout);
  assert.match(result.stdout, /forbidden term in active row/);
}

function testForbiddenTermInExcludedPasses() {
  const result = runWithTempQueue('forbidden-excluded');
  assert.strictEqual(result.status, 0, result.stderr || result.stdout);
}

function testScorecardNeededActionMustMentionScorecard() {
  const result = runWithTempQueue('scorecard-action', (rows) => {
    rows[2] = rows[2].replace('scorecard 작성', '바로 원고 작성');
    return rows;
  });
  assert.strictEqual(result.status, 1, result.stdout);
  assert.match(result.stdout, /scorecard_needed next_action/);
}

function testDuplicateIdFails() {
  const result = runWithTempQueue('duplicate-id', (rows) => {
    rows[1] = rows[1].replace('Q-002', 'Q-001');
    return rows;
  });
  assert.strictEqual(result.status, 1, result.stdout);
  assert.match(result.stdout, /duplicate id/);
}

function main() {
  testValidQueuePasses();
  testTooFewRowsFails();
  testTooManyRowsFails();
  testInvalidLaneFails();
  testInvalidStatusFails();
  testAttackMarketVolumeRequired();
  testExcludeScorecardFails();
  testPublishWaitingNeedsLinkedAsset();
  testDailyUnknownQueueIdFails();
  testDailyLaneStatusConflictFails();
  testDailyMissingReflectionFails();
  testDailyReflectionPasses();
  testAttackMinimumWarnsButPasses();
  testProtectShareWarnsButPasses();
  testForbiddenActiveTermFails();
  testForbiddenTermInExcludedPasses();
  testScorecardNeededActionMustMentionScorecard();
  testDuplicateIdFails();
  console.log('active queue validation tests passed');
}

main();
