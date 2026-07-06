const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

function fromRoot(...segments) {
  return path.join(root, ...segments);
}

function assertFile(relativePath) {
  const fullPath = fromRoot(...relativePath.split('/'));
  if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isFile()) {
    throw new Error(`Required file is missing: ${relativePath}`);
  }
}

function assertDir(relativePath) {
  const fullPath = fromRoot(...relativePath.split('/'));
  if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isDirectory()) {
    throw new Error(`Required directory is missing: ${relativePath}`);
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
  'outputs/reports/topic_candidates',
  'outputs/dashboards',
  'scripts/lib',
].forEach(assertDir);

[
  'AGENTS.md',
  'README.md',
  'docs/strategy/BRAND_CONTEXT.md',
  'docs/strategy/SEO_KEYWORD_RESEARCH.md',
  'docs/strategy/CONTENT_PLAN.md',
  'docs/strategy/POSTING_REGISTRY.md',
  'docs/operations/PREPUBLISH_CHECKLIST.md',
  'outputs/reports/top10_analysis.md',
  'outputs/reports/freshness_check.md',
  'outputs/reports/ranking_changes_summary.md',
  'outputs/reports/topic_candidates/TOPIC_SCORECARD_TEMPLATE.md',
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
    throw new Error(`Config array is empty: ${relativePath}`);
  }
});

const history = readJson('data/processed/tracking_history.json');
if (!Array.isArray(history.records)) {
  throw new Error('data/processed/tracking_history.json records must be an array.');
}

const postsDir = fromRoot('posts');
const localPosts = fs.existsSync(postsDir)
  ? fs.readdirSync(postsDir).filter((name) => name.endsWith('.md'))
  : [];

console.log(
  `Structure validation complete: local-only posts ${localPosts.length}, tracking records ${history.records.length}`
);
