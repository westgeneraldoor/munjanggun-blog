const assert = require('assert');
const { missingDates, parseDataDate } = require('../scripts/lib/daily_coverage');

assert.strictEqual(parseDataDate('> 데이터 기준일: 2026-08-17\n'), '2026-08-17');
assert.strictEqual(parseDataDate('> 전일 확정 데이터 기준일: 2026-07-14\n'), '2026-07-14');
assert.strictEqual(parseDataDate('> 확정 데이터 기준일: 2026-07-16\n'), '2026-07-16');
assert.deepStrictEqual(
  missingDates(['2026-08-12', '2026-08-17'], '2026-08-12', '2026-08-17'),
  ['2026-08-13', '2026-08-14', '2026-08-15', '2026-08-16'],
  '하루라도 빠진 일간 통계/TOP20은 운영 검증에서 드러나야 한다'
);
assert.deepStrictEqual(missingDates(['2026-08-12', '2026-08-13'], '2026-08-12', '2026-08-13'), []);

console.log('daily coverage guard tests passed');
