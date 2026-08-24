# Bridge Keyword Lane Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a separate, open-ended bridge-keyword collection and candidate gate without weakening the existing product-topic safety rules.

**Architecture:** Keep `topic:check` and `product_scope.json` unchanged for product-only topics. Add a structured bridge policy, a pure bridge verdict module, a bridge candidate CLI, and a separate SearchAd collector whose seed list can be overridden at runtime. The bridge gate validates the parent context, Munjanggun service, relation, customer question, dependency statement, and registry proximity as separate values.

**Tech Stack:** Node.js 24, CommonJS, built-in `assert`, Naver SearchAd keyword tool, existing JSON/Markdown file helpers.

**Spec:** `docs/superpowers/specs/2026-08-24-bridge-keyword-lane-design.md`

## Global Constraints

- Existing `topic:check` product-lane behavior must not change.
- Parent keywords are open-ended; configuration is a seed bank and explanation registry, not an allowlist.
- `excluded_permanent` and `excluded_product` terms cannot be bypassed through the bridge lane.
- A bridge candidate must validate `service_keyword` independently through `scopeVerdict()`.
- `posts/`, private Naver data, customer media, and AppSheet source data must not be committed.
- No 201~207 manuscript body is written in this implementation.
- All production behavior is introduced test-first.

---

### Task 1: Bridge policy and pure verdict module

**Files:**
- Create: `config/bridge_keyword_policy.json`
- Create: `config/bridge_seed_keywords.json`
- Create: `scripts/lib/bridge_topic.js`
- Create: `tests/test_bridge_topic.js`

**Interfaces:**
- Consumes: `scopeVerdict(rawKeyword, scope)` and `duplicateCheck(keyword, entries, scope)` from `scripts/topic_candidate.js`.
- Produces: `validateBridgeCandidate(candidate, context)`, `parentVerdict(parentKeyword, policy, scope)`, `relationVerdict(relationType, policy)`, and `bridgeDuplicateSummary(candidate, entries, scope)`.

- [ ] **Step 1: Write failing tests for open parents and safety boundaries**

```js
const assert = require('assert');
const { validateBridgeCandidate } = require('../scripts/lib/bridge_topic');

function testUnknownParentWarnsInsteadOfBlocking() {
  const result = validateBridgeCandidate({
    parent_keyword: '로봇청소기',
    service_keyword: '문턱제거',
    relation_type: 'lifestyle_friction',
    customer_question: '로봇청소기가 방문 문턱을 계속 넘지 못하면 무엇부터 봐야 할까?',
    dependency_statement: '방문 문턱과 바닥 단차 때문에 이동이 막힌다.',
  }, fixtureContext());
  assert.strictEqual(result.blocked, false);
  assert.ok(result.warnings.some((item) => item.code === 'NEW_PARENT_KEYWORD'));
}

function testExcludedProductCannotBypassBridgeLane() {
  const result = validateBridgeCandidate({
    parent_keyword: '폴딩도어',
    service_keyword: '중문설치',
    relation_type: 'sequencing',
    customer_question: '폴딩도어 공사와 중문 설치 중 무엇을 먼저 해야 할까?',
    dependency_statement: '폴딩도어와 중문 설치 순서를 정해야 한다.',
  }, fixtureContext());
  assert.strictEqual(result.blocked, true);
  assert.ok(result.blocks.some((item) => item.code === 'PARENT_EXCLUDED_PRODUCT'));
}
```

- [ ] **Step 2: Run the test and verify RED**

Run: `node tests/test_bridge_topic.js`

Expected: FAIL with `Cannot find module '../scripts/lib/bridge_topic'`.

- [ ] **Step 3: Add policy and seed configuration**

`bridge_keyword_policy.json` contains the eight relation IDs from the spec, `known_parent_contexts` entries for the user-supplied initial terms, and human-review claim classes for `contract_responsibility` and `cause_diagnosis`. `bridge_seed_keywords.json` contains the thirteen approved initial seeds exactly as listed in the spec.

- [ ] **Step 4: Implement minimal pure validation**

```js
function validateBridgeCandidate(candidate, context) {
  const blocks = [];
  const warnings = [];
  const parent = parentVerdict(candidate.parent_keyword, context.policy, context.scope);
  const relation = relationVerdict(candidate.relation_type, context.policy);
  const service = context.scopeVerdict(candidate.service_keyword, context.scope);
  blocks.push(...parent.blocks, ...relation.blocks);
  if (service.level === 'BLOCK') blocks.push({ code: 'SERVICE_SCOPE_BLOCK', reason: service.reason });
  if (!String(candidate.customer_question || '').trim()) blocks.push({ code: 'QUESTION_REQUIRED' });
  if (!String(candidate.dependency_statement || '').trim()) blocks.push({ code: 'DEPENDENCY_REQUIRED' });
  warnings.push(...parent.warnings, ...relation.warnings);
  return { blocked: blocks.length > 0, blocks, warnings, parent, relation, service };
}
```

- [ ] **Step 5: Add tests for registered parent PASS, unknown relation BLOCK, missing dependency BLOCK, service BLOCK, and registry proximity**

Each test asserts one code: `PARENT_CONTEXT_KNOWN`, `RELATION_UNKNOWN`, `DEPENDENCY_REQUIRED`, `SERVICE_SCOPE_BLOCK`, and a duplicate summary containing the expected post number.

- [ ] **Step 6: Run focused tests and verify GREEN**

Run: `node tests/test_bridge_topic.js`

Expected: `bridge topic tests passed`.

- [ ] **Step 7: Run product-lane regression tests**

Run: `npm run test:topic-candidate`

Expected: `topic candidate tests passed`.

- [ ] **Step 8: Commit Task 1**

```powershell
git add config/bridge_keyword_policy.json config/bridge_seed_keywords.json scripts/lib/bridge_topic.js tests/test_bridge_topic.js
git commit -m "feat: add bridge topic policy and verdicts"
```

### Task 2: Structured bridge candidate CLI

**Files:**
- Create: `scripts/bridge_topic_candidate.js`
- Create: `tests/test_bridge_topic_candidate.js`
- Modify: `package.json`

**Interfaces:**
- Consumes: `validateBridgeCandidate(candidate, context)` from Task 1 and the existing registry, product scope, and bridge policy JSON files.
- Produces: CLI `topic:bridge-check` with required flags `--parent`, `--service`, `--relation`, `--question`, and `--dependency`.

- [ ] **Step 1: Write a failing CLI test for separated service validation**

```js
function testCombinedPhraseIsNotTreatedAsProductName() {
  const result = run([
    '--parent', '입주박람회',
    '--service', '중문설치',
    '--relation', 'sequencing',
    '--question', '입주박람회에서 계약한 중문은 언제 실측해야 할까?',
    '--dependency', '중문 제작 전에 현관 실측과 입주 일정을 맞춰야 한다.',
  ]);
  assert.notStrictEqual(result.status, 1, result.stdout);
  assert.match(result.stdout, /서비스 취급 범위: PASS/);
  assert.doesNotMatch(result.stdout, /미취급 추정/);
}
```

- [ ] **Step 2: Run the CLI test and verify RED**

Run: `node tests/test_bridge_topic_candidate.js`

Expected: FAIL because `scripts/bridge_topic_candidate.js` does not exist.

- [ ] **Step 3: Implement argument parsing and report output**

The CLI parses exact named arguments, loads `keyword_data_bridge.json` when present, prints exact parent volume, service verdict, relation verdict, parent/service/question proximity, warnings, blocks, and human-review items. Missing required arguments print usage and exit 1.

- [ ] **Step 4: Add tests for missing flags and excluded service**

The missing-flag test expects exit 1 and `필수 인자 누락`. The excluded-service test uses `터닝도어` and expects exit 1 with `SERVICE_SCOPE_BLOCK`.

- [ ] **Step 5: Run CLI tests and verify GREEN**

Run: `node tests/test_bridge_topic_candidate.js`

Expected: `bridge topic candidate CLI tests passed`.

- [ ] **Step 6: Register scripts and syntax/test commands**

Add:

```json
"topic:bridge-check": "node scripts/bridge_topic_candidate.js",
"test:bridge-topic": "node tests/test_bridge_topic.js && node tests/test_bridge_topic_candidate.js"
```

Append the new script and tests to `check`, and append `npm run test:bridge-topic` to `validate`.

- [ ] **Step 7: Run combined topic tests**

Run: `npm run test:topic-candidate && npm run test:bridge-topic`

Expected: all three test files pass.

- [ ] **Step 8: Commit Task 2**

```powershell
git add scripts/bridge_topic_candidate.js tests/test_bridge_topic_candidate.js package.json
git commit -m "feat: add structured bridge topic check"
```

### Task 3: Open-ended bridge keyword collector

**Files:**
- Create: `scripts/fetch_keyword_data_bridge.js`
- Create: `tests/test_fetch_keyword_data_bridge.js`
- Modify: `package.json`

**Interfaces:**
- Consumes: Naver SearchAd credentials from `scripts/lib/env_loader`, default seeds from `config/bridge_seed_keywords.json`, and optional `--seeds` CSV.
- Produces: `parseSeeds(argv, defaults)`, `mergeSeedResults(seedResults)`, `formatBridgeResults(rows, metadata)`, and local outputs `data/raw/keyword_data_bridge.json`, `.meta.json`, and `.md`.

- [ ] **Step 1: Write failing pure-function tests**

```js
function testCliSeedsOverrideDefaults() {
  assert.deepStrictEqual(parseSeeds(['--seeds', '입주청소,소파'], ['도배']), ['입주청소', '소파']);
}

function testDuplicateKeywordRetainsAllSeedParents() {
  const rows = mergeSeedResults([
    { seed: '소파', keywords: [{ relKeyword: '이삿짐', monthlyPcQcCnt: 10, monthlyMobileQcCnt: 20 }] },
    { seed: '침대', keywords: [{ relKeyword: '이삿짐', monthlyPcQcCnt: 10, monthlyMobileQcCnt: 20 }] },
  ]);
  assert.deepStrictEqual(rows[0].seedParents, ['소파', '침대']);
}
```

- [ ] **Step 2: Run collector tests and verify RED**

Run: `node tests/test_fetch_keyword_data_bridge.js`

Expected: FAIL because `fetch_keyword_data_bridge.js` does not exist.

- [ ] **Step 3: Implement pure parsing, merging, and formatting**

The module must not execute network requests when imported. `main()` runs only under `if (require.main === module)`. Volume parsing preserves the existing `< 10` estimate policy as value 5.

- [ ] **Step 4: Implement sequential SearchAd collection and safe writes**

Fetch one seed at a time with a 1-second delay, deduplicate by `relKeyword`, retain sorted unique `seedParents`, and write only bridge output filenames. Missing credentials exit 1 before any write.

- [ ] **Step 5: Run collector tests and verify GREEN**

Run: `node tests/test_fetch_keyword_data_bridge.js`

Expected: `bridge keyword collector tests passed`.

- [ ] **Step 6: Register collector commands**

Add:

```json
"keywords:bridge": "node scripts/fetch_keyword_data_bridge.js",
"test:bridge-keywords": "node tests/test_fetch_keyword_data_bridge.js"
```

Append syntax checking and `npm run test:bridge-keywords` to the existing `check` and `validate` chains.

- [ ] **Step 7: Run a live three-seed smoke collection**

Run: `npm run keywords:bridge -- --seeds "입주청소,소파,침대"`

Expected: three seed requests complete and only `keyword_data_bridge*` outputs are written. Confirm the exact parent rows include current volume and `seedParents`.

- [ ] **Step 8: Commit Task 3 without local data outputs**

```powershell
git add scripts/fetch_keyword_data_bridge.js tests/test_fetch_keyword_data_bridge.js package.json
git commit -m "feat: collect open bridge keyword demand"
```

### Task 4: Operating documentation and final verification

**Files:**
- Create: `docs/operations/BRIDGE_TOPIC_WORKFLOW.md`
- Modify: `AGENTS.md`
- Modify: `docs/OPERATING_INDEX.md`
- Modify: `docs/strategy/POSTING_EXCLUSION_RULES.md`

**Interfaces:**
- Consumes: CLI contracts from Tasks 2 and 3.
- Produces: one authoritative bridge workflow route and pointers from top-level operating documents.

- [ ] **Step 1: Document the bridge workflow**

The workflow states: parent keywords are open-ended; product and bridge lanes are separate; run `keywords:bridge`, then structured `topic:bridge-check`; review registry proximity; never infer the full parent search volume transfers to the bridge query; register completed manuscripts immediately; keep 201~207 separate from 180~191.

- [ ] **Step 2: Add top-level routing pointers**

Add a bridge-topic trigger row to `AGENTS.md` and `docs/OPERATING_INDEX.md`. Update `POSTING_EXCLUSION_RULES.md` to state that out-of-domain construction or furniture terms remain prohibited as standalone Munjanggun topics but can be evaluated as structured bridge parents.

- [ ] **Step 3: Run placeholder and contract scans**

Run:

```powershell
rg -n "T[B]D|T[O]DO|implement[ ]later|fill[ ]in" docs/superpowers docs/operations/BRIDGE_TOPIC_WORKFLOW.md
rg -n "keywords:bridge|topic:bridge-check" AGENTS.md docs/OPERATING_INDEX.md docs/operations/BRIDGE_TOPIC_WORKFLOW.md package.json
```

Expected: no placeholder matches; all four authority/command locations contain the new route.

- [ ] **Step 4: Run focused and full verification**

Run:

```powershell
npm run test:topic-candidate
npm run test:bridge-topic
npm run test:bridge-keywords
npm run validate
git diff --check
```

Expected: all commands exit 0.

- [ ] **Step 5: Commit documentation**

```powershell
git add AGENTS.md docs/OPERATING_INDEX.md docs/operations/BRIDGE_TOPIC_WORKFLOW.md docs/strategy/POSTING_EXCLUSION_RULES.md docs/superpowers/specs/2026-08-24-bridge-keyword-lane-design.md docs/superpowers/plans/2026-08-24-bridge-keyword-lane.md
git commit -m "docs: define bridge keyword operating lane"
```

- [ ] **Step 6: Inspect final branch scope**

Run:

```powershell
git status --short
git log --oneline --decorate -5
git diff main...HEAD --name-only
```

Expected: clean worktree; changes limited to bridge config, scripts, tests, package scripts, and operating documentation.
