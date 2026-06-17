const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { ROOT_DIR } = require('./lib/paths');

const FAIL = 'fail';
const WARN = 'warn';

function parseArgs(argv) {
  const options = {
    mode: 'publish',
    json: false,
    strict: false,
    post: null,
    controlDir: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--json') options.json = true;
    else if (arg === '--strict') options.strict = true;
    else if (arg === '--post') {
      index += 1;
      options.post = argv[index];
    } else if (arg.startsWith('--post=')) {
      options.post = arg.slice('--post='.length);
    } else if (arg === '--mode') {
      index += 1;
      options.mode = argv[index];
    } else if (arg.startsWith('--mode=')) {
      options.mode = arg.slice('--mode='.length);
    } else if (arg === '--control-dir') {
      index += 1;
      options.controlDir = argv[index];
    } else if (arg.startsWith('--control-dir=')) {
      options.controlDir = arg.slice('--control-dir='.length);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
}

function makeIssue(severity, code, message, source = null) {
  return { severity, code, message, source };
}

function resolvePath(input) {
  if (!input) return null;
  return path.isAbsolute(input) ? input : path.resolve(ROOT_DIR, input);
}

function defaultControlDir(postPath) {
  const baseName = path.basename(postPath, '.md');
  return path.join(ROOT_DIR, 'outputs', 'publish_control', baseName);
}

function readTextIfExists(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return fs.readFileSync(filePath, 'utf8');
}

function statusAllowsPublish(statusText) {
  const lines = statusText.split(/\r?\n/);
  let current = null;
  lines.forEach((line) => {
    const bullet = line.match(/publish allowed\s*:\s*`?([^`|]+)`?/i);
    if (bullet) current = bullet[1].trim().toLowerCase();

    const table = line.match(/^\|\s*publish allowed\s*\|\s*([^|]+)\|/i);
    if (table) current = table[1].trim().toLowerCase();
  });

  return ['yes', 'true', 'pass', 'approved', 'allowed'].includes(current);
}

function statusPostQaPasses(statusText) {
  const lines = statusText.split(/\r?\n/);
  let current = null;
  lines.forEach((line) => {
    const bullet = line.match(/post qa\s*:\s*`?([^`|]+)`?/i);
    if (bullet) current = bullet[1].trim().toLowerCase();

    const table = line.match(/^\|\s*post qa\s*\|\s*([^|]+)\|/i);
    if (table) current = table[1].trim().toLowerCase();
  });

  return ['pass', 'passed', 'yes', 'true', 'approved'].includes(current);
}

function approvalLogHasPublishApproval(text) {
  const sections = text.split(/(?=^##\s+)/m);
  return sections.some((section) => {
    const lower = section.toLowerCase();
    const mentionsPublish = lower.includes('publish') || section.includes('발행');
    if (!mentionsPublish) return false;
    const blockedTerms = [
      'not approved',
      'pending',
      'rejected',
      'not currently approved',
      'not-yet approved',
      'not-approved',
      'unapproved',
      'disapproved',
      '보류',
      '미승인',
      '거부',
      '불가',
    ];
    const blocked = section.split(/\r?\n/).some((line) => {
      const lineLower = line.toLowerCase();
      const lineMentionsPublish = lineLower.includes('publish') || lineLower.includes('naver') || line.includes('발행');
      const currentDecisionLine = /^\s*[-*]?\s*(decision|current state|current status|현재 상태|결정)\s*:/i.test(line);
      return currentDecisionLine
        && lineMentionsPublish
        && blockedTerms.some((term) => lineLower.includes(term) || line.includes(term));
    });
    if (blocked) return false;
    const decisionApproved = /decision\s*:\s*.*publish.*approved/i.test(section)
      || /decision\s*:\s*.*발행.*승인/.test(section);
    const scopeApproved = /approved scope\s*:\s*.*publish/i.test(section)
      || /approved scope\s*:\s*.*naver/i.test(section)
      || /승인 범위\s*:\s*.*발행/.test(section);
    return decisionApproved && scopeApproved;
  });
}

function validateControlFiles(controlDir) {
  const issues = [];
  const statusPath = path.join(controlDir, 'STATUS.md');
  const approvalPath = path.join(controlDir, 'APPROVAL_LOG.md');
  const statusText = readTextIfExists(statusPath);
  const approvalText = readTextIfExists(approvalPath);

  if (!statusText) {
    issues.push(makeIssue(FAIL, 'STATUS_MISSING', 'STATUS.md is required before publishing.', statusPath));
  } else if (!statusAllowsPublish(statusText)) {
    issues.push(makeIssue(FAIL, 'PUBLISH_NOT_ALLOWED', 'STATUS.md does not explicitly allow publishing.', statusPath));
  } else if (!statusPostQaPasses(statusText)) {
    issues.push(makeIssue(FAIL, 'POST_QA_NOT_PASS', 'STATUS.md must record Post QA as PASS before publishing.', statusPath));
  }

  if (!approvalText) {
    issues.push(makeIssue(FAIL, 'APPROVAL_LOG_MISSING', 'APPROVAL_LOG.md is required before publishing.', approvalPath));
  } else if (!approvalLogHasPublishApproval(approvalText)) {
    issues.push(makeIssue(FAIL, 'PUBLISH_APPROVAL_MISSING', 'APPROVAL_LOG.md lacks explicit blog publish approval.', approvalPath));
  }

  return issues;
}

function firstMeaningfulLine(content) {
  return content.split(/\r?\n/).map((line) => line.trim()).find(Boolean) || '';
}

function extractTitle(content) {
  const first = firstMeaningfulLine(content);
  if (first.startsWith('# ')) return first.slice(2).trim();
  return first.replace(/^#+\s*/, '').trim();
}

function extractHashtags(content) {
  const hashtagSection = content.match(/# 해시태그[\s\S]*?\n\n([\s\S]*)$/);
  const target = hashtagSection ? hashtagSection[1] : '';
  return (target.match(/#[^\s#]+/g) || []).map((tag) => tag.trim());
}

function validatePublishContent(postPath) {
  const issues = [];
  const content = fs.readFileSync(postPath, 'utf8');
  const title = extractTitle(content);
  const hashtagSectionIndex = content.indexOf('# 해시태그');
  const bodyBeforeHashtags = hashtagSectionIndex >= 0 ? content.slice(0, hashtagSectionIndex) : content;
  const hashtags = extractHashtags(content);

  if (title && !/\d/.test(title)) {
    issues.push(makeIssue(FAIL, 'TITLE_NUMBER_MISSING', 'Publish mode requires a number in the title.', postPath));
  }

  if (content.includes('[사진:')) {
    issues.push(makeIssue(FAIL, 'PHOTO_PLACEHOLDER_IN_POST', 'Photo placeholders must be moved to draft notes before publishing.', postPath));
  }

  [
    '검색 의도 분석',
    '품질 채점',
    '예상 성능',
    '이미지 지시',
    '썸네일 카피',
    '제작 노트',
  ].forEach((marker) => {
    if (content.includes(marker)) {
      issues.push(makeIssue(FAIL, 'PRODUCTION_NOTE_IN_POST', `Production note marker remains in post: ${marker}`, postPath));
    }
  });

  if (/(^|\s)#[^\s#]+/.test(bodyBeforeHashtags)) {
    issues.push(makeIssue(FAIL, 'BODY_HASHTAG_PRESENT', 'Hashtags must only appear in the final hashtag section.', postPath));
  }

  if (hashtags.length === 0) {
    issues.push(makeIssue(FAIL, 'HASHTAG_SECTION_MISSING', 'Hashtag section is required before publishing.', postPath));
  }
  if (!hashtags.includes('#문장군') || !hashtags.includes('#문장군중문')) {
    issues.push(makeIssue(FAIL, 'BRAND_HASHTAG_MISSING', 'Publish mode requires #문장군 and #문장군중문.', postPath));
  }

  if (/문틀만.{0,12}(단독\s*)?교체.{0,12}(가능|된다|돼|됨)/.test(content)) {
    issues.push(makeIssue(FAIL, 'DOOR_FRAME_ONLY_CLAIM', 'Do not say door frames can be replaced alone.', postPath));
  }

  if (/비대칭양개형중문|중문파티션/.test(content)) {
    issues.push(makeIssue(FAIL, 'EXCLUDED_PRODUCT_CLAIM', 'Excluded or unsupported product appears in publish copy.', postPath));
  }

  if (/살면서리모델링|종합\s*리모델링/.test(content)) {
    issues.push(makeIssue(FAIL, 'SERVICE_SCOPE_OVERREACH', 'Post overstates Moonjanggun service scope.', postPath));
  }

  return issues;
}

function runPostValidator(postPath, strict) {
  const args = [path.join(ROOT_DIR, 'scripts', 'validate_post.js'), postPath, '--no-write-report'];
  if (strict) args.push('--strict');
  const result = spawnSync(process.execPath, args, {
    cwd: ROOT_DIR,
    encoding: 'utf8',
  });
  if (result.status === 0) return [];
  return [
    makeIssue(
      FAIL,
      'POST_VALIDATION_FAILED',
      'scripts/validate_post.js failed. Fix the post before publishing.',
      path.relative(ROOT_DIR, postPath).replace(/\\/g, '/'),
    ),
  ];
}

function parseRegistryRows() {
  const registryPath = path.join(ROOT_DIR, 'docs', 'strategy', 'POSTING_REGISTRY.md');
  const text = fs.readFileSync(registryPath, 'utf8');
  return text
    .split(/\r?\n/)
    .filter((line) => /^\|\s*[\d-]+/.test(line))
    .map((line) => line.split('|').map((cell) => cell.trim()))
    .map((cells) => ({
      number: cells[1],
      file: cells[2],
      title: cells[5],
      url: cells[6],
      publishDate: cells[7],
      raw: cells,
    }));
}

function validateRegistry(postPath, mode) {
  const basename = path.basename(postPath);
  const rows = parseRegistryRows();
  const row = rows.find((candidate) => candidate.file === basename);
  if (!row) {
    return [makeIssue(FAIL, 'REGISTRY_ENTRY_MISSING', 'POSTING_REGISTRY.md must contain this post before publishing.', 'docs/strategy/POSTING_REGISTRY.md')];
  }

  if (mode === 'publish' && /blog\.naver\.com\/doorgeneral\/\d+/.test(row.url)) {
    return [makeIssue(FAIL, 'POST_ALREADY_PUBLISHED', 'This post already has a Naver Blog URL in POSTING_REGISTRY.md.', 'docs/strategy/POSTING_REGISTRY.md')];
  }

  return [];
}

function runGate(options) {
  const issues = [];
  if (!options.post) {
    issues.push(makeIssue(FAIL, 'POST_ARG_MISSING', '--post is required.'));
    return buildPayload(options, null, null, issues);
  }
  if (!['publish'].includes(options.mode)) {
    issues.push(makeIssue(FAIL, 'MODE_INVALID', `Unsupported mode: ${options.mode}`));
    return buildPayload(options, null, null, issues);
  }

  const postPath = resolvePath(options.post);
  const controlDir = resolvePath(options.controlDir) || defaultControlDir(postPath);

  if (!fs.existsSync(postPath)) {
    issues.push(makeIssue(FAIL, 'POST_MISSING', 'Post file does not exist.', postPath));
    return buildPayload(options, postPath, controlDir, issues);
  }

  issues.push(...validateControlFiles(controlDir));
  issues.push(...runPostValidator(postPath, options.strict));
  issues.push(...validatePublishContent(postPath));
  issues.push(...validateRegistry(postPath, options.mode));

  return buildPayload(options, postPath, controlDir, issues);
}

function summarize(issues) {
  return {
    fail: issues.filter((item) => item.severity === FAIL).length,
    warn: issues.filter((item) => item.severity === WARN).length,
  };
}

function buildPayload(options, postPath, controlDir, issues) {
  const summary = summarize(issues);
  const blocked = summary.fail > 0 || (options.strict && summary.warn > 0);
  return {
    ok: !blocked,
    decision: blocked ? 'BLOCK' : 'ALLOW',
    exit_code: blocked ? 1 : 0,
    mode: options.mode,
    post: postPath ? path.relative(ROOT_DIR, postPath).replace(/\\/g, '/') : null,
    control_dir: controlDir ? path.relative(ROOT_DIR, controlDir).replace(/\\/g, '/') : null,
    summary,
    issues,
  };
}

function printHuman(payload) {
  console.log(`[${payload.decision}] ${payload.post || '-'}`);
  payload.issues.forEach((item) => {
    console.log(`- ${item.severity.toUpperCase()} ${item.code}: ${item.message}`);
  });
  console.log(`fail ${payload.summary.fail}, warn ${payload.summary.warn}`);
}

function main() {
  let payload;
  let json = false;
  try {
    const options = parseArgs(process.argv.slice(2));
    json = options.json;
    payload = runGate(options);
  } catch (err) {
    payload = {
      ok: false,
      decision: 'ERROR',
      exit_code: 2,
      mode: null,
      post: null,
      control_dir: null,
      summary: { fail: 1, warn: 0 },
      issues: [makeIssue(FAIL, 'INPUT_ERROR', err.message)],
    };
    json = true;
  }

  if (json) {
    console.log(JSON.stringify(payload, null, 2));
  } else {
    printHuman(payload);
  }
  process.exit(payload.exit_code);
}

if (require.main === module) {
  main();
}

module.exports = {
  runGate,
  approvalLogHasPublishApproval,
  statusAllowsPublish,
};
