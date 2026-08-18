const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { buildTrackingTargets, dedupEntries, postingEntries, findRegisteredUrlsWithoutPublicationDates } = require('../scripts/lib/posting_registry');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'posting-registry-'));
const sourcePath = path.join(dir, 'POSTING_REGISTRY.json');

fs.writeFileSync(sourcePath, JSON.stringify({
  schema_version: 1,
  blocks: [
    {
      type: 'table',
      header: ['#', 'URL'],
      rows: [
        ['003', 'https://blog.naver.com/doorgeneral/333'],
        ['005', 'https://blog.naver.com/doorgeneral/555'],
        ['021', 'https://blog.naver.com/doorgeneral/211'],
        ['022', 'https://blog.naver.com/doorgeneral/222'],
      ],
    },
    {
      type: 'table',
      header: ['글', '추적 키워드'],
      rows: [
        ['003', '스윙도어, 타공도어'],
        ['005', '타공도어'],
        ['021', '스윙도어'],
      ],
    },
    {
      type: 'table',
      header: ['#', 'URL', '발행일'],
      rows: [
        ['003', 'https://blog.naver.com/doorgeneral/333', '2026-08-12'],
      ],
    },
    {
      type: 'table',
      header: ['#', '파일', '타겟 키워드', '포스트 제목', 'URL', '콘텐츠/URL 상태', '소재 요약'],
      rows: [
        ['145', '145_세탁실문교체비용문틀상태.md', '세탁실문교체, 세탁실문교체비용', '세탁실 문 교체비용, 문틀 상태에 따라 달라지는 기준', '-', '작성완료·URL등록대기', '문틀 하부 습기와 세탁기 간섭 기준'],
      ],
    },
  ],
}), 'utf8');

const targets = buildTrackingTargets([
  { keyword: '스윙도어', hub: '021' },
  { keyword: '타공도어', hub: 'H5/022' },
  { keyword: '일반키워드', hub: '', postNo: '003' },
], sourcePath);

assert.strictEqual(targets[0].postNo, '021');
assert.strictEqual(targets[0].postId, '211');
assert.strictEqual(targets[1].postNo, '022');
assert.strictEqual(targets[1].postId, '222');
assert.strictEqual(targets[2].postNo, '003');
assert.strictEqual(targets[2].postId, '333');

const entries = postingEntries(sourcePath);
assert.strictEqual(entries.find((entry) => entry.postNo === '003').publishedAt, '2026-08-12', '동일 URL의 발행일 보강 행은 기존 URL 행에 합쳐져야 한다');
assert.deepStrictEqual(
  findRegisteredUrlsWithoutPublicationDates(sourcePath),
  ['005', '021', '022'],
  'URL이 등록됐지만 발행일이 없는 글은 검증 차단 대상으로 식별해야 한다',
);

const protectedEntries = dedupEntries(sourcePath);
const urlPendingEntry = protectedEntries.find((entry) => entry.postNo === '145');
assert.ok(urlPendingEntry, '작성완료·URL등록대기 원고도 중복 방지 원장에 남아야 한다');
assert.strictEqual(urlPendingEntry.url, null);
assert.strictEqual(urlPendingEntry.dedupStatus, '작성완료·URL등록대기');
assert.strictEqual(urlPendingEntry.isDedupProtected, true);

const liveTrackingConfig = require('../config/tracking_keywords.json');
const requiredSearchBlindSpots = [
  ['자동중문', '028'],
  ['방음중문', '040'],
  ['반려동물중문', '040'],
  ['반려견 소음', '040'],
  ['간살중문', '023'],
  ['간살중문', '092'],
  ['문틀교체 썩음', '024'],
  ['중문업체', '058'],
  ['중문 시공업체 선택', '058'],
  ['신발장 간섭', '039'],
  ['살면서 방문교체', '083'],
];

requiredSearchBlindSpots.forEach(([keyword, postNo]) => {
  assert.ok(
    liveTrackingConfig.some((item) => item.keyword === keyword && item.postNo === postNo),
    `검색 순위 계측 사각지대가 없어야 한다: ${keyword} -> ${postNo}`,
  );
});

const blindSpotTargets = buildTrackingTargets(liveTrackingConfig)
  .filter((target) => requiredSearchBlindSpots.some(([keyword, postNo]) => target.keyword === keyword && target.postNo === postNo));
assert.strictEqual(blindSpotTargets.length, requiredSearchBlindSpots.length);
assert.strictEqual(
  new Set(blindSpotTargets.map((target) => target.trackingId)).size,
  blindSpotTargets.length,
  '같은 키워드가 여러 원본에 연결돼도 URL 기반 trackingId는 서로 달라야 한다',
);
assert.ok(blindSpotTargets.every((target) => target.matchMode === 'url' && target.postId));

console.log('posting registry target mapping tests passed');
