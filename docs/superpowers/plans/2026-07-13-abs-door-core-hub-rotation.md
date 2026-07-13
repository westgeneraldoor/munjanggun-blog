# ABS도어 핵심 허브 순환 점검 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ABS도어 전용 하위 키워드 지도를 운영 문서에 추가하고, 모든 topic scorecard가 다섯 핵심 허브를 검토했는지 자동 WARN으로 확인한다.

**Architecture:** 활성 계약은 `TOPIC_SELECTION_SCORECARD.md`와 `validate_topic_scorecard.js`가 소유하고, `SEO_KEYWORD_RESEARCH.md`는 ABS도어 검색 의도 지도를 제공한다. 검증기는 scorecard의 `핵심 허브 순환 점검` 표를 파싱해 누락·잘못된 상태·근거 부족을 `warns`에 추가하되 기존 하드 FAIL 계약은 바꾸지 않는다.

**Tech Stack:** Node.js CommonJS, Markdown pipe tables, `assert` 기반 CLI 통합 테스트, npm 운영 스크립트

## Global Constraints

- ABS도어 글을 매회 강제 발행하지 않는다.
- 최근 발행글과 작성완료·URL등록대기 글은 중복·카니발 방지 대상으로 유지한다.
- 순환 점검 누락과 근거 부족은 WARN이며 발행 하드 FAIL이 아니다.
- 핵심 허브는 `중문`, `3연동중문`, `현관중문`, `방문교체`, `ABS도어` 다섯 개다.
- 허용 상태는 `작성 후보`, `보호`, `관찰`, `중복 보류` 네 가지다.
- `posts/` 원고는 수정하거나 커밋하지 않는다.
- 기존 작업트리의 관련 없는 변경은 보존한다.
- 새로운 외부 의존성을 추가하지 않는다.

---

## File Structure

- `docs/strategy/SEO_KEYWORD_RESEARCH.md`: ABS도어의 교체·문틀·가격·규격·공간·종류·시공 의도 지도를 설명한다.
- `docs/operations/TOPIC_SELECTION_SCORECARD.md`: 핵심 허브 순환 점검 표와 상태·근거 계약을 정의한다.
- `outputs/reports/topic_candidates/2026-07-13_topic_scorecard.md`: 새 계약을 실제 최신 판단에 적용한다.
- `scripts/validate_topic_scorecard.js`: 순환 점검 표를 파싱하고 경고를 생성한다.
- `tests/test_ops_daily_contract.js`: CLI 출력과 종료 코드를 기준으로 WARN 동작과 기존 FAIL 계약을 검증한다.

### Task 1: ABS도어 지도와 순환 점검 운영 계약 문서화

**Files:**
- Modify: `docs/strategy/SEO_KEYWORD_RESEARCH.md:33-66,193-207`
- Modify: `docs/operations/TOPIC_SELECTION_SCORECARD.md:70-80,189-246`
- Modify: `outputs/reports/topic_candidates/2026-07-13_topic_scorecard.md:1-20`

**Interfaces:**
- Consumes: `data/raw/keyword_data_product.json`, `data/raw/keyword_data_product.meta.json`, `docs/strategy/POSTING_REGISTRY.json`, `docs/strategy/ACTIVE_TOPIC_QUEUE.json`
- Produces: `## ABS도어 전용 하위 키워드 지도`와 `## 핵심 허브 순환 점검` Markdown 표 계약

- [ ] **Step 1: 현재 ABS도어 키워드 검색량을 원본에서 추출한다**

Run:

```powershell
node -e "const fs=require('fs');const rows=JSON.parse(fs.readFileSync('data/raw/keyword_data_product.json','utf8'));const keys=['ABS도어','ABS도어교체','ABS문교체','ABS문짝','ABS도어문틀','ABS문틀','ABS도어가격','ABS도어사이즈','ABS도어규격','화장실ABS도어','욕실ABS도어','ABS방문','ABS도어종류','타공도어','ABS슬라이딩도어','ABS도어시공','ABS도어설치'];for(const key of keys){const row=rows.find(item=>item.keyword===key);console.log(key+'|'+(row?row.total:'missing'));}"
Get-Content -LiteralPath 'data/raw/keyword_data_product.meta.json' -Raw -Encoding UTF8
```

Expected: `ABS도어|6660`, 세부 키워드별 숫자 또는 `missing`, `data_date`가 `2026-07-06`으로 출력된다.

- [ ] **Step 2: SEO 참고 지도에 ABS도어 전용 하위 지도를 추가한다**

Add below the current H5 description:

```markdown
### H5 보강 — ABS도어 전용 하위 키워드 지도

> 데이터 기준일: 2026-07-06. 검색량은 같은 날짜의 JSON과 meta 파일을 기준으로 한다.

| 의도군 | 대표 키워드 | 고객 질문 | 운영 판단 |
| --- | --- | --- | --- |
| 교체 범위 | ABS도어교체, ABS문교체, ABS문짝 | 문짝만 바꿀 수 있는가 | 143번과 가까우면 관찰·내부링크 우선 |
| 문틀 상태 | ABS도어문틀, ABS문틀 | 문틀까지 같이 봐야 하는가 | 문틀만 단독 교체 가능 주장 금지 |
| 가격·견적 | ABS도어가격 | 왜 견적이 달라지는가 | 059번과 겹치면 신규 가격글 보류 |
| 규격·실측 | ABS도어사이즈, ABS도어규격 | 기존 문짝 치수만 재면 되는가 | 무료 방문실측·주문제작·시공으로 전환 |
| 사용 공간 | 화장실ABS도어, 욕실ABS도어, ABS방문 | 습기 많은 공간에서 무엇을 봐야 하는가 | 기존 화장실문·세탁실문과 각도 분리 |
| 종류·선택 | ABS도어종류, 타공도어, ABS슬라이딩도어 | 어떤 형태가 맞는가 | 취급 가능한 제품과 구조만 설명 |
| 시공 판단 | ABS도어시공, ABS도어설치 | 현장에서 무엇을 확인하는가 | 가능 여부·시간·가격 단정 금지 |
```

Also replace the H5 cluster diagram's molding-only children with these seven intent groups. Keep H4/H5 마감재 관계 as a cross-link rather than an ABS-specific child cluster.

- [ ] **Step 3: 활성 scorecard 규정에 순환 점검 계약을 추가한다**

Add before the existing candidate output template:

```markdown
## 핵심 허브 순환 점검

신규 글감 후보를 확정할 때 아래 다섯 허브를 모두 검토한다. 특정 허브의 발행을 강제하지 않으며, 작성하지 않을 때도 보호·관찰·중복 보류 근거를 남긴다.

| 핵심 허브 | 상태 | 근거 글/Q-ID | 판단 근거 | 다음 액션 |
| --- | --- | --- | --- | --- |
| 중문 | 작성 후보/보호/관찰/중복 보류 중 하나 | 글 번호 또는 Q-ID | 시장 수요·daily 반응·중복 판단 | 실행 또는 재판단 시점 |
| 3연동중문 | 작성 후보/보호/관찰/중복 보류 중 하나 | 글 번호 또는 Q-ID | 시장 수요·daily 반응·중복 판단 | 실행 또는 재판단 시점 |
| 현관중문 | 작성 후보/보호/관찰/중복 보류 중 하나 | 글 번호 또는 Q-ID | 시장 수요·daily 반응·중복 판단 | 실행 또는 재판단 시점 |
| 방문교체 | 작성 후보/보호/관찰/중복 보류 중 하나 | 글 번호 또는 Q-ID | 시장 수요·daily 반응·중복 판단 | 실행 또는 재판단 시점 |
| ABS도어 | 작성 후보/보호/관찰/중복 보류 중 하나 | 글 번호 또는 Q-ID | 시장 수요·daily 반응·중복 판단 | 실행 또는 재판단 시점 |
```

Define the four exact states. Require real values in `근거 글/Q-ID`, `판단 근거`, and `다음 액션`. `관찰` and `중복 보류` must name the nearby content and next 3-day/7-day decision point.

- [ ] **Step 4: 최신 scorecard에 실제 순환 판단을 기록한다**

Insert after `오늘의 글감 포트폴리오`:

```markdown
## 핵심 허브 순환 점검

| 핵심 허브 | 상태 | 근거 글/Q-ID | 판단 근거 | 다음 액션 |
| --- | --- | --- | --- | --- |
| 중문 | 작성 후보 | 155 / Q-020 | 천장몰딩과 중문설치 유입을 상부 마감 문제로 분리 | 155번 URL 수신 후 3일 잔존 확인 |
| 3연동중문 | 보호 | Q-003 / 052·107 | 중문종류·3연동 비용 글이 TOP20에 남아 일반론은 중복 위험 | 기존 허브 내부링크 유지 후 다음 daily 재확인 |
| 현관중문 | 관찰 | 146·156 / Q-004·Q-021 | 신축 옵션 글과 원룸 현관 글이 최근 발행·URL등록대기 상태 | 146번 7일, 156번 URL 등록 후 7일 반응 확인 |
| 방문교체 | 관찰 | 143·152·153 / Q-006·Q-016·Q-017 | 문짝·문틀 범위와 셀프 실측·시트지 글이 근접 | URL 등록과 3일·7일 반응 전 신규 방문교체 글 보류 |
| ABS도어 | 관찰 | 143 / Q-006 | 최근 ABS도어 방문교체 범위 글과 카니발 위험 | 2026-07-15 3일 잔존 확인 후 하위 의도군 재선정 |
```

- [ ] **Step 5: 문서 계약을 확인하고 커밋한다**

Run:

```powershell
rg -n "ABS도어 전용 하위 키워드 지도|ABS도어교체|ABS도어문틀|ABS도어규격" docs/strategy/SEO_KEYWORD_RESEARCH.md
rg -n "핵심 허브 순환 점검|중복 보류|근거 글/Q-ID" docs/operations/TOPIC_SELECTION_SCORECARD.md outputs/reports/topic_candidates/2026-07-13_topic_scorecard.md
git diff --check -- docs/strategy/SEO_KEYWORD_RESEARCH.md docs/operations/TOPIC_SELECTION_SCORECARD.md outputs/reports/topic_candidates/2026-07-13_topic_scorecard.md
git add -- docs/strategy/SEO_KEYWORD_RESEARCH.md docs/operations/TOPIC_SELECTION_SCORECARD.md outputs/reports/topic_candidates/2026-07-13_topic_scorecard.md
git diff --cached --name-only
git commit -m "docs: add ABS door hub rotation contract"
```

Expected: 새 계약이 검색되고, whitespace 오류가 없으며, staged paths가 위 세 파일뿐이다.

### Task 2: 핵심 허브 순환 점검 WARN 검증기 구현

**Files:**
- Modify: `tests/test_ops_daily_contract.js:90-120,350-470`
- Modify: `scripts/validate_topic_scorecard.js:1-180`

**Interfaces:**
- Consumes: `## 핵심 허브 순환 점검` table with columns `핵심 허브`, `상태`, `근거 글/Q-ID`, `판단 근거`, `다음 액션`
- Produces: `validateCoreHubRotation(content): string[]`; `validateTopicScorecard()` appends these messages to `result.warns`

- [ ] **Step 1: 정상 순환 점검 fixture를 추가한다**

Add before `validScorecard()` and include `coreHubRotationSection()` before its candidate section:

```javascript
function coreHubRotationSection() {
  return [
    '## 핵심 허브 순환 점검',
    '',
    '| 핵심 허브 | 상태 | 근거 글/Q-ID | 판단 근거 | 다음 액션 |',
    '| --- | --- | --- | --- | --- |',
    '| 중문 | 작성 후보 | 155 / Q-020 | 중문 상부 마감 신규 각도 | URL 등록 후 3일 확인 |',
    '| 3연동중문 | 보호 | 052 / Q-003 | 기존 허브 성과 유지 | 다음 daily 재확인 |',
    '| 현관중문 | 관찰 | 146 / Q-004 | 최근 발행글 관찰 | 7일 잔존 확인 |',
    '| 방문교체 | 관찰 | 152 / Q-016 | URL등록대기 글과 근접 | URL 등록 후 7일 확인 |',
    '| ABS도어 | 관찰 | 143 / Q-006 | 최근 ABS도어 범위 글과 근접 | 2026-07-15 3일 잔존 확인 |',
    '',
  ].join('\n');
}
```

- [ ] **Step 2: WARN 동작 실패 테스트를 작성한다**

Add after `testValidTopicScorecardPasses()`:

```javascript
function runScorecardContent(content) {
  const dir = makeTempDir('topic-scorecard-rotation-');
  try {
    writeFile(path.join(dir, '2026-06-25_topic_scorecard.md'), content);
    return runNode([scorecardCli, '--dir', dir, '--latest']);
  } finally {
    removeDir(dir);
  }
}

function testTopicScorecardCoreHubRotationPassesWithoutWarn() {
  const result = runScorecardContent(validScorecard());
  assert.strictEqual(result.status, 0, result.stderr || result.stdout);
  assert.doesNotMatch(result.stdout, /WARN:/);
}

function testTopicScorecardMissingAbsDoorWarns() {
  const content = validScorecard().replace(
    '| ABS도어 | 관찰 | 143 / Q-006 | 최근 ABS도어 범위 글과 근접 | 2026-07-15 3일 잔존 확인 |\n',
    ''
  );
  const result = runScorecardContent(content);
  assert.strictEqual(result.status, 0, result.stdout);
  assert.match(result.stdout, /WARN: core hub rotation missing hub: ABS도어/);
}

function testTopicScorecardAbsDoorNeedsEvidence() {
  const content = validScorecard().replace(
    '| ABS도어 | 관찰 | 143 / Q-006 | 최근 ABS도어 범위 글과 근접 | 2026-07-15 3일 잔존 확인 |',
    '| ABS도어 | 중복 보류 | - | 최근 ABS도어 범위 글과 근접 | 2026-07-15 3일 잔존 확인 |'
  );
  const result = runScorecardContent(content);
  assert.strictEqual(result.status, 0, result.stdout);
  assert.match(result.stdout, /WARN: ABS도어: 중복 보류 needs evidence post or Q-ID/);
}

function testTopicScorecardUnknownRotationStateWarns() {
  const content = validScorecard().replace(
    '| ABS도어 | 관찰 | 143 / Q-006 | 최근 ABS도어 범위 글과 근접 | 2026-07-15 3일 잔존 확인 |',
    '| ABS도어 | 대기 | 143 / Q-006 | 최근 ABS도어 범위 글과 근접 | 2026-07-15 3일 잔존 확인 |'
  );
  const result = runScorecardContent(content);
  assert.strictEqual(result.status, 0, result.stdout);
  assert.match(result.stdout, /WARN: ABS도어: invalid core hub rotation state: 대기/);
}

function testTopicScorecardMissingRotationSectionOnlyWarns() {
  const result = runScorecardContent(validScorecard().replace(coreHubRotationSection(), ''));
  assert.strictEqual(result.status, 0, result.stdout);
  assert.match(result.stdout, /WARN: core hub rotation section is missing/);
}
```

Call all five tests from `main()`.

- [ ] **Step 3: 테스트를 실행해 새 WARN 검증이 없어 실패하는지 확인한다**

Run: `node tests/test_ops_daily_contract.js`

Expected: FAIL because missing/invalid rotation cases do not print expected WARN messages.

- [ ] **Step 4: parser와 순환 검증 함수를 최소 구현한다**

Add near `REQUIRED_FIELDS`:

```javascript
const CORE_HUBS = ['중문', '3연동중문', '현관중문', '방문교체', 'ABS도어'];
const CORE_HUB_COLUMNS = ['핵심 허브', '상태', '근거 글/Q-ID', '판단 근거', '다음 액션'];
const ALLOWED_ROTATION_STATES = new Set(['작성 후보', '보호', '관찰', '중복 보류']);
```

Add after `fieldValues()`:

```javascript
function splitTableLine(line) {
  const trimmed = String(line || '').trim();
  if (!trimmed.startsWith('|') || !trimmed.endsWith('|')) return null;
  return trimmed.slice(1, -1).split('|').map((cell) => cell.trim());
}

function isSeparatorLine(line) {
  const cells = splitTableLine(line);
  return Boolean(cells && cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell)));
}

function findCoreHubRotationRows(content) {
  const lines = content.split(/\r?\n/);
  const start = lines.findIndex((line) => /^##\s+핵심 허브 순환 점검\s*$/.test(line));
  if (start === -1) return { found: false, tableFound: false, rows: [] };
  let end = lines.length;
  for (let index = start + 1; index < lines.length; index += 1) {
    if (/^##\s+/.test(lines[index])) { end = index; break; }
  }
  const section = lines.slice(start + 1, end);
  const headerIndex = section.findIndex((line) => {
    const cells = splitTableLine(line);
    return cells && CORE_HUB_COLUMNS.every((column) => cells.includes(column));
  });
  if (headerIndex === -1) return { found: true, tableFound: false, rows: [] };
  const header = splitTableLine(section[headerIndex]);
  const rows = [];
  let cursor = headerIndex + 1;
  if (isSeparatorLine(section[cursor])) cursor += 1;
  for (; cursor < section.length; cursor += 1) {
    const cells = splitTableLine(section[cursor]);
    if (!cells) break;
    if (isSeparatorLine(section[cursor])) continue;
    const row = {};
    header.forEach((column, index) => { row[column] = cells[index] || ''; });
    rows.push(row);
  }
  return { found: true, tableFound: true, rows };
}

function validateCoreHubRotation(content) {
  const parsed = findCoreHubRotationRows(content);
  if (!parsed.found) return ['core hub rotation section is missing'];
  if (!parsed.tableFound) return ['core hub rotation table is missing or has invalid columns'];
  const warns = [];
  const rowsByHub = new Map(parsed.rows.map((row) => [row['핵심 허브'], row]));
  CORE_HUBS.forEach((hub) => {
    const row = rowsByHub.get(hub);
    if (!row) { warns.push(`core hub rotation missing hub: ${hub}`); return; }
    const state = row['상태'];
    if (!ALLOWED_ROTATION_STATES.has(state)) warns.push(`${hub}: invalid core hub rotation state: ${state || '(empty)'}`);
    if (isPlaceholderValue(row['근거 글/Q-ID'])) warns.push(`${hub}: ${state || '(empty)'} needs evidence post or Q-ID`);
    if (isPlaceholderValue(row['판단 근거'])) warns.push(`${hub}: ${state || '(empty)'} needs decision evidence`);
    if (isPlaceholderValue(row['다음 액션'])) warns.push(`${hub}: ${state || '(empty)'} needs next action or review point`);
  });
  return warns;
}
```

Append `result.warns.push(...validateCoreHubRotation(content));` after existing candidate-section validation. Export `validateCoreHubRotation` and `findCoreHubRotationRows`.

- [ ] **Step 5: 테스트를 통과시키고 코드만 커밋한다**

Run:

```powershell
node tests/test_ops_daily_contract.js
git add -- scripts/validate_topic_scorecard.js tests/test_ops_daily_contract.js
git diff --cached --name-only
git commit -m "feat: warn on missing core hub rotation checks"
```

Expected: `ops daily contract tests passed`; staged paths가 두 코드 파일뿐이다.

### Task 3: 실제 운영 경로 통합 검증

**Files:**
- Verify: `outputs/reports/topic_candidates/2026-07-13_topic_scorecard.md`
- Verify: `package.json`
- Verify: all files changed in Tasks 1-2

**Interfaces:**
- Consumes: latest topic scorecard and existing `npm run ops:daily` chain
- Produces: valid rotation data emits no WARN and existing daily operations still pass

- [ ] **Step 1: 최신 scorecard와 daily 운영 검증을 실행한다**

```powershell
node scripts/validate_topic_scorecard.js --file outputs/reports/topic_candidates/2026-07-13_topic_scorecard.md
npm run ops:daily
```

Expected: scorecard is `ALLOW` with no core-hub `WARN:`; daily chain exits 0. Existing unrelated WARN은 기능 결과와 분리해 기록한다.

- [ ] **Step 2: 문법·데이터·렌더링 검증을 실행한다**

```powershell
npm run check
npm run validate:data
npm run render:strategy:check
```

Expected: all commands exit 0. 기존 선행 변경으로 실패하면 이번 다섯 파일과 분리해 원인을 보고한다.

- [ ] **Step 3: 변경 범위와 공백 오류를 확인한다**

```powershell
git diff --check
git status --short
git diff -- docs/strategy/SEO_KEYWORD_RESEARCH.md docs/operations/TOPIC_SELECTION_SCORECARD.md outputs/reports/topic_candidates/2026-07-13_topic_scorecard.md scripts/validate_topic_scorecard.js tests/test_ops_daily_contract.js
```

Expected: 이번 기능 파일에 whitespace 오류가 없고 관련 없는 기존 변경은 그대로 보존된다.

- [ ] **Step 4: 남은 기능 변경이 있을 때만 정확한 파일을 커밋한다**

```powershell
git add -- docs/strategy/SEO_KEYWORD_RESEARCH.md docs/operations/TOPIC_SELECTION_SCORECARD.md outputs/reports/topic_candidates/2026-07-13_topic_scorecard.md scripts/validate_topic_scorecard.js tests/test_ops_daily_contract.js
git diff --cached --name-only
git commit -m "chore: verify ABS door hub rotation workflow"
```

Expected: staged diff가 비어 있으면 커밋을 생략한다. `posts/`와 관련 없는 작업트리 파일은 stage하지 않는다.

## Final Verification Checklist

- [ ] ABS도어 전용 하위 의도군 7개를 확인할 수 있다.
- [ ] 활성 규정이 다섯 핵심 허브와 네 상태를 정의한다.
- [ ] 최신 scorecard가 ABS도어를 `143 / Q-006` 관찰로 명시한다.
- [ ] ABS도어 누락과 근거 없는 보류는 WARN이지만 exit code 0이다.
- [ ] 기존 필수 필드 누락은 계속 BLOCK이며 exit code 1이다.
- [ ] `node tests/test_ops_daily_contract.js`가 통과한다.
- [ ] `npm run ops:daily`가 통과한다.
- [ ] 관련 없는 작업트리 변경과 `posts/` 파일은 건드리지 않는다.
