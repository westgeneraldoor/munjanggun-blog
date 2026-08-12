const fs = require('fs');
const path = require('path');

function parseArgs(argv) {
  const options = { posts: [], ownerConfirmed: [], write: false, json: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--write') options.write = true;
    else if (arg === '--json') options.json = true;
    else if (arg === '--registry') options.registry = argv[++index];
    else if (arg === '--control-root') options.controlRoot = argv[++index];
    else if (arg === '--posts') options.posts = String(argv[++index] || '').split(',').map((v) => v.trim()).filter(Boolean);
    else if (arg === '--owner-confirmed-field-story') options.ownerConfirmed = String(argv[++index] || '').split(',').map((v) => v.trim()).filter(Boolean);
    else if (arg === '--today') options.today = argv[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!options.registry || !options.controlRoot || options.posts.length === 0 || !options.today) {
    throw new Error('Required: --registry <path> --control-root <path> --posts <ids> --today <YYYY-MM-DD>');
  }
  return options;
}

function normalizePostNo(value) {
  const match = String(value || '').match(/\d+/);
  return match ? String(Number(match[0])) : '';
}

function extractUrl(value) {
  return String(value || '').match(/https:\/\/blog\.naver\.com\/doorgeneral\/\d+/)?.[0] || '';
}

function findPublishedRows(registry) {
  const result = new Map();
  for (const block of registry.blocks || []) {
    if (block.type !== 'table' || !Array.isArray(block.header) || !Array.isArray(block.rows)) continue;
    const idIndex = block.header.findIndex((name) => ['#', '글'].includes(String(name).trim()));
    const urlIndex = block.header.findIndex((name) => String(name).includes('URL'));
    if (idIndex < 0 || urlIndex < 0) continue;
    for (const row of block.rows) {
      const postNo = normalizePostNo(row[idIndex]);
      const url = extractUrl(row[urlIndex]);
      if (postNo && url && !result.has(postNo)) result.set(postNo, { postNo, url });
    }
  }
  return result;
}

function findStatusPath(controlRoot, postNo) {
  if (!fs.existsSync(controlRoot)) return '';
  const prefix = `${String(postNo).padStart(3, '0')}_`;
  const dir = fs.readdirSync(controlRoot, { withFileTypes: true })
    .find((entry) => entry.isDirectory() && entry.name.startsWith(prefix));
  if (!dir) return '';
  const statusPath = path.join(controlRoot, dir.name, 'STATUS.md');
  return fs.existsSync(statusPath) ? statusPath : '';
}

function replaceBullet(markdown, label, value) {
  const line = `- ${label}: \`${value}\``;
  const pattern = new RegExp(`^- ${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}:.*$`, 'm');
  if (pattern.test(markdown)) return markdown.replace(pattern, line);
  return `${markdown.trimEnd()}\n${line}\n`;
}

function replaceCheckRow(markdown, check, status, note) {
  const escaped = check.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const row = `| ${check} | ${status} | ${note} |`;
  const pattern = new RegExp(`^\\|\\s*${escaped}\\s*\\|.*$`, 'm');
  return pattern.test(markdown) ? markdown.replace(pattern, row) : markdown;
}

function buildUpdatedStatus(markdown, publication, ownerConfirmed, today) {
  let next = markdown;
  next = replaceBullet(next, 'Registry status', '발행완료·URL등록완료');
  next = replaceBullet(next, 'Published URL', publication.url);
  next = replaceBullet(next, 'Publication reconciliation', `published_registry_confirmed:${today}`);
  if (ownerConfirmed) {
    next = replaceCheckRow(
      next,
      'Field story real-case swap',
      'owner_confirmed',
      `${today} 사용자 확인: 실제 고객 사례를 확인하고 작성함`,
    );
  }
  next = replaceCheckRow(
    next,
    'Human approval',
    'historical_record_missing',
    `${today} 발행 후 정합화: 과거 승인 로그를 소급 생성하지 않음`,
  );
  return next;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const registry = JSON.parse(fs.readFileSync(options.registry, 'utf8'));
  const published = findPublishedRows(registry);
  const requested = options.posts.map(normalizePostNo);
  const ownerConfirmed = new Set(options.ownerConfirmed.map(normalizePostNo));
  const changes = [];
  const skipped = [];

  for (const postNo of requested) {
    const publication = published.get(postNo);
    if (!publication) {
      skipped.push({ post_no: postNo, reason: 'published_registry_url_not_found' });
      continue;
    }
    const statusPath = findStatusPath(options.controlRoot, postNo);
    if (!statusPath) {
      skipped.push({ post_no: postNo, reason: 'local_status_not_found' });
      continue;
    }
    const before = fs.readFileSync(statusPath, 'utf8');
    const after = buildUpdatedStatus(before, publication, ownerConfirmed.has(postNo), options.today);
    changes.push({ post_no: postNo, status_path: statusPath, url: publication.url, changed: before !== after });
    if (options.write && before !== after) fs.writeFileSync(statusPath, after, 'utf8');
  }

  const payload = {
    mode: options.write ? 'write' : 'dry-run',
    planned: changes.filter((item) => item.changed).length,
    written: options.write ? changes.filter((item) => item.changed).length : 0,
    changes,
    skipped,
  };
  if (options.json) process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
  else process.stdout.write(`publish control reconciliation: planned=${payload.planned} written=${payload.written} skipped=${skipped.length}\n`);
}

try {
  main();
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
}
