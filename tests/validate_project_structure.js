const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

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

function assertGitDoesNotTrack(relativePath) {
  const result = spawnSync('git', ['ls-files', relativePath], {
    cwd: root,
    encoding: 'utf8',
  });

  if (result.status !== 0) {
    throw new Error(`git ls-files failed for ${relativePath}: ${result.stderr || result.stdout}`);
  }

  if (result.stdout.trim()) {
    throw new Error(`Local-only path is tracked by git: ${relativePath}`);
  }
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
  '.env.example',
  'config/post_validation_policy.json',
  'docs/strategy/BRAND_CONTEXT.md',
  'docs/strategy/SEO_KEYWORD_RESEARCH.md',
  'docs/strategy/CONTENT_PLAN.md',
  'docs/strategy/ACTIVE_TOPIC_QUEUE.json',
  'docs/strategy/POSTING_REGISTRY.md',
  'docs/strategy/POSTING_REGISTRY.json',
  'docs/operations/PREPUBLISH_CHECKLIST.md',
  'data/raw/keyword_data_product.meta.json',
  'data/raw/keyword_data_지역.meta.json',
  'data/processed/keyword_data_product_relevant.meta.json',
  'data/processed/keyword_data_지역_30이상.meta.json',
  'outputs/reports/top10_analysis.md',
  'outputs/reports/freshness_check.md',
  'outputs/reports/ranking_changes_summary.md',
  'outputs/reports/topic_candidates/TOPIC_SCORECARD_TEMPLATE.md',
  'data/processed/tracking_history.json',
  'outputs/dashboards/ranking_dashboard.html',
  'outputs/dashboards/vendor/chart.umd.js',
  'scripts/lib/paths.js',
  'scripts/lib/file_store.js',
  'scripts/lib/public_safety.js',
  'scripts/lib/post_validation_policy.js',
  'scripts/lib/posting_registry.js',
  'scripts/lib/naver_blog_results.js',
  'scripts/normalize_keyword_outputs.js',
  'scripts/render_strategy_docs.js',
  'tests/test_env_loader.js',
  'tests/test_naver_blog_results.js',
  'tests/test_posting_registry.js',
].forEach(assertFile);

[
  '.env',
  'posts',
  'outputs/checks',
  'outputs/publish_control',
].forEach(assertGitDoesNotTrack);

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
