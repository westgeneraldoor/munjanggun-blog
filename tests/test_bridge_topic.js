const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { scopeVerdict, duplicateCheck } = require('../scripts/topic_candidate');
const {
  validateBridgeCandidate,
  parentVerdict,
  relationVerdict,
  bridgeDuplicateSummary,
} = require('../scripts/lib/bridge_topic');

const root = path.resolve(__dirname, '..');
const scope = JSON.parse(fs.readFileSync(path.join(root, 'config', 'product_scope.json'), 'utf8'));

const policy = {
  relation_types: {
    sequencing: { label: '공정 순서', human_review: false },
    cause_diagnosis: { label: '원인 분리', human_review: true },
    lifestyle_friction: { label: '생활 문제', human_review: false },
  },
  known_parent_contexts: [
    { term: '입주청소', rule: '청소와 문 시공 순서로만 연결' },
    { term: '창호', rule: '외풍 원인 분리로만 연결' },
  ],
};

function fixtureContext(entries = [], volumes = []) {
  return {
    scope,
    policy,
    entries,
    volumes,
    scopeVerdict,
    duplicateCheck,
  };
}

function validCandidate(overrides = {}) {
  return {
    parent_keyword: '입주청소',
    service_keyword: '중문설치',
    relation_type: 'sequencing',
    customer_question: '입주청소를 먼저 하면 중문 설치 후 다시 청소해야 하나?',
    dependency_statement: '중문 설치의 분진과 작업 동선 때문에 청소와 문 시공 순서를 함께 정해야 한다.',
    ...overrides,
  };
}

function testKnownParentPassesAsBridgeContext() {
  const result = parentVerdict('입주청소', policy, scope);
  assert.strictEqual(result.level, 'PASS');
  assert.strictEqual(result.code, 'PARENT_CONTEXT_KNOWN');
}

function testUnknownParentWarnsInsteadOfBlocking() {
  const result = validateBridgeCandidate(validCandidate({
    parent_keyword: '로봇청소기',
    service_keyword: '문턱제거',
    relation_type: 'lifestyle_friction',
    customer_question: '로봇청소기가 방문 문턱을 계속 넘지 못하면 무엇부터 봐야 할까?',
    dependency_statement: '방문 문턱과 바닥 단차 때문에 로봇청소기 이동이 막힌다.',
  }), fixtureContext());
  assert.strictEqual(result.blocked, false);
  assert.ok(result.warnings.some((item) => item.code === 'NEW_PARENT_KEYWORD'));
}

function testExcludedProductCannotBypassBridgeLane() {
  const result = validateBridgeCandidate(validCandidate({
    parent_keyword: '폴딩도어',
    customer_question: '폴딩도어 공사와 중문 설치 중 무엇을 먼저 해야 할까?',
    dependency_statement: '폴딩도어와 중문 설치 순서를 정해야 한다.',
  }), fixtureContext());
  assert.strictEqual(result.blocked, true);
  assert.ok(result.blocks.some((item) => item.code === 'PARENT_EXCLUDED_PRODUCT'));
}

function testPermanentExclusionCannotBypassBridgeLane() {
  const result = parentVerdict('현관문 인테리어', policy, scope);
  assert.strictEqual(result.level, 'BLOCK');
  assert.strictEqual(result.code, 'PARENT_PERMANENT_EXCLUSION');
}

function testUnknownRelationBlocks() {
  const result = relationVerdict('keyword_decoration', policy);
  assert.strictEqual(result.level, 'BLOCK');
  assert.strictEqual(result.code, 'RELATION_UNKNOWN');
}

function testMissingDependencyBlocks() {
  const result = validateBridgeCandidate(validCandidate({ dependency_statement: '' }), fixtureContext());
  assert.ok(result.blocks.some((item) => item.code === 'DEPENDENCY_REQUIRED'));
}

function testDependencyRequiresConcreteDoorConnection() {
  const result = validateBridgeCandidate(validCandidate({
    dependency_statement: '검색한 사람이 문제 때문에 순서를 함께 정해야 한다.',
  }), fixtureContext());
  assert.ok(result.blocks.some((item) => item.code === 'DEPENDENCY_SERVICE_CONNECTION_REQUIRED'));
}

function testServiceScopeBlockIsPreserved() {
  const result = validateBridgeCandidate(validCandidate({
    service_keyword: '터닝도어',
    dependency_statement: '터닝도어와 입주청소 순서를 함께 정해야 한다.',
  }), fixtureContext());
  assert.ok(result.blocks.some((item) => item.code === 'SERVICE_SCOPE_BLOCK'));
}

function testNonDoorServiceCannotEnterBridgeLane() {
  const result = validateBridgeCandidate(validCandidate({
    service_keyword: '입주청소',
    dependency_statement: '입주청소 일정을 먼저 정해야 한다.',
  }), fixtureContext());
  assert.ok(result.blocks.some((item) => item.code === 'SERVICE_DOMAIN_REQUIRED'));
}

function testHumanReviewRelationWarns() {
  const result = validateBridgeCandidate(validCandidate({
    parent_keyword: '창호',
    relation_type: 'cause_diagnosis',
    customer_question: '외풍이 창호 때문인지 중문이 필요한지 어떻게 나눌까?',
    dependency_statement: '창호 틈과 현관 중문 영역을 나눠 외풍 원인을 확인해야 한다.',
  }), fixtureContext());
  assert.ok(result.warnings.some((item) => item.code === 'RELATION_HUMAN_REVIEW'));
}

function testBridgeDuplicateSummaryShowsParentServiceAndQuestionMatches() {
  const entries = [
    { no: '116', text: '입주청소 중문설치 순서 입주청소를 먼저 하면 중문 설치 후 다시 청소해야 하나', title: '중문 설치 시점', topic: '입주 전후 순서' },
    { no: '180', text: '중문설치 거주중 분진', title: '거주중 중문설치', topic: '분진 통제' },
  ];
  const result = bridgeDuplicateSummary(validCandidate(), entries, scope, duplicateCheck);
  assert.ok(result.parent.some((item) => item.no === '116'));
  assert.ok(result.service.exact.includes('116'));
  assert.ok(result.question.some((item) => item.no === '116'));
}

function testExactQuestionAlreadyRegisteredBlocks() {
  const entries = [{
    no: '201',
    text: '입주청소 중문설치 입주청소를 먼저 하면 중문 설치 후 다시 청소해야 하나',
    title: '입주청소를 먼저 하면 중문 설치 후 다시 청소해야 하나?',
    topic: '청소와 중문 설치 순서',
  }];
  const result = validateBridgeCandidate(validCandidate(), fixtureContext(entries));
  assert.ok(result.blocks.some((item) => item.code === 'QUESTION_ALREADY_REGISTERED'));
}

function testExactParentVolumeIsReturned() {
  const result = validateBridgeCandidate(validCandidate(), fixtureContext([], [
    { keyword: '입주청소', total: 74350, competition: '중간' },
  ]));
  assert.deepStrictEqual(result.volume, { keyword: '입주청소', total: 74350, competition: '중간' });
}

function main() {
  testKnownParentPassesAsBridgeContext();
  testUnknownParentWarnsInsteadOfBlocking();
  testExcludedProductCannotBypassBridgeLane();
  testPermanentExclusionCannotBypassBridgeLane();
  testUnknownRelationBlocks();
  testMissingDependencyBlocks();
  testDependencyRequiresConcreteDoorConnection();
  testServiceScopeBlockIsPreserved();
  testNonDoorServiceCannotEnterBridgeLane();
  testHumanReviewRelationWarns();
  testBridgeDuplicateSummaryShowsParentServiceAndQuestionMatches();
  testExactQuestionAlreadyRegisteredBlocks();
  testExactParentVolumeIsReturned();
  console.log('bridge topic tests passed');
}

main();
