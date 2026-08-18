const assert = require('assert');
const { findMatchingPublicCandidates } = require('../scripts/lib/pending_publication_guard');

const pending = {
  postNo: '188',
  title: '문틀교체 전 썩은 정도 3단계로 문짝만 바꿀지 판단',
  targetKeywords: '문틀교체',
  notBeforeDate: '2026-08-13',
};

const candidates = [
  {
    logNo: '224378237976',
    title: '화장실 문틀이 썩었는데 벽지까지 뜯어야 하나 걱정되신다면',
    contents: '썩은 정도에 따라 손대야 하는 범위가 달라집니다. 표면, 골조, 벽체의 3단계로 나눠 문짝과 문틀 교체 범위를 판단합니다.',
    addDate: 1786669320000,
  },
  {
    logNo: '224321111912',
    title: '문틀교체비용 전 꼭 확인할 3가지 범위',
    contents: '문틀교체 비용과 견적을 설명합니다.',
    addDate: 1782032400000,
  },
  {
    logNo: '224286644514',
    title: '썩은 욕실 문틀교체, 살면서 도배 손상 없이 끝내는 법',
    contents: '썩은 정도를 3단계로 나눠 문짝과 문틀 교체 범위를 판단합니다.',
    addDate: 1780088400000,
  },
];

const matches = findMatchingPublicCandidates(pending, candidates);
assert.strictEqual(matches.length, 1, '초안 제목과 달라도 핵심 제목·본문 구성이 맞는 공개 글은 후보로 잡아야 한다');
assert.strictEqual(matches[0].logNo, '224378237976');
assert.ok(matches[0].matchedTokens.includes('3단계'), '후보 판정 근거 토큰을 남겨야 한다');
assert.ok(!matches.some((candidate) => candidate.logNo === '224286644514'), '직전 등록글보다 과거인 유사 원본글은 신규 발행 후보에서 제외해야 한다');

console.log('pending publication guard tests passed');
