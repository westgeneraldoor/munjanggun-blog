const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { loadEnv, parseEnvContent } = require('../scripts/lib/env_loader');

function testParseEnvContent() {
  const parsed = parseEnvContent([
    '# ignored',
    'PLAIN=value',
    'SPACED = value with spaces # comment',
    'HASH_IN_QUOTES="value # not comment"',
    "SINGLE='literal # not comment'",
    'ESCAPED="line\\nnext\\tcell"',
    'export EXPORTED=ok',
    'EMPTY=',
    'WINDOWS_PATH=C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'BAD-KEY=ignored',
  ].join('\n'));

  assert.strictEqual(parsed.PLAIN, 'value');
  assert.strictEqual(parsed.SPACED, 'value with spaces');
  assert.strictEqual(parsed.HASH_IN_QUOTES, 'value # not comment');
  assert.strictEqual(parsed.SINGLE, 'literal # not comment');
  assert.strictEqual(parsed.ESCAPED, 'line\nnext\tcell');
  assert.strictEqual(parsed.EXPORTED, 'ok');
  assert.strictEqual(parsed.EMPTY, '');
  assert.strictEqual(parsed.WINDOWS_PATH, 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe');
  assert.strictEqual(parsed['BAD-KEY'], undefined);
}

function testLoadEnvDoesNotOverrideByDefault() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'env-loader-'));
  const envPath = path.join(dir, '.env');
  const target = { EXISTING: 'from-shell' };
  try {
    fs.writeFileSync(envPath, 'EXISTING=from-file\nNEW_VALUE=yes\n', 'utf8');
    const parsed = loadEnv({ envPath, target });
    assert.strictEqual(parsed.EXISTING, 'from-file');
    assert.strictEqual(target.EXISTING, 'from-shell');
    assert.strictEqual(target.NEW_VALUE, 'yes');

    loadEnv({ envPath, target, override: true });
    assert.strictEqual(target.EXISTING, 'from-file');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function main() {
  testParseEnvContent();
  testLoadEnvDoesNotOverrideByDefault();
  console.log('env loader tests passed');
}

main();
