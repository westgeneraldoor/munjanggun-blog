const fs = require('fs');
const path = require('path');
const { paths } = require('./lib/paths');
const { readJsonFile, writeJsonFile, writeTextFile } = require('./lib/file_store');

const DOCUMENTS = [
  {
    id: 'active_topic_queue',
    markdownPath: paths.docsStrategy('ACTIVE_TOPIC_QUEUE.md'),
    sourcePath: paths.docsStrategy('ACTIVE_TOPIC_QUEUE.json'),
  },
  {
    id: 'posting_registry',
    markdownPath: paths.docsStrategy('POSTING_REGISTRY.md'),
    sourcePath: paths.docsStrategy('POSTING_REGISTRY.json'),
  },
];

function splitTableLine(line) {
  const trimmed = String(line || '').trim();
  if (!trimmed.startsWith('|') || !trimmed.endsWith('|')) return null;
  return trimmed.slice(1, -1).split('|').map((cell) => cell.trim());
}

function isSeparatorLine(line) {
  const cells = splitTableLine(line);
  return Boolean(cells && cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell)));
}

function isTableStart(lines, index) {
  return splitTableLine(lines[index]) && isSeparatorLine(lines[index + 1] || '');
}

function isGeneratedNoticeLine(line, doc) {
  const sourceName = path.relative(paths.root(''), doc.sourcePath).replace(/\\/g, '/');
  return String(line || '').trim() === `> Generated from ${sourceName}. Edit the JSON source and run npm run render:strategy.`;
}

function parseMarkdown(markdown, doc) {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const blocks = [];
  let markdownBuffer = [];

  function flushMarkdown() {
    if (markdownBuffer.length === 0) return;
    blocks.push({ type: 'markdown', lines: markdownBuffer });
    markdownBuffer = [];
  }

  for (let index = 0; index < lines.length; index += 1) {
    if (isGeneratedNoticeLine(lines[index], doc)) {
      if (markdownBuffer[markdownBuffer.length - 1] === '') markdownBuffer.pop();
      if (lines[index + 1] === '') index += 1;
      continue;
    }

    if (!isTableStart(lines, index)) {
      markdownBuffer.push(lines[index]);
      continue;
    }

    flushMarkdown();
    const header = splitTableLine(lines[index]);
    index += 1;
    const rows = [];

    while (index + 1 < lines.length) {
      const row = splitTableLine(lines[index + 1]);
      if (!row || isSeparatorLine(lines[index + 1])) break;
      rows.push(row);
      index += 1;
    }

    blocks.push({ type: 'table', header, rows });
  }

  flushMarkdown();

  return {
    schema_version: 1,
    id: doc.id,
    markdown_path: path.relative(paths.root(''), doc.markdownPath).replace(/\\/g, '/'),
    generated_notice: `Generated from ${path.relative(paths.root(''), doc.sourcePath).replace(/\\/g, '/')}. Edit the JSON source and run npm run render:strategy.`,
    imported_at: new Date().toISOString(),
    blocks,
  };
}

function renderTable(block) {
  const widths = block.header.map((cell, index) => {
    const rowWidths = block.rows.map((row) => String(row[index] || '').length);
    return Math.max(String(cell || '').length, 3, ...rowWidths);
  });

  const rowLine = (cells) => `| ${widths.map((width, index) => String(cells[index] || '').padEnd(width, ' ')).join(' | ')} |`;
  const separator = `| ${widths.map((width) => '-'.repeat(width)).join(' | ')} |`;
  return [rowLine(block.header), separator, ...block.rows.map(rowLine)].join('\n');
}

function renderSource(source) {
  const output = [];
  let noticeInserted = false;

  source.blocks.forEach((block) => {
    if (block.type === 'markdown') {
      const lines = [...block.lines];
      if (!noticeInserted) {
        const titleIndex = lines.findIndex((line) => /^#\s+/.test(line));
        if (titleIndex !== -1) {
          lines.splice(titleIndex + 1, 0, '', `> ${source.generated_notice}`);
          noticeInserted = true;
        }
      }
      output.push(lines.join('\n'));
      return;
    }

    if (block.type === 'table') {
      output.push(renderTable(block));
      return;
    }

    throw new Error(`Unknown strategy doc block type: ${block.type}`);
  });

  return `${output.join('\n').replace(/\n{3,}/g, '\n\n').trim()}\n`;
}

function importCurrent(doc) {
  if (!fs.existsSync(doc.markdownPath)) {
    throw new Error(`Markdown file not found: ${doc.markdownPath}`);
  }
  const source = parseMarkdown(fs.readFileSync(doc.markdownPath, 'utf8'), doc);
  writeJsonFile(doc.sourcePath, source);
  return source;
}

function loadSource(doc) {
  const source = readJsonFile(doc.sourcePath, null);
  if (!source || source.schema_version !== 1 || !Array.isArray(source.blocks)) {
    throw new Error(`Invalid strategy source: ${doc.sourcePath}`);
  }
  return source;
}

function writeMarkdown(doc) {
  const source = loadSource(doc);
  const markdown = renderSource(source);
  writeTextFile(doc.markdownPath, markdown);
}

function assertNoDrift(doc) {
  const expected = renderSource(loadSource(doc)).replace(/\r\n/g, '\n');
  const actual = fs.readFileSync(doc.markdownPath, 'utf8').replace(/\r\n/g, '\n');
  if (actual !== expected) {
    throw new Error(`Strategy markdown is out of sync with JSON source: ${doc.markdownPath}`);
  }
}

function selectedDocs(argv) {
  const docArg = argv.find((arg) => arg.startsWith('--doc='));
  if (!docArg) return DOCUMENTS;
  const id = docArg.slice('--doc='.length);
  const doc = DOCUMENTS.find((item) => item.id === id);
  if (!doc) throw new Error(`Unknown strategy doc id: ${id}`);
  return [doc];
}

function main() {
  const argv = process.argv.slice(2);
  const shouldImport = argv.includes('--import-current');
  const shouldWrite = argv.includes('--write');
  const shouldCheck = argv.includes('--check');
  const docs = selectedDocs(argv);

  if (!shouldImport && !shouldWrite && !shouldCheck) {
    throw new Error('Use --import-current, --write, or --check.');
  }

  docs.forEach((doc) => {
    if (shouldImport) importCurrent(doc);
    if (shouldWrite) writeMarkdown(doc);
    if (shouldCheck) assertNoDrift(doc);
  });

  console.log(`strategy docs processed: ${docs.map((doc) => doc.id).join(', ')}`);
}

if (require.main === module) {
  main();
}

module.exports = {
  parseMarkdown,
  renderSource,
  importCurrent,
  writeMarkdown,
  assertNoDrift,
};
