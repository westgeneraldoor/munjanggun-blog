# 문장군 블로그 운영 색인

> 목적: 문서가 많아진 상태에서도 작업자가 어떤 상황에서 어떤 문서를 먼저 봐야 하는지 헷갈리지 않게 하는 단일 입구다. 이 문서는 문서를 줄이는 문서가 아니라, 문서 권위와 참조 경로를 정리하는 색인이다.

## 1. 문서 권위 등급

| 등급 | 의미 | 처리 |
| --- | --- | --- |
| ACTIVE_CORE | 최상위 운영 기준 | 항상 최신 기준으로 본다 |
| ACTIVE_ROUTINE | 반복 업무 실행 기준 | 해당 업무를 할 때 반드시 본다 |
| ACTIVE_STANDARD | 원고/발행 품질 기준 | 원고 작성과 발행 전 검수에 적용한다 |
| REFERENCE | 전략, 브랜드, 과거 판단 근거 | 필요할 때 참조한다 |
| GENERATED | 스크립트나 운영 과정에서 생성된 산출물 | 의사결정 근거로 쓰되 직접 규칙처럼 보지 않는다 |
| ARCHIVE_CANDIDATE | 과거 감사/분석/대체된 운영안 | 삭제하지 않고 후속 PR에서 보관 위치를 정한다 |

## 2. 최상위 권위 문서

| 문서 | 등급 | 역할 |
| --- | --- | --- |
| `AGENTS.md` | ACTIVE_CORE | 에이전트 역할, 충돌 시 우선순위, 하드 금지선, 작업 라우팅 |
| `docs/OPERATING_INDEX.md` | ACTIVE_CORE | 문서 권위와 작업별 참조 경로 |
| `docs/brand/BRAND_SOURCE.md` | ACTIVE_CORE | 중앙 브랜드 원본과 블로그 로컬 스냅샷의 관계 |
| `docs/brand/BLOG_BRAND_ADAPTER.md` | ACTIVE_CORE | 중앙 브랜드 지식을 블로그 원고로 변환하는 규칙 |
| `docs/operations/BLOG_QUALITY_GATE.md` | ACTIVE_CORE | 발행 전 CLI 하드게이트 기준 |
| `docs/operations/DATA_SECURITY_POLICY.md` | ACTIVE_CORE | 원본 통계, 고객정보, AppSheet 원본 커밋 금지 기준 |

## 3. 매일 글감 선정 시 필수

| 문서/산출물 | 등급 | 확인할 것 |
| --- | --- | --- |
| `docs/operations/DAILY_SEO_ROUTINE.md` | ACTIVE_ROUTINE | 일일 유입경로, 검색어, 게시글 TOP20 기록 방식 |
| `outputs/reports/daily/YYYY-MM-DD_seo_watch.md` | GENERATED | 실제 유입어, TOP20, 작성일, 다음 액션 |
| `docs/operations/TOPIC_SELECTION_SCORECARD.md` | ACTIVE_ROUTINE | 광고 API 시장 수요 + 블로그 실제 반응 + 문장군 필터 기준 |
| `outputs/reports/topic_candidates/YYYY-MM-DD_topic_scorecard.md` | GENERATED | 신규 글감 후보별 scorecard. 현재 누락 시 `ops:daily` WARN |
| `docs/strategy/POSTING_REGISTRY.md` | ACTIVE_ROUTINE | 기존 글 URL, 다룬 소재, 중복/카니발 위험 |
| `docs/strategy/CONTENT_PLAN.md` | ACTIVE_ROUTINE | 현재 큐와 미작성/원고완료 상태 |
| `docs/strategy/POSTING_EXCLUSION_RULES.md` | ACTIVE_STANDARD | 제외 키워드, 검색어 전환, 취급 가능/불가 |
| `data/raw/keyword_data_product.md` | GENERATED | 네이버 광고 API 제품/서비스 키워드 수요 |
| `data/raw/keyword_data_지역.md` | GENERATED | 네이버 광고 API 지역 키워드 수요 |

주의: `outputs/reports/ranking_report.md`는 daily 글감 선정의 자동 근거가 아니다. URL 기반 추적 구현 전까지 weekly/experimental 참고로만 쓴다.

## 4. 원고 작성 시 필수

| 문서 | 등급 | 확인할 것 |
| --- | --- | --- |
| `docs/operations/CONTENT_WORKFLOW_PLAYBOOK.md` | ACTIVE_ROUTINE | 신규/리라이팅/URL 등록/분석 작업 흐름 |
| `docs/operations/SINGLE_POST_FILE_STANDARD.md` | ACTIVE_STANDARD | 제작노트 없는 단일 발행 MD 원칙 |
| `docs/operations/FIELD_STORY_SECTION_STANDARD.md` | ACTIVE_STANDARD | 실제 시공 현장 단락 구조와 AppSheet 후매칭 슬롯 |
| `docs/operations/APPSHEET_FIELD_STORY_WORKFLOW.md` | ACTIVE_STANDARD | 실제 현장 데이터, evidence_ref, 비식별 기준 |
| `docs/strategy/CONTENT_OPERATING_PRINCIPLES.md` | ACTIVE_STANDARD | 사건성, 자기 연관성, 문제 중심 콘텐츠 철학 |
| `docs/strategy/HOOKING_FORMULA.md` | ACTIVE_STANDARD | 호기심, 숫자, 타깃, 통념반박, 손실, 결과 후킹 공식 |
| `docs/strategy/BRAND_CONTEXT.md` | REFERENCE | 중앙 원본 접근이 어려울 때 쓰는 블로그 로컬 브랜드 스냅샷 |
| `docs/strategy/SEO_KEYWORD_RESEARCH.md` | REFERENCE | 허브/클러스터/롱테일 키워드 구조 |

## 5. 발행 전 필수

| 문서/명령 | 등급 | 역할 |
| --- | --- | --- |
| `docs/operations/PREPUBLISH_CHECKLIST.md` | ACTIVE_STANDARD | 사람이 최종 확인할 발행 전 체크리스트 |
| `docs/operations/BLOG_PUBLISH_WORKFLOW.md` | ACTIVE_ROUTINE | STATUS/APPROVAL_LOG 발행 승인 흐름 |
| `docs/operations/BLOG_QUALITY_GATE.md` | ACTIVE_CORE | CLI가 막아야 하는 하드 FAIL 기준 |
| `npm run validate:posts` | 실행 | 포스트 단위 자동 검수 |
| `npm run gate:blog -- --post "posts/NNN_키워드.md" --mode publish --json` | 실행 | 발행 제어 하드게이트 |
| `npm run ops:daily` | 실행 | daily report, topic scorecard, keyword data freshness 확인 |

## 6. 주간/보조 분석

| 문서/명령 | 등급 | 역할 |
| --- | --- | --- |
| `outputs/reports/top10_analysis.md` | GENERATED | 상위 글 제목/구조/최신성 패턴 |
| `npm run analyze` | 실행 | TOP10 분석 갱신 |
| `outputs/reports/ranking_report.md` | GENERATED | experimental 순위 참고 자료 |
| `npm run track` | 실행 | experimental 순위 추적 |
| `npm run ranking:summary` | 실행 | experimental 순위 변화 요약 |
| `npm run ops:weekly` | 실행 | ranking/top10/tracking history 보조 지표 주간 점검 |

주의: ranking 산출물은 보호 글, 리라이팅, 신규 글감의 단독 근거가 아니다.

## 7. 참고 문서

| 문서 | 등급 | 비고 |
| --- | --- | --- |
| `docs/brand/BRAND_SYNC_AUDIT_2026-06-25.md` | REFERENCE | 중앙 브랜드 원본과 블로그 규칙 차이 감사 결과 |
| `docs/strategy/DECISION_LOG.md` | REFERENCE | 과거 의사결정 기록. 최신 운영은 ACTIVE 문서 우선 |
| `docs/strategy/_context.md` | REFERENCE | 세션 요약과 현재 운영 맥락 |
| `docs/templates/` | REFERENCE | STATUS/APPROVAL_LOG 템플릿 |

## 8. Archive 후보

아래 문서는 삭제하지 않는다. 다만 현재 작업자의 필수 읽기 문서로 보지 않고, 후속 PR에서 `docs/archive/` 이동 여부를 검토한다.

| 문서 | 이유 |
| --- | --- |
| `docs/operations/CONTENT_PRODUCTION_IMPROVEMENT_AUDIT_20260613.md` | 과거 개선 감사. 제작노트 분리 등 일부는 현재 단일 MD 원칙으로 대체됨 |
| `docs/strategy/PHASE4_ANALYSIS_20260518.md` | 과거 분석. 현재 daily/scorecard 운영과 직접 연결되지 않음 |
| `outputs/audit/` | 감사 패키지. 공개/커밋 여부는 `DATA_SECURITY_POLICY.md` 우선 |

## 9. 후속 PR로 남긴 것

이번 색인 정리 범위에서는 아래를 구현하지 않는다.

- topic scorecard 누락을 WARN에서 hard fail로 올릴지 판단
- 날짜별 topic scorecard 자동 생성
- `POSTING_REGISTRY.md` 구조 분리
- archive 후보 문서 실제 이동

이 항목들은 운영 루틴 고도화 후속 PR에서 처리한다.
