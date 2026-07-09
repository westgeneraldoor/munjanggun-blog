const fs = require('fs');
const path = require('path');

const REPLACEMENT_CHAR = '\uFFFD';
const PHONE_PATTERN = /(^|[^0-9])(01[016789][-\s.]?\d{3,4}[-\s.]?\d{4})(?=$|[^0-9])/g;
const EMAIL_PATTERN = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const MOJIBAKE_PATTERNS = [
  /寃\?됱뼱/,
  /\?대윭\?ㅽ꽣/,
  /寃뚯떆湲/,
  /\?좎엯寃쎈줈/,
  /\?붿빟/,
  /珥앷큵/,
  /\?먮떒/,
];

function hasReplacementChar(value) {
  return String(value || '').includes(REPLACEMENT_CHAR);
}

function hasMojibake(value) {
  const text = String(value || '');
  return MOJIBAKE_PATTERNS.some((pattern) => pattern.test(text));
}

function sanitizePublicText(value) {
  return String(value || '')
    .replace(PHONE_PATTERN, '$1[연락처 비공개]')
    .replace(EMAIL_PATTERN, '[이메일 비공개]');
}

function sanitizeMarkdownCell(value) {
  return sanitizePublicText(value)
    .replace(/\|/g, '/')
    .replace(/\r?\n/g, ' ')
    .trim();
}

function walkFiles(dir, extensions, ignore = () => false) {
  if (!fs.existsSync(dir)) return [];
  const files = [];
  fs.readdirSync(dir, { withFileTypes: true }).forEach((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (ignore(fullPath)) return;
    if (entry.isDirectory()) {
      files.push(...walkFiles(fullPath, extensions, ignore));
      return;
    }
    if (extensions.includes(path.extname(entry.name).toLowerCase())) files.push(fullPath);
  });
  return files;
}

function findPublicTextIssues(files) {
  const issues = [];
  files.forEach((filePath) => {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split(/\r?\n/);
    lines.forEach((line, index) => {
      if (hasReplacementChar(line)) {
        issues.push({
          code: 'REPLACEMENT_CHAR_FOUND',
          filePath,
          line: index + 1,
          message: '공개 산출물에 깨진 문자(U+FFFD)가 남아 있습니다.',
        });
      }

      if (hasMojibake(line)) {
        issues.push({
          code: 'MOJIBAKE_TEXT_FOUND',
          filePath,
          line: index + 1,
          message: '공개 산출물에 인코딩이 깨진 mojibake 문자열이 남아 있습니다.',
        });
      }

      if (PHONE_PATTERN.test(line)) {
        issues.push({
          code: 'CONTACT_PATTERN_FOUND',
          filePath,
          line: index + 1,
          message: '공개 산출물에 전화번호 형태 문자열이 남아 있습니다.',
        });
      }
      PHONE_PATTERN.lastIndex = 0;

      if (EMAIL_PATTERN.test(line)) {
        issues.push({
          code: 'EMAIL_PATTERN_FOUND',
          filePath,
          line: index + 1,
          message: '공개 산출물에 이메일 주소 형태 문자열이 남아 있습니다.',
        });
      }
      EMAIL_PATTERN.lastIndex = 0;
    });
  });
  return issues;
}

module.exports = {
  REPLACEMENT_CHAR,
  hasReplacementChar,
  hasMojibake,
  sanitizePublicText,
  sanitizeMarkdownCell,
  walkFiles,
  findPublicTextIssues,
};
