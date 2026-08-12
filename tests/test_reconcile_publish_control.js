const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const script = path.join(root, 'scripts', 'reconcile_publish_control.js');

function writeFixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'publish-control-reconcile-'));
  const registry = path.join(dir, 'POSTING_REGISTRY.json');
  const controlRoot = path.join(dir, 'publish_control');
  const controlDir = path.join(controlRoot, '181_sample');
  const statusPath = path.join(controlDir, 'STATUS.md');

  fs.mkdirSync(controlDir, { recursive: true });
  fs.writeFileSync(registry, `${JSON.stringify({
    schema_version: 1,
    blocks: [
      {
        type: 'table',
        header: ['#', '파일', 'URL', '콘텐츠/URL 상태'],
        rows: [
          ['181', '181_sample.md', '[링크](https://blog.naver.com/doorgeneral/224371153096)', '발행완료·URL등록완료'],
        ],
      },
    ],
  }, null, 2)}\n`, 'utf8');

  const status = `# STATUS - 181_sample

- Publish allowed: \`NO\`
- Post QA: \`PASS\`
- Registry status: \`작성완료\`
- Evidence status: \`field-story-slot\`
- Published URL: \`\`

| Check | Status | Note |
| --- | --- | --- |
| Field story real-case swap | pending | 직원이 실제 AppSheet 현장으로 교체 필요 |
| Human approval | pending | APPROVAL_LOG.md 미작성 |
`;
  fs.writeFileSync(statusPath, status, 'utf8');

  return { dir, registry, controlRoot, statusPath, originalStatus: status };
}

function run(args) {
  return spawnSync(process.execPath, [script, ...args], {
    cwd: root,
    encoding: 'utf8',
  });
}

function testDryRunDoesNotChangeLocalStatus() {
  const fixture = writeFixture();
  try {
    const result = run([
      '--registry', fixture.registry,
      '--control-root', fixture.controlRoot,
      '--posts', '181',
      '--owner-confirmed-field-story', '181',
      '--today', '2026-08-12',
      '--json',
    ]);

    assert.strictEqual(result.status, 0, result.stderr || result.stdout);
    const payload = JSON.parse(result.stdout);
    assert.strictEqual(payload.planned, 1);
    assert.strictEqual(payload.written, 0);
    assert.strictEqual(fs.readFileSync(fixture.statusPath, 'utf8'), fixture.originalStatus);
  } finally {
    fs.rmSync(fixture.dir, { recursive: true, force: true });
  }
}

function testWriteReconcilesPublishedStateWithoutInventingApprovalArtifacts() {
  const fixture = writeFixture();
  try {
    const result = run([
      '--registry', fixture.registry,
      '--control-root', fixture.controlRoot,
      '--posts', '181',
      '--owner-confirmed-field-story', '181',
      '--today', '2026-08-12',
      '--write',
      '--json',
    ]);

    assert.strictEqual(result.status, 0, result.stderr || result.stdout);
    const payload = JSON.parse(result.stdout);
    assert.strictEqual(payload.planned, 1);
    assert.strictEqual(payload.written, 1);

    const updated = fs.readFileSync(fixture.statusPath, 'utf8');
    assert.match(updated, /- Publish allowed: `NO`/);
    assert.match(updated, /- Registry status: `발행완료·URL등록완료`/);
    assert.match(updated, /- Published URL: `https:\/\/blog\.naver\.com\/doorgeneral\/224371153096`/);
    assert.match(updated, /- Publication reconciliation: `published_registry_confirmed:2026-08-12`/);
    assert.match(updated, /\| Field story real-case swap \| owner_confirmed \|/);
    assert.match(updated, /\| Human approval \| historical_record_missing \|/);
    assert.strictEqual(fs.existsSync(path.join(path.dirname(fixture.statusPath), 'APPROVAL_LOG.md')), false);
    assert.strictEqual(fs.existsSync(path.join(path.dirname(fixture.statusPath), 'APPROVED_BODY.md')), false);
  } finally {
    fs.rmSync(fixture.dir, { recursive: true, force: true });
  }
}

testDryRunDoesNotChangeLocalStatus();
testWriteReconcilesPublishedStateWithoutInventingApprovalArtifacts();
console.log('publish control reconciliation tests passed');
