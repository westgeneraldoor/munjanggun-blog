const fs = require('fs');
const path = require('path');

function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function readJsonFile(filePath, fallback = null) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (err) {
    throw new Error(`JSON 파일을 읽을 수 없습니다: ${filePath} (${err.message})`);
  }
}

function writeTextFile(filePath, content) {
  ensureDir(filePath);
  const tmpPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmpPath, content, 'utf8');
  if (fs.existsSync(filePath)) {
    fs.copyFileSync(filePath, `${filePath}.bak`);
  }
  fs.renameSync(tmpPath, filePath);
}

function writeJsonFile(filePath, data) {
  writeTextFile(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

module.exports = {
  readJsonFile,
  writeTextFile,
  writeJsonFile,
};
