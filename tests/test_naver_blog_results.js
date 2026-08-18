const assert = require('assert');
const {
  parseBlogLink,
  collectUniquePostResults,
  findAccountRank,
  collectAccountMatches,
  groupTargetsByKeyword,
  evaluateTargetRanking,
  findRankingEvidenceIssues,
  formatRankingTrendLabel,
  formatHistoryRecordLabels,
} = require('../scripts/lib/naver_blog_results');

assert.strictEqual(typeof collectAccountMatches, 'function', '검색 결과의 문장군 URL 전체를 수집해야 한다');
assert.strictEqual(typeof groupTargetsByKeyword, 'function', '같은 검색어 대상은 한 수집 묶음으로 합쳐야 한다');
assert.strictEqual(typeof evaluateTargetRanking, 'function', '동일 검색 결과에서 대상 URL별 순위를 판정해야 한다');
assert.strictEqual(typeof findRankingEvidenceIssues, 'function', '순위 행과 같은 검색 결과 근거의 연결을 검증해야 한다');

assert.deepStrictEqual(
  parseBlogLink('https://blog.naver.com/doorgeneral/224278984631'),
  {
    blogId: 'doorgeneral',
    postId: '224278984631',
    href: 'https://blog.naver.com/doorgeneral/224278984631',
  },
);

assert.deepStrictEqual(
  parseBlogLink('https://blog.naver.com/PostView.naver?blogId=doorgeneral&logNo=224278984631'),
  {
    blogId: 'doorgeneral',
    postId: '224278984631',
    href: 'https://blog.naver.com/PostView.naver?blogId=doorgeneral&logNo=224278984631',
  },
);

const results = collectUniquePostResults([
  { href: 'https://blog.naver.com/doorgeneral', title: 'profile link must not rank' },
  { href: 'https://blog.naver.com/otherblog/111', title: 'other post' },
  { href: 'https://blog.naver.com/doorgeneral/222', title: 'target post' },
  { href: 'https://blog.naver.com/doorgeneral/222?duplicate=1', title: 'duplicate target' },
  { href: 'https://blog.naver.com/PostView.naver?blogId=doorgeneral&logNo=333', title: 'next post' },
  { href: 'https://blog.naver.com/doorgeneral/444', title: 'clean title새 창 열림' },
]);

assert.deepStrictEqual(
  results.map((item) => `${item.blogId}|${item.postId}`),
  ['otherblog|111', 'doorgeneral|222', 'doorgeneral|333', 'doorgeneral|444'],
);
assert.strictEqual(findAccountRank(results, 'doorgeneral'), 2);
assert.strictEqual(results[3].title, 'clean title', '화면 접근성 문구는 실제 제목에서 제거해야 한다');

assert.deepStrictEqual(
  collectAccountMatches(results, 'doorgeneral', new Map([['222', '185']])),
  [
    {
      rank: 2,
      url: 'https://blog.naver.com/doorgeneral/222',
      logNo: '222',
      postNo: '185',
      title: 'target post',
    },
    {
      rank: 3,
      url: 'https://blog.naver.com/doorgeneral/333',
      logNo: '333',
      postNo: '',
      title: 'next post',
    },
    {
      rank: 4,
      url: 'https://blog.naver.com/doorgeneral/444',
      logNo: '444',
      postNo: '',
      title: 'clean title',
    },
  ],
  '등록부에 없는 logNo는 글번호를 추측하지 않고 빈 값으로 보존해야 한다',
);

assert.deepStrictEqual(
  groupTargetsByKeyword([
    { keyword: '자동중문', postNo: '028', postId: '222' },
    { keyword: '간살중문', postNo: '092', postId: '333' },
    { keyword: '자동중문', postNo: '185', postId: '444' },
  ]).map((group) => [group.keyword, group.targets.map((target) => target.postNo)]),
  [
    ['자동중문', ['028', '185']],
    ['간살중문', ['092']],
  ],
  '같은 검색어의 원본과 새 글은 동일 검색 결과를 공유해야 한다',
);

assert.deepStrictEqual(
  evaluateTargetRanking(results, { postId: '333' }, 'doorgeneral'),
  {
    rank: 3,
    accountRank: 2,
    title: 'next post',
    matchedTitle: 'next post',
    matchedUrl: 'https://blog.naver.com/PostView.naver?blogId=doorgeneral&logNo=333',
    matchType: 'url',
    totalFound: 4,
    note: '',
  },
);

const linkedRecord = {
  rankings: [
    { keyword: '자동중문', postId: '222', rank: 2, totalFound: 4 },
    { keyword: '간살중문', postId: '555', rank: 0, totalFound: 1 },
  ],
  queryEvidence: [
    {
      keyword: '자동중문',
      totalFound: 4,
      error: '',
      accountMatches: [{ rank: 2, logNo: '222' }],
    },
    {
      keyword: '간살중문',
      totalFound: 1,
      error: '',
      accountMatches: [{ rank: 1, logNo: '092' }],
    },
  ],
};
assert.deepStrictEqual(findRankingEvidenceIssues(linkedRecord), []);
assert.ok(
  findRankingEvidenceIssues({
    ...linkedRecord,
    rankings: [{ keyword: '자동중문', postId: '222', rank: 2, totalFound: 3 }],
    queryEvidence: [linkedRecord.queryEvidence[0]],
  }).some((issue) => issue.includes('totalFound')),
  '순위 행과 검색 근거의 수집 개수가 다르면 검증해야 한다',
);
assert.ok(
  findRankingEvidenceIssues({
    ...linkedRecord,
    rankings: [{ keyword: '자동중문', postId: '999', rank: 2, totalFound: 4 }],
    queryEvidence: [linkedRecord.queryEvidence[0]],
  }).some((issue) => issue.includes('rank support')),
  '양수 순위는 같은 logNo와 순위를 가진 계정 검색 결과가 뒷받침해야 한다',
);

assert.strictEqual(formatRankingTrendLabel({ postNo: '185', keyword: '자동중문' }), '185 · 자동중문');
assert.deepStrictEqual(
  formatHistoryRecordLabels([
    { date: '2026-08-18', timestamp: '2026-08-18T05:07:00.000Z' },
    { date: '2026-08-18', timestamp: '2026-08-18T05:45:00.000Z' },
    { date: '2026-08-24', timestamp: '2026-08-24T05:45:00.000Z' },
  ]),
  ['2026-08-18 14:07 KST', '2026-08-18 14:45 KST', '2026-08-24'],
  '같은 날 여러 계측 기록은 시각까지 표시해 서로 다른 실행임을 드러내야 한다',
);

console.log('naver blog result parsing tests passed');
