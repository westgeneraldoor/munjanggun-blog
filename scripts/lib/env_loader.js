const fs = require('fs');
const path = require('path');
const { ROOT_DIR } = require('./paths');

function stripInlineComment(value) {
  let quote = null;
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    const prev = value[index - 1];
    if ((char === '"' || char === "'") && prev !== '\\') {
      quote = quote === char ? null : (quote || char);
      continue;
    }
    if (char === '#' && quote === null && (index === 0 || /\s/.test(value[index - 1]))) {
      return value.slice(0, index).trimEnd();
    }
  }
  return value.trimEnd();
}

function unescapeDoubleQuoted(value) {
  return value.replace(/\\([nrt"\\$])/g, (_, char) => {
    if (char === 'n') return '\n';
    if (char === 'r') return '\r';
    if (char === 't') return '\t';
    return char;
  });
}

function parseValue(rawValue) {
  const trimmed = stripInlineComment(String(rawValue || '').trim());
  if (trimmed.length < 2) return trimmed;

  const first = trimmed[0];
  const last = trimmed[trimmed.length - 1];
  if (first === '"' && last === '"') return unescapeDoubleQuoted(trimmed.slice(1, -1));
  if (first === "'" && last === "'") return trimmed.slice(1, -1);
  return trimmed;
}

function parseEnvContent(content) {
  const parsed = {};
  String(content || '').split(/\r?\n/).forEach((line) => {
    let trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    if (trimmed.startsWith('export ')) trimmed = trimmed.slice('export '.length).trimStart();

    const index = trimmed.indexOf('=');
    if (index === -1) return;

    const key = trimmed.slice(0, index).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) return;

    parsed[key] = parseValue(trimmed.slice(index + 1));
  });
  return parsed;
}

function loadEnv(options = {}) {
  const envPath = options.envPath || path.join(ROOT_DIR, '.env');
  const target = options.target || process.env;
  const override = Boolean(options.override);

  if (!fs.existsSync(envPath)) return {};

  try {
    const parsed = parseEnvContent(fs.readFileSync(envPath, 'utf8'));
    Object.entries(parsed).forEach(([key, value]) => {
      if (override || target[key] === undefined) target[key] = value;
    });
    return parsed;
  } catch (err) {
    console.warn(`Failed to load .env: ${err.message}`);
    return {};
  }
}

loadEnv();

module.exports = {
  loadEnv,
  parseEnvContent,
  parseValue,
};
