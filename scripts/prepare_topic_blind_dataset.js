const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const DEFAULT_REGISTRY_PATH = path.join(ROOT_DIR, 'docs', 'strategy', 'POSTING_REGISTRY.json');
const DEFAULT_PERFORMANCE_PATH = path.join(ROOT_DIR, 'data', 'performance', 'post_performance.json');

const forbiddenOutcomeFields = [
  'post_no',
  'file',
  'url',
  'published_at',
  'published_at_source',
  'verdict',
  'verdict_reason',
  'observations',
  'rank',
  'views',
  'queue_id',
  'source_refs',
  'hub_ids',
  'cluster_ids',
];

function normalizeHeader(value) {
  return String(value || '').replace(/[\s*_`]/g, '').trim();
}

function normalizePostNo(value) {
  const match = String(value || '').trim().match(/^(\d{1,3})(-\d+)?/);
  if (!match) return '';
  return `${match[1].padStart(3, '0')}${match[2] || ''}`;
}

function registryTopics(registry) {
  const topics = new Map();

  (registry.blocks || [])
    .filter((block) => block.type === 'table' && Array.isArray(block.header) && Array.isArray(block.rows))
    .forEach((block) => {
      const headers = block.header.map(normalizeHeader);
      const postNoIndex = headers.findIndex((header) => header === '#' || header === '글번호' || header === '글');
      const titleIndex = headers.findIndex((header) => header === '포스팅제목' || header === '포스트제목');
      const keywordsIndex = headers.findIndex((header) => header === '타겟키워드');
      const summaryIndex = headers.findIndex((header) => header === '다룬소재(중복방지용)' || header === '소재요약');
      if (postNoIndex < 0 || titleIndex < 0) return;

      block.rows.forEach((row) => {
        const postNo = normalizePostNo(row[postNoIndex]);
        const title = String(row[titleIndex] || '').trim();
        if (!postNo || !title || title === '폐기') return;

        const current = topics.get(postNo) || {
          title: '',
          target_keywords: [],
          topic_summary: '',
        };
        if (!current.title) current.title = title;
        if (current.target_keywords.length === 0 && keywordsIndex >= 0) {
          current.target_keywords = String(row[keywordsIndex] || '')
            .split(',')
            .map((keyword) => keyword.trim())
            .filter(Boolean);
        }
        if (!current.topic_summary && summaryIndex >= 0) {
          current.topic_summary = String(row[summaryIndex] || '').trim();
        }
        topics.set(postNo, current);
      });
    });

  return topics;
}

function blindId(postNo) {
  const digest = crypto
    .createHash('sha256')
    .update(`munjanggun-topic-blind-v1:${postNo}`)
    .digest('hex')
    .slice(0, 12);
  const alphabet = 'abcdefghijklmnop';
  const letterCode = [...digest]
    .map((character) => alphabet[Number.parseInt(character, 16)])
    .join('');
  return `T-${letterCode}`;
}

function replaceDatePattern(text, pattern) {
  return text.replace(pattern, (_match, prefix = '') => `${prefix}[날짜 마스킹]`);
}

function maskDateReferences(value) {
  let text = String(value || '');
  text = replaceDatePattern(text, /(^|[^\d])(?:20)?\d{2}[-/]\d{1,2}[-/]\d{1,2}(?!\d)/g);
  text = replaceDatePattern(text, /(^|[^\d])\d{1,2}월\s*\d{1,2}일(?!\d)/g);
  text = replaceDatePattern(text, /(^|[^\d/])\d{1,2}\/\d{1,2}(?![\d/])/g);
  return text.replace(/20\d\d/g, '[날짜 마스킹]');
}

function buildBlindDataset(registry, performance) {
  const topics = registryTopics(registry);
  const records = (performance.posts || [])
    .filter((post) => post && (post.verdict === 'landed' || post.verdict === 'faded'))
    .map((post) => {
      const postNo = normalizePostNo(post.post_no);
      const topic = topics.get(postNo);
      if (!postNo || !topic || !topic.title) return null;
      const targetKeywords = topic.target_keywords.map(maskDateReferences);
      const topicSummary = maskDateReferences(topic.topic_summary);
      return {
        blind_id: blindId(postNo),
        title: maskDateReferences(topic.title),
        target_keywords: targetKeywords,
        topic_summary: topicSummary,
        has_summary: targetKeywords.length > 0 || Boolean(topicSummary.trim()),
      };
    })
    .filter(Boolean)
    .sort((left, right) => left.blind_id.localeCompare(right.blind_id));

  return {
    schema_version: 1,
    id: 'topic_outcome_blind_dataset',
    record_count: records.length,
    records,
  };
}

function defaultOutputPath(snapshotDate) {
  const safeDate = /^\d{4}-\d{2}-\d{2}$/.test(String(snapshotDate || ''))
    ? snapshotDate
    : 'undated';
  return path.join(
    ROOT_DIR,
    'outputs',
    'reports',
    'topic_analysis',
    `${safeDate}_topic_blind_dataset.json`
  );
}

function parseArgs(argv) {
  const options = { out: null };
  argv.forEach((arg) => {
    if (arg.startsWith('--out=')) options.out = path.resolve(arg.slice('--out='.length));
  });
  return options;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const registry = JSON.parse(fs.readFileSync(DEFAULT_REGISTRY_PATH, 'utf8'));
  const performance = JSON.parse(fs.readFileSync(DEFAULT_PERFORMANCE_PATH, 'utf8'));
  const dataset = buildBlindDataset(registry, performance);
  if (!options.out) options.out = defaultOutputPath(performance.updated_at);
  fs.mkdirSync(path.dirname(options.out), { recursive: true });
  fs.writeFileSync(options.out, `${JSON.stringify(dataset, null, 2)}\n`, 'utf8');
  console.log(`topic blind dataset written: ${dataset.record_count} records -> ${options.out}`);
}

if (require.main === module) main();

module.exports = {
  blindId,
  buildBlindDataset,
  defaultOutputPath,
  forbiddenOutcomeFields,
  maskDateReferences,
  registryTopics,
};
