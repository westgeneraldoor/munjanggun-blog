const assert = require('assert');
const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const cli = path.join(root, 'scripts', 'topic_candidate.js');
const { scopeVerdict, duplicateCheck, clusterStatus } = require('../scripts/topic_candidate');
const scope = JSON.parse(fs.readFileSync(path.join(root, 'config', 'product_scope.json'), 'utf8'));

function run(args) {
  return spawnSync(process.execPath, [cli, ...args], { cwd: root, encoding: 'utf8' });
}

// 2026-07-27 감사에서 확인된 미취급 제품들이다.
// 검색량이 커서 콜드 세션이 글감으로 올릴 위험이 가장 큰 축이다.
function testUnhandledProductsBlocked() {
  ['터닝도어', '폴딩도어', '도어클로저', '펫도어', '포켓도어'].forEach((keyword) => {
    assert.strictEqual(scopeVerdict(keyword, scope).level, 'BLOCK', keyword);
  });
}

function testPermanentExclusionsBlocked() {
  ['현관문', '방화문', '비대칭양개형중문'].forEach((keyword) => {
    assert.strictEqual(scopeVerdict(keyword, scope).level, 'BLOCK', keyword);
  });
}

// 도어락은 도어를 포함하지만 문장군 도메인이 아니다.
function testOutOfDomainBlocked() {
  ['도어락', '화장실리모델링', '욕실타일'].forEach((keyword) => {
    assert.strictEqual(scopeVerdict(keyword, scope).level, 'BLOCK', keyword);
  });
}

// 9MM문선과 9미리문선은 표기가 달라도 같은 전환 규칙을 받아야 한다.
function testKeywordVariantsNormalized() {
  ['9mm문선', '9MM문선', '9미리문선'].forEach((keyword) => {
    const verdict = scopeVerdict(keyword, scope);
    assert.strictEqual(verdict.level, 'WARN', keyword);
    assert.strictEqual(verdict.label, '전환 필요', keyword);
  });
}

function testHandledKeywordPasses() {
  ['방문잠겼을때', '화장실문고리'].forEach((keyword) => {
    assert.strictEqual(scopeVerdict(keyword, scope).level, 'PASS', keyword);
  });
}

function testCompetitorBrandWarns() {
  const verdict = scopeVerdict('영림중문', scope);
  assert.strictEqual(verdict.level, 'WARN');
  assert.strictEqual(verdict.label, '경쟁 브랜드');
}

// 2026-07-27 오전 Codex가 문틀시트지를 글감으로 올렸으나 153번과 중복이었다.
function testExactDuplicateDetected() {
  const entries = [
    { no: '153', text: '방문시트지, 문틀시트지, 문짝시트지 방문교체와 시트지 사이에서 고민된다면?' },
    { no: '140', text: '드레스룸슬라이딩도어, 슬라이딩도어' },
  ];
  const result = duplicateCheck('문틀시트지', entries, scope);
  assert.deepStrictEqual(result.exact, ['153']);
}

function testNearDuplicateDetected() {
  const entries = [{ no: '162', text: '화장실문턱, 화장실문교체 화장실 문턱, 바꾸기 전 확인할 3가지 경계' }];
  const result = duplicateCheck('방문턱제거', entries, scope);
  assert.strictEqual(result.exact.length, 0);
  assert.strictEqual(result.near.length, 1);
  assert.strictEqual(result.near[0][0], '162');
}

// faded 5연속 클러스터는 신규 글감을 막아야 한다.
function testClusterStreakCounted() {
  const posts = [];
  for (let i = 1; i <= 5; i += 1) {
    posts.push({ post_no: `90${i}`, verdict: 'faded', cluster_ids: ['C-TEST'] });
  }
  const stat = clusterStatus({ posts });
  assert.strictEqual(stat.get('C-TEST').streak, 5);
}

// landed 가 나오면 연속이 끊긴다.
function testLandedResetsStreak() {
  const posts = [
    { post_no: '901', verdict: 'faded', cluster_ids: ['C-TEST'] },
    { post_no: '902', verdict: 'faded', cluster_ids: ['C-TEST'] },
    { post_no: '903', verdict: 'landed', cluster_ids: ['C-TEST'] },
    { post_no: '904', verdict: 'faded', cluster_ids: ['C-TEST'] },
  ];
  assert.strictEqual(clusterStatus({ posts }).get('C-TEST').streak, 1);
}

function testCliBlocksOnUnhandledProduct() {
  const result = run(['--check', '터닝도어']);
  assert.strictEqual(result.status, 1, result.stdout);
  assert.match(result.stdout, /BLOCK/);
}

function testCliPassesOnCleanKeyword() {
  const result = run(['--check', '방문잠겼을때']);
  assert.strictEqual(result.status, 0, result.stdout);
}

function testExploreExcludesOutOfDomain() {
  const result = run(['--limit=40']);
  assert.strictEqual(result.status, 0, result.stdout);
  assert.doesNotMatch(result.stdout, /도어락/);
  assert.doesNotMatch(result.stdout, /리모델링/);
}

function main() {
  testUnhandledProductsBlocked();
  testPermanentExclusionsBlocked();
  testOutOfDomainBlocked();
  testKeywordVariantsNormalized();
  testHandledKeywordPasses();
  testCompetitorBrandWarns();
  testExactDuplicateDetected();
  testNearDuplicateDetected();
  testClusterStreakCounted();
  testLandedResetsStreak();
  testCliBlocksOnUnhandledProduct();
  testCliPassesOnCleanKeyword();
  testExploreExcludesOutOfDomain();
  console.log('topic candidate tests passed');
}

main();
