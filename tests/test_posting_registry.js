const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { buildTrackingTargets } = require('../scripts/lib/posting_registry');

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

console.log('posting registry target mapping tests passed');
