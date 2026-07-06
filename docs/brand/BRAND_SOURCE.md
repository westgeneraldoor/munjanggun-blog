# BRAND_SOURCE - 문장군 블로그 브랜드 원본 연결

> 최종 업데이트: 2026-07-01
> 목적: 문장군 블로그 프로젝트가 중앙 브랜드 원본을 어떻게 참조하는지 고정한다.

## 공식 중앙 원본

문장군 브랜드의 공통 원본은 아래 폴더다.

```text
C:\Users\hjh\안티그래비티\문장군_브랜드
```

우선 참조 파일:

```text
C:\Users\hjh\안티그래비티\문장군_브랜드\BRAND_CONTEXT.md
C:\Users\hjh\안티그래비티\문장군_브랜드\FIELD_JUDGMENT_RULES.md
C:\Users\hjh\안티그래비티\문장군_브랜드\EVIDENCE_REGISTER.md
C:\Users\hjh\안티그래비티\문장군_브랜드\OPEN_QUESTIONS_REGISTER.md
C:\Users\hjh\안티그래비티\문장군_브랜드\DESIGN.md
C:\Users\hjh\안티그래비티\문장군_브랜드\DESIGN_QUICKSTART.md
C:\Users\hjh\안티그래비티\문장군_브랜드\PHOTO_TREATMENT.md
C:\Users\hjh\안티그래비티\문장군_브랜드\ANTI_PATTERNS.md
C:\Users\hjh\안티그래비티\문장군_브랜드\BRAND_WIKI_ARCHITECTURE.md
C:\Users\hjh\안티그래비티\문장군_브랜드\SOURCE_REGISTRY.md
C:\Users\hjh\안티그래비티\문장군_브랜드\PRODUCT_WIKI_INDEX.md
C:\Users\hjh\안티그래비티\문장군_브랜드\ASSET_SEMANTIC_INDEX.md
C:\Users\hjh\안티그래비티\문장군_브랜드\BRAND_MATERIAL_INDEX.md
C:\Users\hjh\안티그래비티\문장군_브랜드\PRODUCT_SELECTION_GUIDE.md
C:\Users\hjh\안티그래비티\문장군_브랜드\FIELD_STORY_BANK.md
C:\Users\hjh\안티그래비티\문장군_브랜드\REVIEW_PROOF_BANK.md
C:\Users\hjh\안티그래비티\문장군_브랜드\PROOF_ASSET_INDEX.md
C:\Users\hjh\안티그래비티\문장군_브랜드\FAQ_OBJECTION_BANK.md
C:\Users\hjh\안티그래비티\문장군_브랜드\COPY_ASSET_BANK.md
C:\Users\hjh\안티그래비티\문장군_브랜드\tokens\brand.tokens.json
C:\Users\hjh\안티그래비티\문장군_브랜드\tokens\brand.css
C:\Users\hjh\안티그래비티\문장군_브랜드\PROJECT_ADAPTERS.md
C:\Users\hjh\안티그래비티\문장군_브랜드\CHANGELOG.md
```

## 중앙 v4.0 claim gate

2026-07-01 중앙 브랜드 v4.0부터 블로그는 아래 기준을 따른다.

- 리뷰 수, 가격, 월 납입, 무이자 할부, A/S, 일정, 서비스 지역, 이벤트, 배송/반품, 패키지 구성 같은 변동 claim은 중앙 `EVIDENCE_REGISTER.md`의 상태와 사용 기준을 우선한다.
- `OPEN_QUESTIONS_REGISTER.md`에서 `open`, `in_review`인 항목은 외부 발행 본문에서 확정 표현으로 쓰지 않는다.
- `PRODUCT_WIKI_INDEX.md`에서 `vetted`인 상품 위키는 상품 구조, 고객 고민, 선택 기준, 이미지/GIF 탐색에 사용할 수 있다.
- 상품 위키가 `vetted`여도 가격, 할인, 월 납입, 리뷰 수, 이벤트, 배송/반품, A/S, 일정, 옵션 운영 여부는 반드시 `EVIDENCE_REGISTER.md`를 다시 본다.
- 현관문/방화문은 중앙에서 `candidate` 또는 확인 필요로 보이더라도 블로그 프로젝트에서는 `POSTING_EXCLUSION_RULES.md`와 AGENTS.md의 영구 제외 기준을 유지한다.

## 블로그 프로젝트 안의 역할 분리

| 문서 | 역할 |
| --- | --- |
| `docs/strategy/BRAND_CONTEXT.md` | 블로그 프로젝트에서 바로 읽는 로컬 브랜드 스냅샷. 중앙 원본과 2026-06-25 인터뷰 요약을 반영한다 |
| `docs/brand/BLOG_BRAND_ADAPTER.md` | 중앙 원본을 네이버 블로그 글쓰기 방식으로 바꾸는 프로젝트 전용 어댑터 |
| `docs/brand/BRAND_SYNC_AUDIT_2026-06-25.md` | 중앙 원본과 블로그 스냅샷의 차이, 충돌, 승격 항목 정리 |
| `AGENTS.md` | 실제 에이전트 실행 규칙. 중앙 원본과 블로그 어댑터를 모두 읽도록 한다 |

## 운영 원칙

1. 중앙 원본은 문장군 전체 브랜드 기준이다.
2. 블로그 어댑터는 네이버 블로그 운영 방식에 맞춘 출력 규칙이다.
3. 중앙 원본과 블로그 규칙이 충돌하면 바로 덮어쓰지 말고 `BRAND_SYNC_AUDIT` 형식으로 분류한다.
4. 중앙 원본이 오래되었고 블로그 쪽 정보가 최신 인터뷰 기반이면 중앙 원본을 업데이트한다.
5. 블로그만의 규칙이면 중앙 원본에 섞지 않고 `BLOG_BRAND_ADAPTER.md`에 둔다.
6. 블로그 썸네일, 본문 사진, Before/After 이미지 기준은 중앙 `PHOTO_TREATMENT.md`를 따른다.
7. 어두운 판매형 썸네일, AI 카드뉴스형, 특가 전단지형 등은 중앙 `ANTI_PATTERNS.md`로 검수한다.
8. 토큰 파일은 웹앱/랜딩/템플릿 구현 기준이며, 순수 블로그 원고 작성에는 억지 적용하지 않는다.
9. 로컬 `docs/strategy/BRAND_CONTEXT.md`는 중앙 원본 접근 실패 시 임시 스냅샷이다. 변동 claim은 로컬 스냅샷보다 중앙 `EVIDENCE_REGISTER.md`를 우선한다.

## 외부 경로 접근 실패 시

다른 실행 환경에서 `C:\Users\hjh\안티그래비티\문장군_브랜드`를 읽을 수 없으면, 블로그 프로젝트는 `docs/strategy/BRAND_CONTEXT.md`를 임시 스냅샷으로 사용한다.

단, 중앙 원본 접근이 복구되면 다시 중앙 원본과 대조한다.

## 민감 정보 기준

중앙 브랜드 폴더와 블로그 공개 문서에는 원본 고객 자료를 넣지 않는다.

금지:

- 고객명, 전화번호, 상세 주소
- AppSheet 원본 레코드
- 상담 원문
- 네이버 관리자 통계 원본 XLSX/PNG
- 현장 사진 원본

허용:

- 비식별 현장 판단 기준
- 제품/구조/마감 변수 요약
- evidence_ref 방식의 불투명 ID
- 실제 운영을 설명하는 비공개 정보 없는 요약
