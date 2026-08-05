const assert = require('assert');
const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const cli = path.join(root, 'scripts', 'topic_candidate.js');
const { scopeVerdict, duplicateCheck, clusterStatus, registryEntries } = require('../scripts/topic_candidate');
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
  // 라이브 등록부를 읽으므로 등록되지 않은 키워드를 쓴다.
  const result = run(['--check', '코너몰딩']);
  assert.strictEqual(result.status, 0, result.stdout);
}

function testExploreExcludesOutOfDomain() {
  const result = run(['--limit=40']);
  assert.strictEqual(result.status, 0, result.stdout);
  assert.doesNotMatch(result.stdout, /도어락/);
  assert.doesNotMatch(result.stdout, /리모델링/);
}

// 2026-07-27 Codex가 마이너스몰딩을 올렸으나 130번 무몰딩 글과 정면 충돌이었다.
// 문자열이 겹치지 않아 서브토큰만으로는 못 잡는다. 동의어 사전이 필요하다.
function testSynonymDuplicateDetected() {
  const entries = [
    { no: '130', text: '몰딩없는집, 무몰딩, 방문교체, 문선마감 몰딩 없는 집 방문교체' },
    { no: '012', text: '원슬라이딩중문 몰딩 관련 언급만 있음' },
  ];
  const result = duplicateCheck('마이너스몰딩', entries, scope);
  assert.strictEqual(result.near[0][0], '130', JSON.stringify(result.near));
  assert.match(result.near[0][1], /동의어/);
}

// 같은 토큰이면 최신 글이 먼저 나와야 한다. 최신 글이 카니발 위험이 크다.
function testNearSortedByRecency() {
  const entries = [
    { no: '012', text: '몰딩 언급' },
    { no: '165', text: '몰딩 언급' },
  ];
  const result = duplicateCheck('평몰딩', entries, scope);
  assert.strictEqual(result.near[0][0], '165', JSON.stringify(result.near));
}

function testGamachiDoorBlocked() {
  assert.strictEqual(scopeVerdict('가마찌도어', scope).level, 'BLOCK');
}

// 제외 목록만으로는 끝나지 않는다. 터닝도어를 막으니 가마찌도어가,
// 그걸 막으니 시스템도어와 프렌치도어가 나왔다. handled 화이트리스트로 닫는다.
function testUnknownProductNamesBlockedByAllowlist() {
  ['시스템도어', '프렌치도어', '오버헤드도어', '판넬도어', '간이중문', '패브릭중문'].forEach((keyword) => {
    assert.strictEqual(scopeVerdict(keyword, scope).level, 'BLOCK', keyword);
  });
}

// 취급 제품과 그 변형은 통과해야 한다.
function testHandledProductsAndVariantsPass() {
  ['ABS도어', 'ABS슬라이딩도어', '3연동중문', '스윙도어', '유리중문', '간살중문'].forEach((keyword) => {
    assert.notStrictEqual(scopeVerdict(keyword, scope).level, 'BLOCK', keyword);
  });
}

// 경쟁사 이름이 붙어도 미취급 제품이면 BLOCK 이어야 한다.
function testCompetitorPrefixDoesNotBypassExclusion() {
  ['KCC터닝도어', '영림펫도어'].forEach((keyword) => {
    assert.strictEqual(scopeVerdict(keyword, scope).level, 'BLOCK', keyword);
  });
}

// 근접 글의 소재를 같이 보여줘야 작업자가 읽는다.
// 글번호만 던지면 소재를 열어보지 않고 짐작으로 넘어간다.
function testRegistryEntriesCarryTitleAndTopic() {
  const registry = JSON.parse(fs.readFileSync(path.join(root, 'docs/strategy/POSTING_REGISTRY.json'), 'utf8'));
  const entries = registryEntries(registry);
  const byNo = new Map(entries.map((e) => [e.no, e]));
  const e023 = byNo.get('023');
  assert.ok(e023.title.length > 0, '023 제목이 비었다');
  assert.match(e023.topic, /답답함/, '023 소재에 답답함이 보여야 한다');
  assert.strictEqual(e023.published, true);
}

// URL 열이 없고 메모 칸에만 링크와 발행 제목이 있는 표가 있다.
function testTitleAndUrlFoundInMemoColumn() {
  const registry = JSON.parse(fs.readFileSync(path.join(root, 'docs/strategy/POSTING_REGISTRY.json'), 'utf8'));
  const byNo = new Map(registryEntries(registry).map((e) => [e.no, e]));
  const e111 = byNo.get('111');
  assert.ok(e111.title.length > 0, '111 제목을 메모에서 못 찾았다');
  assert.strictEqual(e111.published, true, '111 은 발행완료다');
}

// URL등록대기 글은 미발행, 공개 확인 글은 발행완료로 구분해야 한다.
function testPendingAndConfirmedPostsHaveCorrectPublicationState() {
  const registry = JSON.parse(fs.readFileSync(path.join(root, 'docs/strategy/POSTING_REGISTRY.json'), 'utf8'));
  const byNo = new Map(registryEntries(registry).map((e) => [e.no, e]));
  assert.strictEqual(byNo.get('066').published, false);
  assert.strictEqual(byNo.get('170').published, true);
}

// 원고를 쓰고 등록부에 넣지 않으면 다음 글감 선정에서 같은 소재가 다시 올라온다.
// 2026-07-27 174·175 가 미등록 상태였고 검증기가 근접 없음으로 답했다.
function testRegisteredDraftBlocksSameKeyword() {
  const result = run(['--check', '방문잠겼을때']);
  assert.strictEqual(result.status, 1, result.stdout);
  assert.match(result.stdout, /174/);
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
  testRegisteredDraftBlocksSameKeyword();
  testExploreExcludesOutOfDomain();
  testSynonymDuplicateDetected();
  testNearSortedByRecency();
  testGamachiDoorBlocked();
  testUnknownProductNamesBlockedByAllowlist();
  testHandledProductsAndVariantsPass();
  testCompetitorPrefixDoesNotBypassExclusion();
  testRegistryEntriesCarryTitleAndTopic();
  testTitleAndUrlFoundInMemoColumn();
  testPendingAndConfirmedPostsHaveCorrectPublicationState();
  console.log('topic candidate tests passed');
}

main();
