const assert = require('assert');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const cli = path.join(root, 'scripts', 'bridge_topic_candidate.js');

function run(args) {
  return spawnSync(process.execPath, [cli, ...args], { cwd: root, encoding: 'utf8' });
}

function validArgs(overrides = {}) {
  const values = {
    parent: '입주박람회',
    service: '중문설치',
    relation: 'sequencing',
    question: '입주박람회에서 계약한 중문은 언제 실측해야 할까?',
    dependency: '중문 제작 전에 현관 실측과 입주 일정을 맞춰야 한다.',
    ...overrides,
  };
  return Object.entries(values).flatMap(([key, value]) => [`--${key}`, value]);
}

function testCombinedPhraseIsNotTreatedAsProductName() {
  const result = run(validArgs());
  assert.strictEqual(result.status, 0, result.stdout || result.stderr);
  assert.match(result.stdout, /서비스 취급 범위: PASS/);
  assert.doesNotMatch(result.stdout, /미취급 추정/);
  assert.match(result.stdout, /NEW_PARENT_KEYWORD/);
}

function testMissingRequiredFlagBlocks() {
  const result = run(['--parent', '입주청소']);
  assert.strictEqual(result.status, 1);
  assert.match(result.stderr + result.stdout, /필수 인자 누락/);
  assert.match(result.stderr + result.stdout, /--service/);
}

function testExcludedServiceBlocks() {
  const result = run(validArgs({
    parent: '입주청소',
    service: '터닝도어',
    question: '입주청소 전에 터닝도어 공사를 해도 될까?',
    dependency: '터닝도어 공사와 입주청소 순서를 함께 정해야 한다.',
  }));
  assert.strictEqual(result.status, 1, result.stdout);
  assert.match(result.stdout, /SERVICE_SCOPE_BLOCK/);
}

function testKnownParentPrintsVolumeWhenDataExistsOrMissingState() {
  const result = run(validArgs({
    parent: '입주청소',
    question: '입주청소를 먼저 하면 중문 설치 후 다시 청소해야 하나?',
    dependency: '중문 설치의 분진 때문에 입주청소와 문 시공 순서를 함께 정해야 한다.',
  }));
  assert.match(result.stdout, /부모 검색량:/);
  assert.match(result.stdout, /PARENT_CONTEXT_KNOWN/);
}

function main() {
  testCombinedPhraseIsNotTreatedAsProductName();
  testMissingRequiredFlagBlocks();
  testExcludedServiceBlocks();
  testKnownParentPrintsVolumeWhenDataExistsOrMissingState();
  console.log('bridge topic candidate CLI tests passed');
}

main();
