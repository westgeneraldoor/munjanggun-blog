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

const operationalLeakRules = [
  { name: 'queue marker', pattern: /\bQ-\d+\b/i },
  { name: 'top-rank marker', pattern: /\bTOP\s*\d+\b/i },
  { name: 'protected asset', pattern: /보호글|보호\s*자산/i },
  { name: 'performance operation', pattern: /순위\s*이탈|상위\s*유지|약세\s*보강|검색\s*방어용|보강용/i },
  { name: 'performance-based planning', pattern: /(?:순위[·\s]*통계|누적\s*통계|통계)\s*기반|신규\s*글/i },
  { name: 'authoring template', pattern: /(?:정보성|제품가이드)\s*[A-Z]\s*템플릿\s*적용/i },
];

const allowedRecordFields = new Set([
  'blind_id',
  'title',
  'target_keywords',
  'topic_summary',
  'has_summary',
]);

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

function validPostNumbers(topics) {
  return new Set([...topics.keys()].map(normalizePostNo).filter(Boolean));
}

function removeOperationalSentences(value) {
  return String(value || '')
    .split(/(?<=[.!?])\s+|\r?\n+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean)
    .filter((sentence) => !operationalLeakRules.some((rule) => rule.pattern.test(sentence)))
    .join(' ')
    .trim();
}

function maskPostReferences(value, postNumbers) {
  const valid = postNumbers instanceof Set
    ? postNumbers
    : new Set(Array.from(postNumbers || [], normalizePostNo).filter(Boolean));
  let text = String(value || '');

  const maskSequence = (sequence) => sequence.replace(/\d{3}(?:-\d+)?/g, (token) => (
    valid.has(normalizePostNo(token)) ? '[다른 글]' : token
  ));

  text = text.replace(
    /(\d{3}(?:-\d+)?(?:\s*[\/·]\s*\d{3}(?:-\d+)?)+)번/g,
    (sequence) => maskSequence(sequence).replace(/번$/, '')
  );
  text = text.replace(
    /(\d{3}(?:-\d+)?(?:\s*[\/·]\s*\d{3}(?:-\d+)?)+)(?=\s*내부링크)/g,
    maskSequence
  );
  text = text.replace(/\b(\d{3}(?:-\d+)?)(?=\s*내부링크)/g, (match, token) => (
    valid.has(normalizePostNo(token)) ? '[다른 글]' : match
  ));

  text = text.replace(/\b(\d{3}(?:-\d+)?)번/g, (match, token) => (
    valid.has(normalizePostNo(token)) ? '[다른 글]' : match
  ));
  return text;
}

function hasMeaningfulSummary(value) {
  const remainder = String(value || '')
    .replace(/\[(?:날짜 마스킹|다른 글)\]/g, ' ')
    .replace(/내부링크/g, ' ')
    .replace(/[\s/·,;:()[\].!?-]+/g, '');
  return /[0-9A-Za-z가-힣]/.test(remainder);
}

function sanitizeTopicSummary(value, postNumbers) {
  const withoutDates = maskDateReferences(value);
  const withoutOperations = removeOperationalSentences(withoutDates);
  const withoutPostNumbers = maskPostReferences(withoutOperations, postNumbers).trim();
  return hasMeaningfulSummary(withoutPostNumbers) ? withoutPostNumbers : '';
}

function dateLeakIn(value) {
  const text = String(value || '');
  return /20\d\d|(?:20)?\d{2}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}월\s*\d{1,2}일|(?:^|[^\d/])\d{1,2}\/\d{1,2}(?![\d/])/.test(text);
}

function assertSafeBlindDataset(dataset, postNumbers) {
  const problems = [];
  if (dataset.generated_at) problems.push('top-level generated_at');
  if (!Array.isArray(dataset.records)) problems.push('records is not an array');
  if (Array.isArray(dataset.records) && dataset.record_count !== dataset.records.length) {
    problems.push('record_count mismatch');
  }

  (dataset.records || []).forEach((record, index) => {
    const label = record.blind_id || `record[${index}]`;
    Object.keys(record).forEach((field) => {
      if (!allowedRecordFields.has(field)) problems.push(`${label}: unexpected field ${field}`);
    });
    allowedRecordFields.forEach((field) => {
      if (!Object.prototype.hasOwnProperty.call(record, field)) {
        problems.push(`${label}: missing field ${field}`);
      }
    });
    forbiddenOutcomeFields.forEach((field) => {
      if (Object.prototype.hasOwnProperty.call(record, field)) {
        problems.push(`${label}: forbidden field ${field}`);
      }
    });
    if (!/^T-[a-p]{12}$/.test(String(record.blind_id || ''))) {
      problems.push(`${label}: reversible-looking blind_id`);
    }

    ['title', 'topic_summary', 'target_keywords'].forEach((field) => {
      const values = Array.isArray(record[field]) ? record[field] : [record[field]];
      values.forEach((value) => {
        if (dateLeakIn(value)) problems.push(`${label}.${field}: date reference`);
        operationalLeakRules.forEach((rule) => {
          if (rule.pattern.test(String(value || ''))) {
            problems.push(`${label}.${field}: ${rule.name}`);
          }
        });
        if (maskPostReferences(value, postNumbers) !== String(value || '')) {
          problems.push(`${label}.${field}: registered post reference`);
        }
      });
    });
  });

  if (problems.length > 0) {
    throw new Error(`Blind dataset leakage detected:\n- ${problems.join('\n- ')}`);
  }
}

function buildBlindDataset(registry, performance) {
  const topics = registryTopics(registry);
  const postNumbers = validPostNumbers(topics);
  const records = (performance.posts || [])
    .filter((post) => post && (post.verdict === 'landed' || post.verdict === 'faded'))
    .map((post) => {
      const postNo = normalizePostNo(post.post_no);
      const topic = topics.get(postNo);
      if (!postNo || !topic || !topic.title) return null;
      const targetKeywords = topic.target_keywords.map(maskDateReferences);
      const topicSummary = sanitizeTopicSummary(topic.topic_summary, postNumbers);
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

function writeBlindDataset(outputPath, dataset, postNumbers) {
  assertSafeBlindDataset(dataset, postNumbers);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(dataset, null, 2)}\n`, 'utf8');
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
  writeBlindDataset(options.out, dataset, validPostNumbers(registryTopics(registry)));
  console.log(`topic blind dataset written: ${dataset.record_count} records -> ${options.out}`);
}

if (require.main === module) main();

module.exports = {
  assertSafeBlindDataset,
  blindId,
  buildBlindDataset,
  defaultOutputPath,
  forbiddenOutcomeFields,
  maskDateReferences,
  maskPostReferences,
  operationalLeakRules,
  registryTopics,
  removeOperationalSentences,
  sanitizeTopicSummary,
  writeBlindDataset,
};
