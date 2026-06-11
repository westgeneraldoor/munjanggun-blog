const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

function fromRoot(...segments) {
  return path.join(root, ...segments);
}

function assertFile(relativePath) {
  const fullPath = fromRoot(...relativePath.split('/'));
  if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isFile()) {
    throw new Error(`필수 파일이 없습니다: ${relativePath}`);
  }
}

function assertDir(relativePath) {
  const fullPath = fromRoot(...relativePath.split('/'));
  if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isDirectory()) {
    throw new Error(`필수 폴더가 없습니다: ${relativePath}`);
  }
}

function readJson(relativePath) {
  const fullPath = fromRoot(...relativePath.split('/'));
  return JSON.parse(fs.readFileSync(fullPath, 'utf8'));
}

[
  'config',
  'data/raw',
  'data/processed',
  'docs/strategy',
  'docs/operations',
  'outputs/reports',
  'outputs/dashboards',
  'posts',
  'scripts/lib',
].forEach(assertDir);

[
  'AGENTS.md',
  'README.md',
  'docs/strategy/BRAND_CONTEXT.md',
  'docs/strategy/SEO_KEYWORD_RESEARCH.md',
  'docs/strategy/CONTENT_PLAN.md',
  'docs/strategy/POSTING_REGISTRY.md',
  'outputs/reports/top10_analysis.md',
  'data/processed/tracking_history.json',
  'outputs/dashboards/ranking_dashboard.html',
  'scripts/lib/paths.js',
  'scripts/lib/file_store.js',
].forEach(assertFile);

[
  'config/tracking_keywords.json',
  'config/top10_keywords.json',
  'config/regional_seed_keywords.json',
  'config/product_seed_keywords.json',
].forEach((relativePath) => {
  const value = readJson(relativePath);
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`설정 배열이 비어 있습니다: ${relativePath}`);
  }
});

const history = readJson('data/processed/tracking_history.json');
if (!Array.isArray(history.records)) {
  throw new Error('data/processed/tracking_history.json의 records가 배열이 아닙니다.');
}

const posts = fs.readdirSync(fromRoot('posts')).filter((name) => name.endsWith('.md'));
if (posts.length < 1) {
  throw new Error('posts 폴더에 원고가 없습니다.');
}

console.log(`구조 검증 완료: posts ${posts.length}개, tracking records ${history.records.length}개`);
