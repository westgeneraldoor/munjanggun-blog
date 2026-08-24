#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { ROOT_DIR } = require('./lib/paths');
const { validateBridgeCandidate } = require('./lib/bridge_topic');
const {
  scopeVerdict,
  duplicateCheck,
  registryEntries,
} = require('./topic_candidate');

const PATHS = {
  policy: path.join(ROOT_DIR, 'config', 'bridge_keyword_policy.json'),
  scope: path.join(ROOT_DIR, 'config', 'product_scope.json'),
  registry: path.join(ROOT_DIR, 'docs', 'strategy', 'POSTING_REGISTRY.json'),
  volumes: path.join(ROOT_DIR, 'data', 'raw', 'keyword_data_bridge.json'),
};

const REQUIRED = ['parent', 'service', 'relation', 'question', 'dependency'];

function readJson(filePath, fallback) {
  if (!fs.existsSync(filePath)) return fallback;
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function parseArgs(argv) {
  const values = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    const name = arg.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      values[name] = '';
      continue;
    }
    values[name] = next;
    i += 1;
  }
  return values;
}

function printUsage(missing) {
  console.error(`필수 인자 누락: ${missing.map((name) => `--${name}`).join(', ')}`);
  console.error('사용법: node scripts/bridge_topic_candidate.js --parent "입주청소" --service "중문설치" --relation "sequencing" --question "고객 질문" --dependency "실제 연결 이유"');
}

function printEntryList(label, entries) {
  console.log(`- ${label}: ${entries.length > 0 ? `${entries.length}편` : '없음'}`);
  entries.slice(0, 5).forEach((entry) => {
    console.log(`  - ${entry.no} ${entry.title || ''}`.trimEnd());
    if (entry.topic) console.log(`    소재: ${entry.topic.slice(0, 180)}`);
  });
}

function printReport(candidate, result) {
  console.log('# 브릿지 글감 후보 검증');
  console.log('');
  console.log(`- 부모 키워드: ${candidate.parent_keyword}`);
  console.log(`- 부모 검색량: ${result.volume ? `${result.volume.total} (${result.volume.competition})` : '브릿지 광고 API 데이터에 없음'}`);
  console.log(`- 부모 문맥: ${result.parent.level} (${result.parent.code}) ${result.parent.reason || ''}`);
  console.log(`- 문장군 서비스: ${candidate.service_keyword}`);
  console.log(`- 서비스 취급 범위: ${result.service.level}${result.service.label ? ` (${result.service.label})` : ''}`);
  console.log(`- 연결 관계: ${candidate.relation_type} / ${result.relation.level} / ${result.relation.label || result.relation.code}`);
  console.log(`- 고객 질문: ${candidate.customer_question}`);
  console.log(`- 실제 의존성: ${candidate.dependency_statement}`);
  console.log('');
  console.log('## 등록부 근접');
  console.log('');
  printEntryList('부모 키워드 근접', result.duplicates.parent);
  console.log(`- 서비스 완전 중복: ${result.duplicates.service.exact.length > 0 ? result.duplicates.service.exact.join(', ') : '없음'}`);
  console.log(`- 서비스 근접: ${result.duplicates.service.near.length > 0 ? result.duplicates.service.near.slice(0, 10).map(([no, token]) => `${no}(${token})`).join(', ') : '없음'}`);
  printEntryList('같은 고객 질문', result.duplicates.question);
  console.log('');
  console.log('## 자동 판정');
  console.log('');
  if (result.blocks.length === 0) console.log('- BLOCK: 없음');
  result.blocks.forEach((item) => console.log(`- BLOCK ${item.code}: ${item.reason || ''}`));
  if (result.warnings.length === 0) console.log('- WARN: 없음');
  result.warnings.forEach((item) => console.log(`- WARN ${item.code}: ${item.reason || ''}`));
  console.log('');
  console.log('## 사람이 확인할 것');
  console.log('');
  console.log('- 부모 검색자가 실제로 문 때문에 결정에 막히는가');
  console.log('- 기존 근접 글과 고객 질문이 정말 다른가');
  console.log('- 문장군이 부모 업종의 서비스를 제공하는 것처럼 읽히지 않는가');
  console.log('- 부모 키워드의 전체 검색량이 결합 질문으로 그대로 넘어온다고 과장하지 않았는가');
  console.log('');
  console.log(result.blocked ? '최종: BLOCK' : '최종: 자동 하한선 통과 · 사람 검토 필요');
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const missing = REQUIRED.filter((name) => !String(args[name] || '').trim());
  if (missing.length > 0) {
    printUsage(missing);
    process.exitCode = 1;
    return;
  }

  const candidate = {
    parent_keyword: args.parent,
    service_keyword: args.service,
    relation_type: args.relation,
    customer_question: args.question,
    dependency_statement: args.dependency,
  };
  const scope = readJson(PATHS.scope, {});
  const policy = readJson(PATHS.policy, { relation_types: {}, known_parent_contexts: [] });
  const registry = readJson(PATHS.registry, { blocks: [] });
  const volumes = readJson(PATHS.volumes, []);
  const result = validateBridgeCandidate(candidate, {
    scope,
    policy,
    entries: registryEntries(registry),
    volumes,
    scopeVerdict,
    duplicateCheck,
  });
  printReport(candidate, result);
  if (result.blocked) process.exitCode = 1;
}

if (require.main === module) main();

module.exports = { parseArgs, printReport };
