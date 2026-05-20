# 문장군 블로그

## 프로젝트 개요
문장군(도어/중문/현관문 시공 전문업체)의 네이버 블로그 SEO 콘텐츠 생산 시스템.
코딩 프로젝트가 아니라, **블로그 글을 체계적으로 기획·작성·추적하는 SEO 파이프라인**.
인스타그램 콘텐츠는 별도 독립 프로젝트(`문장군 인스타그램`)에서 관리.

## 기술 스택
- 콘텐츠 생산: 블로그엔진 스킬 v4.0
- 키워드 데이터: 네이버 검색광고 API (scripts/fetch_keyword_data.js)
- 순위 추적: 네이버 검색 API (scripts/track_ranking.js)
- 상위 분석: scripts/analyze_top10.js
- 대시보드: scripts/generate_dashboard.js

## 핵심 문서 위치
- 에이전트: `./AGENTS.md`
- 브랜드: `./BRAND_CONTEXT.md` (v3.0)
- 키워드: `./SEO_KEYWORD_RESEARCH.md` (v3.0)
- 발행계획: `./CONTENT_PLAN.md` (v4.0)
- 포스팅 등록: `./POSTING_REGISTRY.md`
- 결정 로그: `./DECISION_LOG.md`
- 진행현황: `./_context.md`

## 현재 단계
블로그 Phase 4 진행 중 (35편 발행 완료).
Phase 4 전략: 알고리즘 변동 대응 — 지역 시공사례 대량 확장 (하루 1편 유지 모드).
인스타그램 프로젝트 분리 완료 (2026-05-18, DEC-019).

## 콘텐츠 규칙
- 브랜드 톤: 전문가 (시공/상담/견적)
- 금지: "하루 20개 시공"(고정숫자 단정), 보양작업 언급, AI 냄새 표현, 현관문 콘텐츠(DEC-017)
- CTA: 네이버 예약 > 브랜드스토어 > 댓글/저장
- 제품명 정확성 필수, 없는 제품/불가 지역 언급 금지

## 문서 우선순위
충돌 시 `AGENTS.md` → `DECISION_LOG.md` → `PRD_*.md` → 운영/브랜드 문서 → 외부 `SKILL.md` → `_context.md` → 채팅 순서로 판단.
장기 결정은 `DECISION_LOG.md`에 기록한다.

## 파이프라인 흐름
```
콘텐츠기획 → BRAND_CONTEXT + SEO_KEYWORD + CONTENT_PLAN
                         ↓
AGENTS.md + 블로그엔진 → posts/NNN_키워드.md
                         ↓
포스팅 → 순위 추적 → TOP10 분석 → 전략 고도화
```
