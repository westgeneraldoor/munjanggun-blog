#!/usr/bin/env node
// 신규 글감 후보를 기계로 검사한다.
//
// 2026-07-27 기준으로 사람이 손으로 돌리던 조회 7가지를 옮긴 것이다.
// 그날 Codex가 낸 글감 3개 중 3개 모두 중복을 놓쳤는데, 세 건 전부
// 아래 검사로 잡히는 종류였다.
//
//   node scripts/topic_candidate.js --explore
//   node scripts/topic_candidate.js --check "방문잠겼을때,화장실문고리"

const fs = require('fs');
const path = require('path');
const { ROOT_DIR } = require('./lib/paths');

const PATHS = {
  keywords: path.join(ROOT_DIR, 'data/processed/keyword_data_product_relevant.json'),
  registry: path.join(ROOT_DIR, 'docs/strategy/POSTING_REGISTRY.json'),
  queue: path.join(ROOT_DIR, 'docs/strategy/ACTIVE_TOPIC_QUEUE.json'),
  performance: path.join(ROOT_DIR, 'data/performance/post_performance.json'),
  scope: path.join(ROOT_DIR, 'config/product_scope.json'),
};

function readJson(filePath, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    return fallback;
  }
}

// 등록부의 모든 표에서 (글번호, 키워드+제목+소재) 를 모은다.
// 한 글이 여러 표에 나오므로 글번호 기준으로 합친다.
function registryEntries(registry) {
  const byNo = new Map();
  (registry.blocks || []).filter((b) => b.type === 'table').forEach((block) => {
    const idx = (re) => block.header.findIndex((h) => re.test(h));
    const ki = idx(/타겟 키워드|추적 키워드/);
    const ti = idx(/제목/);
    const si = idx(/소재/);
    const mi = idx(/메모/);
    block.rows.forEach((row) => {
      const match = String(row[0]).match(/^(\d{3})/);
      if (!match) return;
      const no = match[1];
      const text = [ki, ti, si, mi].filter((i) => i >= 0).map((i) => row[i] || '').join(' ');
      byNo.set(no, `${byNo.get(no) || ''} ${text}`);
    });
  });
  return [...byNo.entries()].map(([no, text]) => ({ no, text: text.replace(/\s+/g, ' ').trim() }));
}

// 문/중문 도메인 밖 키워드를 먼저 걸러낸다.
// 도어락, 타일, 리모델링처럼 검색량만 큰 무관 키워드가 후보에 섞이면
// 목록 자체를 신뢰할 수 없게 된다.
function inDomain(keyword, scope) {
  if ((scope.out_of_domain || []).some((t) => keyword.includes(t))) return false;
  return (scope.domain_tokens || []).some((t) => keyword.includes(t));
}

function normalize(v){return String(v).toLowerCase().replace(/s/g,'').replace(/9미리/g,'9mm');}

function scopeVerdict(rawKeyword, scope) {
  const keyword = normalize(rawKeyword);
  if ((scope.out_of_domain || []).some((t) => keyword.includes(t))) {
    return { level: 'BLOCK', label: '도메인 밖', reason: '문·중문 영역이 아니다' };
  }
  for (const item of scope.competitor_brand || []) {
    if (keyword.includes(normalize(item))) {
      return { level: 'WARN', label: '경쟁 브랜드', convert_to: '구조와 선택 기준 비교', rule: `${item} 등 타사명을 제목이나 비교 우위 주장에 쓰지 않는다` };
    }
  }
  for (const item of scope.excluded_permanent || []) {
    if (keyword.includes(normalize(item.term))) return { level: 'BLOCK', label: '영구 제외', ...item };
  }
  for (const item of scope.excluded_product || []) {
    if (keyword.includes(normalize(item.term))) return { level: 'BLOCK', label: '미취급 제품', ...item };
  }
  for (const item of scope.convert_only || []) {
    if (keyword.includes(normalize(item.term))) return { level: 'WARN', label: '전환 필요', ...item };
  }
  return { level: 'PASS', label: '취급 범위 안' };
}

// 한국어는 형태소 분석 없이 서브토큰으로 근접을 본다.
// 2글자 이상 조각이 등록부 텍스트에 있으면 근접으로 센다.
function subTokens(keyword) {
  const tokens = new Set();
  const clean = keyword.replace(/\s/g, '');
  for (let size = clean.length; size >= 2; size -= 1) {
    for (let i = 0; i + size <= clean.length; i += 1) tokens.add(clean.slice(i, i + size));
    if (tokens.size > 40) break;
  }
  return [...tokens];
}

function duplicateCheck(keyword, entries, scope = {}) {
  const stop = new Set(scope.common_tokens || []);
  const exact = entries.filter((e) => new RegExp(`(^|[\\s,])${keyword}([\\s,]|$)`).test(e.text));
  // 2글자 토큰까지 봐야 문턱 같은 핵심 조각을 놓치지 않는다.
  // 대신 방문·중문·교체처럼 거의 모든 글에 있는 흔한 조각은 뺀다.
  const tokens = subTokens(keyword).filter((t) => t.length >= 2 && !stop.has(t));
  const near = new Map();
  entries.forEach((e) => {
    if (exact.some((x) => x.no === e.no)) return;
    const hits = tokens.filter((t) => e.text.includes(t));
    if (hits.length > 0) near.set(e.no, hits.sort((a, b) => b.length - a.length)[0]);
  });
  return {
    exact: exact.map((e) => e.no).sort(),
    near: [...near.entries()].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0])),
  };
}

function clusterStatus(performance) {
  const stat = new Map();
  (performance.posts || []).forEach((post) => {
    (post.cluster_ids || []).forEach((cid) => {
      if (!stat.has(cid)) stat.set(cid, { landed: 0, faded: 0, streak: 0 });
      const s = stat.get(cid);
      if (post.verdict === 'landed') { s.landed += 1; s.streak = 0; }
      if (post.verdict === 'faded') { s.faded += 1; s.streak += 1; }
    });
  });
  return stat;
}

function activeLocks(queue) {
  const table = (queue.blocks || []).find((b) => b.type === 'table' && b.header.includes('id'));
  if (!table) return [];
  const col = (name) => table.header.indexOf(name);
  return table.rows
    .filter((r) => ['monitor_3d', 'monitor_7d', 'publish_waiting'].includes(r[col('status')]))
    .map((r) => ({ id: r[col('id')], status: r[col('status')], topic: r[col('topic')], keyword: r[col('primary_keyword')] }));
}

function volumeOf(keyword, keywords) {
  const hit = (keywords || []).find((k) => k.keyword === keyword);
  return hit ? hit.total : 0;
}

function explore(data, limit) {
  const { keywords, entries, scope } = data;
  const corpus = entries.map((e) => e.text).join(' ');
  const rows = keywords
    .filter((k) => k.total >= 400)
    .filter((k) => inDomain(k.keyword, scope))
    .filter((k) => !corpus.includes(k.keyword))
    .filter((k) => scopeVerdict(k.keyword, scope).level === 'PASS')
    .sort((a, b) => b.total - a.total)
    .slice(0, limit);

  console.log('# 미커버 키워드 후보');
  console.log('');
  console.log('> 등록부 전체 텍스트에 한 번도 등장하지 않고, 취급 범위를 통과한 키워드다.');
  console.log('> 월 검색량 400 이상만 본다. 이 목록은 후보이지 글감이 아니다.');
  console.log('> 고객 상황과 불안 문장으로 바꾸고 --check 로 검증해야 글감이 된다.');
  console.log('');
  console.log('| 월 검색량 | 키워드 | 경쟁도 |');
  console.log('| ---: | --- | --- |');
  rows.forEach((r) => console.log(`| ${r.total} | ${r.keyword} | ${r.competition} |`));
  if (rows.length === 0) console.log('| - | 조건을 만족하는 키워드가 없습니다 | - |');
}

function check(data, inputs) {
  const { keywords, entries, scope, clusters, locks } = data;
  let blocked = false;

  console.log('# 글감 후보 검증');
  console.log('');

  inputs.forEach((keyword) => {
    const verdict = scopeVerdict(keyword, scope);
    const dup = duplicateCheck(keyword, entries, scope);
    const volume = volumeOf(keyword, keywords);

    console.log(`## ${keyword}`);
    console.log('');
    console.log(`- 월 검색량: ${volume > 0 ? volume : '광고 API 데이터에 없음'}`);
    if (volume > 0 && volume < 400) console.log('  - WARN: 월 400 미만이다. 단독 글보다 기존 허브 보강이 나을 수 있다.');

    if (verdict.level === 'BLOCK') {
      blocked = true;
      console.log(`- 취급 범위: **BLOCK** (${verdict.label}) ${verdict.reason || ''}`);
    } else if (verdict.level === 'WARN') {
      console.log(`- 취급 범위: WARN (${verdict.label}) → ${verdict.convert_to} / ${verdict.rule}`);
    } else {
      console.log('- 취급 범위: PASS');
    }

    if (dup.exact.length > 0) {
      blocked = true;
      console.log(`- 중복: **BLOCK** 등록부에 이미 있는 키워드다. 글번호 ${dup.exact.join(', ')}`);
    } else {
      console.log('- 중복: 완전 일치 없음');
    }

    if (dup.near.length > 0) {
      const shown = dup.near.slice(0, 8).map(([no, tok]) => `${no}(${tok})`).join(', ');
      console.log(`- 근접 ${dup.near.length}편: ${shown}`);
      console.log('  - 각 글과 어떻게 각도를 나눌지 밝히지 않으면 카니발이다.');
    } else {
      console.log('- 근접: 없음');
    }

    const relatedLocks = locks.filter((l) => keyword.includes(l.keyword) || (l.keyword && l.keyword.includes(keyword.slice(0, 3))));
    if (relatedLocks.length > 0) {
      relatedLocks.forEach((l) => console.log(`- 관찰 잠금: WARN ${l.id} (${l.status}) ${l.topic}`));
    }
    console.log('');
  });

  console.log('## 클러스터 성과');
  console.log('');
  console.log('| 클러스터 | landed | faded | faded 연속 | 판정 |');
  console.log('| --- | ---: | ---: | ---: | --- |');
  let redesign = [];
  [...clusters.entries()].sort().forEach(([cid, s]) => {
    let mark = '정상';
    if (s.streak >= 5) { mark = '**BLOCK 재설계**'; redesign.push(cid); }
    else if (s.streak >= 3) mark = 'WARN';
    console.log(`| ${cid} | ${s.landed} | ${s.faded} | ${s.streak} | ${mark} |`);
  });
  if (redesign.length > 0) {
    blocked = true;
    console.log('');
    console.log(`BLOCK: ${redesign.join(', ')} 는 faded 5연속이다. 이 클러스터의 신규 글감을 승격하지 않는다.`);
  }

  console.log('');
  console.log('## 기계가 판정하지 않는 것');
  console.log('');
  console.log('- 고객 상황과 불안 문장이 실제 사람 말인가');
  console.log('- 근접 글과 각도가 정말 갈리는가');
  console.log('- 제목이 증상형인가 (SINGLE_POST_FILE_STANDARD 참고)');
  console.log('');
  console.log('검사 통과는 하한선이다. 위 세 가지는 사람이 본다.');

  if (blocked) process.exitCode = 1;
}

function main() {
  const argv = process.argv.slice(2);
  const data = {
    keywords: readJson(PATHS.keywords, []),
    entries: registryEntries(readJson(PATHS.registry, { blocks: [] })),
    scope: readJson(PATHS.scope, {}),
    clusters: clusterStatus(readJson(PATHS.performance, { posts: [] })),
    locks: activeLocks(readJson(PATHS.queue, { blocks: [] })),
  };

  const checkArg = argv.find((a) => a.startsWith('--check'));
  if (checkArg) {
    const value = checkArg.includes('=') ? checkArg.split('=').slice(1).join('=') : argv[argv.indexOf(checkArg) + 1];
    const inputs = String(value || '').split(',').map((s) => s.trim()).filter(Boolean);
    if (inputs.length === 0) {
      console.error('사용법: node scripts/topic_candidate.js --check "키워드1,키워드2"');
      process.exitCode = 1;
      return;
    }
    check(data, inputs);
    return;
  }

  const limitArg = argv.find((a) => a.startsWith('--limit='));
  explore(data, limitArg ? Number(limitArg.split('=')[1]) || 30 : 30);
}

if (require.main === module) main();

module.exports = { registryEntries, scopeVerdict, duplicateCheck, subTokens, clusterStatus };
