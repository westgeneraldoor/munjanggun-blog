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

function runQueue(filePath) {
  return spawnSync(process.execPath, [queueCli, '--file', filePath], {
    cwd: root,
    encoding: 'utf8',
  });
}

function queueTable(rows) {
  return [
    '# Active Queue Fixture',
    '',
    '| id | status | priority | portfolio_class | topic | primary_keyword | intent | action | linked_post | market_volume | 3d_signal | evidence_refs | risk | next_decision_date |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
    ...rows,
    '',
  ].join('\n');
}

function validRows() {
  return [
    '| Q-001 | protect | P0 | defense | 걸레받이 보호 | 걸레받이몰딩 | 비용 확인 | 기존 글 보호 | - | 대형 | 2026-06-26~28 반복 | daily 2026-06-26, 2026-06-27, 2026-06-28 | 셀프 과장 주의 | 2026-07-01 |',
    '| Q-002 | scorecard_needed | P0 | attack | 방문 비용 공격 | 방문교체비용 | 비용 확인 | scorecard 작성 후 판단 | - | 중형 | 2026-06-26~28 반복 | daily 2026-06-26 | 문틀 단독 교체 주장 금지 | 2026-07-02 |',
    '| Q-003 | excluded | P0 | excluded | 싱크대 문짝교체 | 싱크대 문짝교체 비용 | 주방가구 비용 | 신규 글감 제외 | - | 반복 유입 | 2026-06-26~28 반복 | daily 2026-06-28 | 문장군 서비스 오해 | 2026-07-05 |',
  ];
}

function testValidQueuePasses() {
  const dir = makeTempDir('active-queue-valid-');
  try {
    const filePath = path.join(dir, 'ACTIVE_TOPIC_QUEUE.md');
    writeFile(filePath, queueTable(validRows()));

    const result = runQueue(filePath);

    assert.strictEqual(result.status, 0, result.stderr || result.stdout);
    assert.match(result.stdout, /ALLOW/);
  } finally {
    removeDir(dir);
  }
}

function testMissingColumnFails() {
  const dir = makeTempDir('active-queue-missing-column-');
  try {
    const filePath = path.join(dir, 'ACTIVE_TOPIC_QUEUE.md');
    writeFile(
      filePath,
      queueTable(validRows()).replace(' | risk | next_decision_date |', ' | next_decision_date |')
    );

    const result = runQueue(filePath);

    assert.strictEqual(result.status, 1, result.stdout);
    assert.match(result.stdout, /required columns|queue table/i);
  } finally {
    removeDir(dir);
  }
}

function testForbiddenActiveTermFails() {
  const dir = makeTempDir('active-queue-forbidden-');
  try {
    const filePath = path.join(dir, 'ACTIVE_TOPIC_QUEUE.md');
    const rows = validRows();
    rows[0] = rows[0].replace('걸레받이 보호', '싱크대 문짝교체 발행');
    writeFile(filePath, queueTable(rows));

    const result = runQueue(filePath);

    assert.strictEqual(result.status, 1, result.stdout);
    assert.match(result.stdout, /forbidden term/);
  } finally {
    removeDir(dir);
  }
}

function testForbiddenSpacingVariantFails() {
  const dir = makeTempDir('active-queue-forbidden-variant-');
  try {
    const filePath = path.join(dir, 'ACTIVE_TOPIC_QUEUE.md');
    const rows = validRows();
    rows[0] = rows[0].replace('걸레받이 보호', '무타공중문 발행');
    writeFile(filePath, queueTable(rows));

    const result = runQueue(filePath);

    assert.strictEqual(result.status, 1, result.stdout);
    assert.match(result.stdout, /무타공중문/);
  } finally {
    removeDir(dir);
  }
}

function testRestrictedRiskTextCanPass() {
  const dir = makeTempDir('active-queue-risk-text-');
  try {
    const filePath = path.join(dir, 'ACTIVE_TOPIC_QUEUE.md');
    const rows = validRows();
    rows[0] = rows[0].replace('셀프 과장 주의', '문틀만 단독 교체 가능 주장 금지');
    writeFile(filePath, queueTable(rows));

    const result = runQueue(filePath);

    assert.strictEqual(result.status, 0, result.stderr || result.stdout);
  } finally {
    removeDir(dir);
  }
}

function testForbiddenExcludedTermPasses() {
  const dir = makeTempDir('active-queue-excluded-');
  try {
    const filePath = path.join(dir, 'ACTIVE_TOPIC_QUEUE.md');
    writeFile(filePath, queueTable(validRows()));

    const result = runQueue(filePath);

    assert.strictEqual(result.status, 0, result.stderr || result.stdout);
  } finally {
    removeDir(dir);
  }
}

function testTooManyRowsFails() {
  const dir = makeTempDir('active-queue-too-many-');
  try {
    const filePath = path.join(dir, 'ACTIVE_TOPIC_QUEUE.md');
    const rows = validRows();
    for (let index = 4; index <= 16; index += 1) {
      rows.push(`| Q-${String(index).padStart(3, '0')} | monitor_3d | P2 | experiment | 실험 ${index} | 중문 실험 ${index} | 관찰 | 3일 관찰 | - | 롱테일 | 관찰 | daily 2026-06-28 | 과장 금지 | 2026-07-05 |`);
    }
    writeFile(filePath, queueTable(rows));

    const result = runQueue(filePath);

    assert.strictEqual(result.status, 1, result.stdout);
    assert.match(result.stdout, /too many rows/);
  } finally {
    removeDir(dir);
  }
}

function testPublishWaitingNeedsLinkedPost() {
  const dir = makeTempDir('active-queue-publish-waiting-');
  try {
    const filePath = path.join(dir, 'ACTIVE_TOPIC_QUEUE.md');
    const rows = validRows();
    rows.push('| Q-004 | publish_waiting | P1 | attack | 자동중문 단점 | 자동중문 단점 | 단점 확인 | 발행 후 관찰 | - | 소형 | 3일 반복 | daily 2026-06-28 | 과장 금지 | 2026-07-03 |');
    writeFile(filePath, queueTable(rows));

    const result = runQueue(filePath);

    assert.strictEqual(result.status, 1, result.stdout);
    assert.match(result.stdout, /publish_waiting needs linked_post/);
  } finally {
    removeDir(dir);
  }
}

function testScorecardNeededActionMustMentionScorecard() {
  const dir = makeTempDir('active-queue-scorecard-action-');
  try {
    const filePath = path.join(dir, 'ACTIVE_TOPIC_QUEUE.md');
    const rows = validRows();
    rows[1] = rows[1].replace('scorecard 작성 후 판단', '바로 작성');
    writeFile(filePath, queueTable(rows));

    const result = runQueue(filePath);

    assert.strictEqual(result.status, 1, result.stdout);
    assert.match(result.stdout, /scorecard_needed action/);
  } finally {
    removeDir(dir);
  }
}

function main() {
  testValidQueuePasses();
  testMissingColumnFails();
  testForbiddenActiveTermFails();
  testForbiddenSpacingVariantFails();
  testRestrictedRiskTextCanPass();
  testForbiddenExcludedTermPasses();
  testTooManyRowsFails();
  testPublishWaitingNeedsLinkedPost();
  testScorecardNeededActionMustMentionScorecard();
  console.log('active queue validation tests passed');
}

main();
