function parseDataDate(content) {
  const match = String(content || '').match(/^>\s*(?:전일\s*확정\s*데이터|확정\s*데이터|데이터)\s*기준일:\s*(\d{4}-\d{2}-\d{2})\s*$/m);
  return match ? match[1] : '';
}

function dateRange(from, to) {
  const values = [];
  const cursor = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  while (cursor <= end) {
    values.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return values;
}

function missingDates(dates, from, to) {
  const found = new Set(dates || []);
  return dateRange(from, to).filter((date) => !found.has(date));
}

module.exports = { dateRange, missingDates, parseDataDate };
