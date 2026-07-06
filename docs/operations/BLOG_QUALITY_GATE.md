# 문장군 블로그 품질 게이트

> 이 문서는 `scripts/blog_quality_gate.js`가 막아야 하는 기준이다. 문서상 체크가 아니라 CLI 결과가 통과해야 발행한다.

## 1. CLI 계약

```powershell
node scripts/blog_quality_gate.js --post "posts/085_문틀교체비용.md" --mode publish --json
```

출력 예시:

```json
{
  "ok": false,
  "decision": "BLOCK",
  "exit_code": 1,
  "mode": "publish",
  "post": "posts/085_문틀교체비용.md",
  "summary": { "fail": 1, "warn": 0 },
  "issues": [
    {
      "severity": "fail",
      "code": "STATUS_MISSING",
      "message": "STATUS.md is required before publishing."
    }
  ]
}
```

## 2. 하드 FAIL

발행 제어:

- `STATUS_MISSING`
- `APPROVAL_LOG_MISSING`
- `PUBLISH_NOT_ALLOWED`
- `POST_QA_NOT_PASS`
- `PUBLISH_APPROVAL_MISSING`
- `POST_ALREADY_PUBLISHED`

원고 품질:

- `POST_VALIDATION_FAILED`
- `PHOTO_PLACEHOLDER_IN_POST`
- `PRODUCTION_NOTE_IN_POST`
- `BODY_HASHTAG_PRESENT`
- `HASHTAG_SECTION_MISSING`
- `BRAND_HASHTAG_MISSING`
- `DOOR_FRAME_ONLY_CLAIM`
- `EXCLUDED_PRODUCT_CLAIM`
- `SERVICE_SCOPE_OVERREACH`
- `UNAVAILABLE_REGION_CLAIM`
- `BRAND_REVIEW_CLAIM_INVALID`
- `BRAND_SCHEDULE_CLAIM_INVALID`
- `BRAND_OVERCLAIM`
- 질문형 제목 남발. 단, 핵심 키워드가 있고 고객 불안/의심을 직접 건드리는 고객불안형 제목은 하드 FAIL이 아니라 WARN/사람 검수로 본다.
- `중문` 단독 제목
- 금지 표현 포함
- 불가 지역 가능 표현
- 미완성 내부링크 문구
- 본문에 옛 제작노트 형식의 `# 제목 후보` 잔존

제목 숫자 누락은 하드 FAIL이 아니다. 숫자형 제목은 여전히 우선 검토 대상이지만, 모든 글을 `3가지` 구조로 강제하지 않는다. 제목 후보 5개 안에서 검색형, 현장형, 통념반박형, 손실회피형, 서비스/브랜드형을 섞고, 실제 발행 제목은 글감과 검색 의도에 맞게 선택한다.

질문형 제목도 전면 금지하지 않는다. 예전 TOP10 분석상 질문형 비중이 낮았기 때문에 기본값은 신중하게 보되, `전세집 중문 설치해도 괜찮을까?`, `중문 설치해도 효과 없는 집이 있을까?`처럼 키워드와 고객 불안이 동시에 살아 있는 제목은 허용 가능하다. 단순 궁금증형, 키워드 없는 질문형, 낚시형 질문은 보강한다.

등록부:

- `REGISTRY_ENTRY_MISSING`
- 이미 네이버 URL이 등록된 글을 다시 publish 모드로 발행하려는 경우

입력:

- `POST_ARG_MISSING`
- `POST_MISSING`
- `MODE_INVALID`
- `INPUT_ERROR`

## 3. WARN

아래는 기존 `validate_post.js`에서 WARN으로 둘 수 있다.

- 제목 길이 권장 범위 이탈
- 내부링크 2개 미만
- 해시태그 개수 권장 범위 이탈
- 사진 플레이스홀더 잔존
- 최근 제목 패턴 반복
- 098번 이후 통계 기반 현장형 원고가 본문 공백 제외 1,500~2,500자 합격 범위를 벗어남
- 글맛 게이트 보강 필요: 도입부 고객 고민 약함, 현장 변수 부족, CTA가 광고처럼 보임

단, `--strict`를 붙이면 WARN도 발행 차단으로 본다.

주의: 본문 길이는 글맛을 보조하는 지표다. 짧은 체크리스트형 글로 회귀하지 않도록 경고하되, 길이만으로 글 방향을 결정하거나 하드 FAIL 처리하지 않는다. 하드 FAIL은 제품 오표기, 미취급 제품, 개인정보, 근거 없는 실제 사례, 강한 보장 표현 같은 발행 사고에 집중한다.

## 4. 테스트 기준

테스트는 실제 CLI를 실행해야 한다.

```powershell
npm run test:blog-gate
```

필수 증명:

- 정상 발행대기 글 통과
- `STATUS.md` 없음 차단
- 발행 승인 로그 없음/보류 문구 차단
- 이미 발행완료 URL이 있는 글 재발행 차단
- 기존 원고 검수 실패 시 발행 차단
- 제목 숫자가 없더라도 다른 하드 FAIL이 없으면 publish gate가 제목만으로 차단하지 않음

## 4-1. 글맛 게이트

글맛 게이트는 발행 사고 하드게이트와 다르다. 아래 항목은 원칙적으로 WARN 또는 사람 검수 항목으로 본다. 다만 같은 문제가 반복되면 원고 보강 후 발행한다.

- 첫 5문단 안에 고객의 실제 고민, 손실, 불안, 선택 갈등이 있는가
- 현장 단락에 구조 변수 3개 이상이 자연스럽게 들어가는가
- 제목 후보 5개가 같은 문장틀로 반복되지 않는가
- AppSheet 후매칭 문장이 내부 작업 지시처럼 보이지 않는가
- CTA가 광고 문구가 아니라 문제 해결 흐름으로 이어지는가

## 5. P1 편집국 하드게이트

2026-06-18부터 블로그 게이트는 단순 문장 검수가 아니라 발행 전 사고 차단 시스템으로 본다.
아래 항목은 경고가 아니라 모두 `FAIL`이며, 하나라도 나오면 네이버 발행 금지다.

- `APPROVAL_HASH_MISSING`: `APPROVAL_LOG.md`에 승인 당시 본문 SHA-256이 없음
- `APPROVAL_HASH_MISMATCH`: 승인 후 본문이 바뀜
- `EVIDENCE_REQUIRED`: 실제 고객/현장/사례처럼 보이는 문장에 `EVIDENCE.json`의 `evidence_refs`가 없음
- `QUOTE_EVIDENCE_REQUIRED`: 직접 인용문이 있는데 `quote_status`가 없음
- `CONSTRUCTED_CASE_MISREPRESENTED`: 가상 예시를 실제 고객 사례처럼 작성함
- `EVIDENCE_REGION_MISMATCH`: 본문 지역과 `evidence_scope.region`이 맞지 않음
- `CLAIM_EVIDENCE_REQUIRED`: 숫자, 성능, 보장, 확신 표현에 claim evidence가 없음
- `UNSUPPORTED_PRODUCT_CLAIM`: 문장군 미취급/제외 제품을 가능 제품처럼 언급함
- `HASHTAG_SPACING_INVALID`: 태그란용 해시태그에 공백이 들어감
- `UNAVAILABLE_REGION_CLAIM`: 중앙 브랜드 기준 불가 지역을 가능 지역처럼 씀
- `BRAND_REVIEW_CLAIM_INVALID`: 리뷰 수를 중앙 `EVIDENCE_REGISTER.md` 범위 밖으로 씀. `네이버 상품 리뷰 3.5만 개 이상`처럼 범위 한정 필요
- `BRAND_SCHEDULE_CLAIM_INVALID`: 중문 일정을 과거 `3~4일` 기준으로 씀. 중앙 기준은 보통 3~6일
- `BRAND_OVERCLAIM`: `무조건 무상`, `평생 A/S`, `절대 추가금 없음` 같은 보장성 표현을 씀

근거 파일은 각 발행 제어 폴더에 둔다.

```text
outputs/publish_control/NNN_키워드/
├── STATUS.md
├── APPROVAL_LOG.md
└── EVIDENCE.json
```

`EVIDENCE.json` 최소 구조:

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
      "claim": "소음 완화 체감",
      "evidence_refs": ["APPSHEET_CASE_20260613_001"]
    }
  ]
}
```

공개 저장소에는 원본 고객 자료를 넣지 않는다. `evidence_refs`는 AppSheet 등 비공개 원본을 가리키는 불투명 ID만 사용한다.
