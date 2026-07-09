const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  findPublicTextIssues,
  hasMojibake,
  hasReplacementChar,
  sanitizePublicText,
  sanitizeMarkdownCell,
  walkFiles,
} = require('../scripts/lib/public_safety');

function testSanitizeMasksContacts() {
  const text = '업체명010-2744-4955 contact@example.com 010 1234 5678';
  const sanitized = sanitizePublicText(text);
  assert(!sanitized.includes('010-2744-4955'));
  assert(!sanitized.includes('contact@example.com'));
  assert.strictEqual((sanitized.match(/\[연락처 비공개\]/g) || []).length, 2);
  assert(sanitized.includes('[이메일 비공개]'));
  assert.strictEqual(sanitizeMarkdownCell('a|b\n010-1234-5678'), 'a/b [연락처 비공개]');
}

function testReplacementCharDetection() {
  assert.strictEqual(hasReplacementChar('슬라이딩��어'), true);
  assert.strictEqual(hasReplacementChar('슬라이딩도어'), false);
}

function testMojibakeDetection() {
  assert.strictEqual(hasMojibake('검색어 클러스터 (寃?됱뼱 ?대윭?ㅽ꽣)'), true);
  assert.strictEqual(hasMojibake('새댁 집호랭이, 살림하다'), false);
}

function testIssueScanner() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'public-safety-'));
  const filePath = path.join(dir, 'report.md');
  try {
    fs.writeFileSync(filePath, '깨진��문자\n연락처 010-1234-5678\n게시글 TOP 20 (寃뚯떆湲 TOP 20)\n', 'utf8');
    const files = walkFiles(dir, ['.md']);
    const issues = findPublicTextIssues(files);
    assert(issues.some((issue) => issue.code === 'REPLACEMENT_CHAR_FOUND'));
    assert(issues.some((issue) => issue.code === 'CONTACT_PATTERN_FOUND'));
    assert(issues.some((issue) => issue.code === 'MOJIBAKE_TEXT_FOUND'));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function main() {
  testSanitizeMasksContacts();
  testReplacementCharDetection();
  testMojibakeDetection();
  testIssueScanner();
  console.log('public safety tests passed');
}

main();
