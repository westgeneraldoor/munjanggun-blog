# P1 Blog Quality Gates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the blog publish gate so unsupported, unverified, or over-claimed posts are blocked before Naver publication.

**Architecture:** Add a lightweight risk scanner for posts 068~085, then extend `scripts/blog_quality_gate.js` with hard FAIL gates for evidence, quotes, claims, region consistency, approval content hash, products, and raw hashtag spacing. Evidence metadata stays in the publish-control directory as `EVIDENCE.json`; public files store only opaque evidence IDs.

**Tech Stack:** Node.js CommonJS scripts, built-in `assert`, existing CLI tests in `tests/test_blog_quality_gate.js`, Markdown reports under `outputs/reports/`.

---

### Task 1: Existing Post Risk Scanner

**Files:**
- Create: `scripts/blog_risk_scan.js`
- Create: `outputs/reports/risk/2026-06-18_posts_068_085_risk_scan.md`
- Modify: `package.json`

- [ ] **Step 1: Write the scanner behavior**

Create `scripts/blog_risk_scan.js` with these exported functions:

```js
function scanContent(content, file) {
  return {
    file,
    quotes: [],
    case_like_sentences: [],
    regions: [],
    products: [],
    numeric_claims: [],
    performance_claims: [],
    ctas: [],
    hashtags: [],
    risk_items: []
  };
}
```

Detection rules:
- quotes: double-quoted text.
- case-like: lines containing `고객님`, `사례`, `현장`, `실제로`, or region + `시공`.
- regions: Korean service-region words found in content.
- products: known 문장군 product names and blocked product names.
- numeric claims: `%`, `100%`, `90%`, `35현장`, `15,000`, `4,000`.
- performance claims: `완벽`, `확실`, `보장`, `방음`, `차단`, `해결`, `대만족`.
- CTA: lines containing `무료 방문실측`, `네이버 예약`, `브랜드스토어`.
- hashtags: final hashtag section.

- [ ] **Step 2: Run scanner for 068~085**

Run:

```bash
node scripts/blog_risk_scan.js --from=68 --to=85 --out outputs/reports/risk/2026-06-18_posts_068_085_risk_scan.md
```

Expected: report lists each post with PASS/FIX/FAIL/NEEDS_EVIDENCE items.

- [ ] **Step 3: Add npm script**

In `package.json`, add:

```json
"risk:blog": "node scripts/blog_risk_scan.js --from=68 --to=85 --out outputs/reports/risk/2026-06-18_posts_068_085_risk_scan.md"
```

### Task 2: Approval Hash Gate

**Files:**
- Modify: `scripts/blog_quality_gate.js`
- Modify: `tests/test_blog_quality_gate.js`

- [ ] **Step 1: Write failing tests**

Add tests:

```js
function testApprovalLogRequiresContentSha256() { ... }
function testApprovalLogHashMismatchBlocksPublish() { ... }
```

Expected issue codes:
- `APPROVAL_HASH_MISSING`
- `APPROVAL_HASH_MISMATCH`

- [ ] **Step 2: Run tests and verify RED**

Run:

```bash
node tests/test_blog_quality_gate.js
```

Expected: FAIL because the gate does not check content SHA-256 yet.

- [ ] **Step 3: Implement hash validation**

Use Node `crypto.createHash('sha256')` over the post file. Accept approval lines in either form:

```text
- Content SHA-256: <hex>
```

or JSON-like:

```json
"content_sha256": "<hex>"
```

### Task 3: Evidence, Quote, Claim, Region Gates

**Files:**
- Modify: `scripts/blog_quality_gate.js`
- Modify: `tests/test_blog_quality_gate.js`

- [ ] **Step 1: Write failing tests**

Add tests for:
- actual-looking customer case without `EVIDENCE.json` → `EVIDENCE_REQUIRED`
- direct quote without quote status → `QUOTE_EVIDENCE_REQUIRED`
- `constructed_example` using actual-case wording → `CONSTRUCTED_CASE_MISREPRESENTED`
- content region differs from `evidence_scope.region` → `EVIDENCE_REGION_MISMATCH`
- strong numeric/performance claim without claim evidence → `CLAIM_EVIDENCE_REQUIRED`

- [ ] **Step 2: Run tests and verify RED**

Run:

```bash
node tests/test_blog_quality_gate.js
```

Expected: new tests fail.

- [ ] **Step 3: Implement evidence reader**

Read `EVIDENCE.json` from control dir:

```json
{
  "source_type": "appsheet_case",
  "evidence_refs": ["APPSHEET_CASE_20260613_001"],
  "quote_status": "paraphrased",
  "privacy_status": "anonymized",
  "evidence_scope": {
    "region": "안산",
    "product": "ABS도어",
    "case_type": "bathroom_door_replacement"
  },
  "claims": [
    {
      "claim": "소음 완화",
      "evidence_refs": ["APPSHEET_CASE_20260613_001"]
    }
  ]
}
```

Hard-fail rules:
- actual-case marker + no evidence refs → FAIL.
- quote + no `quote_status` → FAIL.
- constructed example + actual-case marker → FAIL.
- content region + evidence region mismatch → FAIL.
- `90%`, `100%`, `완벽`, `확실`, `보장`, `완전 방음`, `완벽 방음` + no claim evidence → FAIL.

### Task 4: Product and Hashtag Hardening

**Files:**
- Modify: `scripts/blog_quality_gate.js`
- Modify: `tests/test_blog_quality_gate.js`

- [ ] **Step 1: Write failing tests**

Add tests for:
- unsupported product term → `UNSUPPORTED_PRODUCT_CLAIM`
- raw spaced hashtag `#아파트 중문` → `HASHTAG_SPACING_INVALID`

- [ ] **Step 2: Run tests and verify RED**

Run:

```bash
node tests/test_blog_quality_gate.js
```

Expected: new tests fail.

- [ ] **Step 3: Implement product and hashtag checks**

Product deny-list includes:

```js
['현관문', '방화문', '비대칭양개형중문', '중문파티션']
```

Raw hashtag spacing regex checks the original hashtag section line, not extracted tags only.

### Task 5: Documentation and Verification

**Files:**
- Modify: `docs/operations/BLOG_QUALITY_GATE.md`
- Modify: `docs/operations/BLOG_PUBLISH_WORKFLOW.md`
- Modify: `docs/strategy/DECISION_LOG.md`

- [ ] **Step 1: Document P1 gates**

Add a section explaining:
- Evidence Gate
- Quote Gate
- Claim Gate
- Region Gate
- Product Gate
- Approval Hash Gate
- Hashtag Gate

- [ ] **Step 2: Run full verification**

Run:

```bash
npm run validate
npm run risk:blog
git ls-files "data/naver/daily/**" "data/naver/raw/**" "*.xlsx" "data/naver/**/*.png" "data/naver/**/*.jpg" "data/naver/**/*.jpeg" "data/naver/**/*.webp"
git rev-list --objects HEAD | findstr /i "data/naver xlsx png jpg jpeg webp"
```

Expected:
- `npm run validate` passes.
- raw file checks produce no output.
- risk report exists.

### Self-Review

- Spec coverage: covers hard FAIL, evidence scope matching, 068~085 risk scan, approval SHA-256, product/region/claim/hashtag checks.
- Placeholder scan: no TODO/TBD placeholders remain.
- Type consistency: evidence metadata uses `source_type`, `evidence_refs`, `quote_status`, `privacy_status`, `evidence_scope`, and `claims` consistently.
