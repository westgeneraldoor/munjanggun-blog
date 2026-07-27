# 문장군 블로그 제작 시스템 고도화 감사 보고서

> 작성일: 2026-06-13  
> 목적: 포스팅 작성 업무 전체를 쪼개 분석하고, 품질·속도·성과를 동시에 높이는 운영 개선안을 확정한다.  
> 참여: 총괄 편집장 Codex, 콘텐츠 공정 진단 Huygens, 자동화 진단 Avicenna, 외부 벤치마킹 Mencius

---

## 1. 총괄 결론

문장군 블로그는 이미 `CONTENT_PLAN`, `POSTING_REGISTRY`, `ranking_report`, `top10_analysis`, `dashboard`까지 갖춘 꽤 좋은 운영 체계를 갖고 있다. 다만 현재 병목은 글을 쓰는 능력이 아니라 **발행 전 품질 게이트와 제작 산출물 관리 방식**에 있다.

핵심 개선 방향은 아래 5가지다.

| 우선순위 | 개선 방향 | 이유 |
| --- | --- | --- |
| 1 | 발행 본문과 제작 노트 분리 | 현재 `posts/`에 제목 후보, 검색 의도, 품질 채점, 예상 성능이 함께 남아 발행 복사 단계에서 실수 가능 |
| 2 | 원고 품질 자동 검수 도입 | 금지어, 제품명, 지역, 제목 규칙, 해시태그, 내부링크를 사람이 매번 검색하는 구조 |
| 3 | 내부링크·URL 등록 상태 분리 | 작성 완료와 실제 발행 완료가 `POSTING_REGISTRY.md` 한 테이블에서 섞임 |
| 4 | 템플릿 다양화 | 최근 글들이 `3가지 기준/조건/이유` 구조로 반복되어 체류 경험이 비슷해질 위험 |
| 5 | 순위 변화 해석 자동화 | `track/analyze/dashboard`는 있지만, 상승·하락·리라이팅 후보를 자동 요약하는 단계가 없음 |

---

## 2. 현재 제작 업무 전체 분해

| 단계 | 현재 입력 | 현재 산출물 | 담당 | 주요 리스크 |
| --- | --- | --- | --- | --- |
| 1. 주제 선정 | `CONTENT_PLAN.md`, `ranking_report.md` | 다음 슬롯/리라이팅 후보 | SEO 전략 | 순위 리포트가 오래되면 잘못된 우선순위 선택 |
| 2. 중복 확인 | `POSTING_REGISTRY.md` | 새 각도 정의 | 편집장 | 등록부가 길어져 사람이 놓칠 가능성 |
| 3. 경쟁 분석 | `top10_analysis.md` | 제목 패턴, 최신성 판단 | SEO 전략 | 키워드별 다른 의도를 평균 규칙 하나로 처리할 위험 |
| 4. 원고 작성 | 브랜드/제품/CTA 규칙 | `posts/NNN_키워드.md` | 작가 | 제작 메타와 발행 본문이 섞임 |
| 5. 품질 검수 | 수동 검색, 자체 점수 | 수정된 원고 | 검수관 | 자체 점수가 95점대에 몰려 실제 게이트 역할 부족 |
| 6. 등록부 업데이트 | 완성 원고 | `CONTENT_PLAN`, `POSTING_REGISTRY`, `_context` | 등록부 관리자 | URL 미등록과 작성 완료 상태가 섞임 |
| 7. 발행 후 루프 | 실제 URL, 순위 | 랭킹 리포트, 대시보드 | 분석가 | 상승·하락 원인 요약이 수동 |

---

## 3. 내부 진단 핵심 발견

### 3.1 잘하고 있는 점

- 전략 문서가 분리되어 있다: 브랜드, SEO, 콘텐츠 플랜, 등록부, 운영 플레이북.
- 순위 추적과 TOP10 분석 스크립트가 이미 있다.
- 073~077 최신 원고는 금지어와 과장 표현 검수 기준이 크게 개선됐다.
- 리라이팅 원본을 덮어쓰지 않고 새 번호로 보존하는 정책이 정착됐다.
- `POSTING_REGISTRY.md`의 "다룬 소재" 컬럼 덕분에 중복 회피 기반이 있다.

### 3.2 부족한 점 Top 10

| # | 문제 | 영향 | 개선안 |
| --- | --- | --- | --- |
| 1 | `posts/` 파일이 `# 제목 후보`로 시작 | 발행 본문 복사 실수 | `posts/`는 발행 본문만, 제작 노트는 `outputs/drafts/` |
| 2 | 검색 의도/품질 채점/예상 성능이 본문과 혼재 | 발행 직전 정리 부담 | 산출물 2종 분리: publish body + production note |
| 3 | 내부링크가 Markdown 형식이 아니라 텍스트 URL 중심 | 네이버 발행 시 앵커 최적화 부족 | 발행 본문에는 앵커 문구 + URL 세트로 표준화 |
| 4 | 이미지가 `[사진: ...]` 플레이스홀더 | 발행 직전 병목 | 이미지 체크리스트와 본문 분리 |
| 5 | 제목 패턴 반복 | 검색 결과에서 차별화 약화 | 5편 단위 제목 패턴 쿼터 운영 |
| 6 | 자체 품질점수 고정 | 검수 신뢰도 낮음 | 감점 사유 없는 95점 이상 금지 |
| 7 | 금지어 검사가 수동 | 누락 가능 | `scripts/validate_post.js` 도입 |
| 8 | URL 미등록 글 증가 | 성과 추적 누락 | 작성 상태와 발행 상태 분리 |
| 9 | 리포트 최신성 체크 없음 | 오래된 데이터로 판단 | `scripts/check_freshness.js` 도입 |
| 10 | 순위 변화 원인 요약 없음 | 다음 액션 판단 지연 | `scripts/summarize_ranking_changes.js` 도입 |

---

## 4. 외부 벤치마킹 적용안

| 벤치마킹 | 외부 관행 | 문장군 적용 방식 | 과하면 안 되는 부분 |
| --- | --- | --- | --- |
| Docs as Code | 문서도 코드처럼 버전 관리 | 원고, 전략, 등록부 변경 이력을 남김 | 모든 오탈자 수정까지 PR로 막는 것은 과함 |
| GitHub Issue Forms | 작업 요청을 표준 필드로 접수 | 새 글 브리프 템플릿 도입 | 네이버 발행용 단순 글까지 복잡한 폼은 불필요 |
| PR Template | 리뷰 체크리스트 강제 | 고위험 글만 발행 전 체크리스트 적용 | 모든 글에 무거운 리뷰는 속도 저하 |
| Markdown lint | 문서 형식 자동 검사 | 기본 형식, 링크, 제목 계층만 검사 | 네이버 글맛을 해칠 정도의 엄격한 문법 금지 |
| Vale/prose lint | 문체·금칙어 검사 | AI 냄새 표현, 제품명, 지역, 금지 표현 룰화 | 모든 표현을 기계적으로 막으면 문장이 딱딱해짐 |
| Link checker | 깨진 링크 검사 | 등록부 URL, 내부링크 확인 | 네이버 일시 차단까지 hard fail 처리 금지 |
| GitHub Actions | 정기 실행 자동화 | `track`, `analyze`, `dashboard` 예약 실행 | 네이버 자동 발행은 하지 않음 |
| Helpful Content QA | 사람에게 도움 되는 콘텐츠 기준 | 고객 의사결정 기준, 현장 변수, 무료 실측 CTA 확인 | SEO 점수만 좇는 글 생산 금지 |

참고 자료:

- GitHub Issue Forms: https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests/configuring-issue-templates-for-your-repository
- GitHub Pull Request Templates: https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests/creating-a-pull-request-template-for-your-repository
- GitHub Actions workflow syntax: https://docs.github.com/actions/using-workflows/workflow-syntax-for-github-actions
- markdownlint: https://github.com/DavidAnson/markdownlint
- Vale: https://vale.sh/docs
- lychee link checker: https://github.com/lycheeverse/lychee-action
- Google helpful content: https://developers.google.com/search/docs/fundamentals/creating-helpful-content
- Google link best practices: https://developers.google.com/search/docs/crawling-indexing/links-crawlable

---

## 5. 개선 시스템 v2 설계

### 5.1 산출물 구조 변경

권장 구조:

```text
posts/
  078_화장실문틀교체.md              # 발행 본문만

outputs/drafts/
  078_화장실문틀교체_note.md         # 제목 후보, 검색 의도, 품질 채점, 예상 성능

outputs/checks/
  078_화장실문틀교체_check.md        # 자동 검수 결과
```

발행 본문 파일에는 아래만 남긴다.

1. 추천 제목
2. 본문
3. 관련 글 링크
4. 태그란 입력용 해시태그
5. 이미지 삽입 지시가 필요하면 본문 밖 체크리스트로 분리

### 5.2 신규 품질 게이트

`scripts/validate_post.js`에서 확인할 항목:

| 영역 | 룰 |
| --- | --- |
| 제목 | 숫자 포함, 질문형 금지, 키워드 앞배치, 26~36자 권장 |
| 본문 시작 | `# 제목 후보`로 시작하면 실패 |
| 금지어 | 물론/또한/더불어/이처럼/결론적으로/안녕하세요/보양/현관문/무조건/완벽 방음/완전 방음 |
| 제품 | 허용 제품명 외 신규 제품명 경고 |
| 지역 | 불가 지역 가능 표현 경고 |
| CTA | 무료 방문실측 또는 네이버 예약 CTA 포함 |
| 해시태그 | 5~10개, 띄어쓰기 금지, 브랜드 태그 포함 |
| 내부링크 | 실제 네이버 URL 최소 2개 권장 |
| 플레이스홀더 | `[사진:`이 발행 본문에 남으면 경고 |

### 5.3 제목 패턴 쿼터

최근 글이 모두 같은 리듬이면 검색 결과에서 덜 살아난다. 숫자형은 유지하되 패턴을 돌린다.

| 패턴 | 예시 | 사용 비율 |
| --- | --- | --- |
| 기준형 | 설치 전 확인할 3가지 기준 | 35% |
| 실패방지형 | 문짝만 바꿨다가 후회하는 3가지 이유 | 20% |
| 비용형 | 견적 달라지는 3가지 항목 | 20% |
| 사례형 | 현장에서 자주 보는 3가지 문제 | 15% |
| 비교형 | A와 B 차이 3가지 | 10% |

운영 규칙: 최근 5편 중 4편 이상이 같은 제목 패턴이면 다음 글은 다른 패턴을 강제한다.

---

## 6. 30일 실행 로드맵

### 1주차: 문서와 기준 정리

- `CONTENT_WORKFLOW_PLAYBOOK.md`에 v2 산출물 분리 규칙 추가
- `posts/`는 발행 본문만 저장한다는 규칙 확정
- 발행 상태값 정의: `작성완료`, `발행대기`, `발행완료`, `성과확인`, `리라이팅후보`
- 최신 원고 073~077부터 발행 본문/제작 노트 분리 시범 적용

### 2주차: 자동 QA 최소 기능

- `scripts/validate_post.js` 작성
- `npm run validate:posts` 추가
- 073~077과 다음 078 원고에 적용
- 초기에는 warning 중심, 핵심 금지어만 hard fail

### 3주차: 운영 리포트 고도화

- `scripts/check_freshness.js`로 리포트 최신성 체크
- `scripts/summarize_ranking_changes.js`로 급등/급락/이탈 키워드 자동 요약
- `npm run ops:daily`로 `track → dashboard → summarize` 연결

### 4주차: 외부식 관리 도입

- `.github/PULL_REQUEST_TEMPLATE.md` 또는 로컬 `docs/operations/PREPUBLISH_CHECKLIST.md` 도입
- 중요 글/리라이팅 글에만 체크리스트 필수 적용
- 링크 검사와 Markdown lint는 먼저 수동 명령으로 테스트 후 도입 여부 결정

---

## 7. 새로운 팀 운영 체계

| 역할 | 책임 | 산출물 |
| --- | --- | --- |
| 총괄 편집장 | 최종 의사결정, 우선순위, 톤 관리 | 승인된 원고, 개선안 |
| SEO 전략가 | 키워드, 순위, 내부링크 | 브리프, 제목 후보 |
| 현장 기자 | 고객 상황, 현장 사례, 대화체 | 본문 초안 |
| 품질 검수관 | 금지어, 제품명, 지역, 과장 표현 | 검수 리포트 |
| 자동화 엔지니어 | 스크립트, 품질 게이트, 데이터 최신성 | `validate_post`, `check_freshness` |
| 등록부 관리자 | CONTENT_PLAN, POSTING_REGISTRY, URL 상태 | 최신 등록부 |
| 외부 벤치마커 | GitHub/SEO/콘텐츠 운영 사례 조사 | 월간 개선 제안 |

---

## 8. KPI

| 지표 | 현재 | 목표 |
| --- | --- | --- |
| 발행 전 금지어 누락 | 수동 검색 | 자동 검사 100% |
| URL 미등록 글 | 등록부에서 수동 확인 | 미등록 자동 리포트 |
| 내부링크 개수 | 글마다 편차 | 발행 본문 최소 2개 권장 |
| 제목 패턴 다양성 | 최근 글 반복 심함 | 최근 5편 중 동일 패턴 3편 이하 |
| 리포트 최신성 | 수동 확인 | 3일 이상 경과 시 경고 |
| 순위 하락 대응 | 사람이 해석 | 자동 요약 후 총괄 판단 |

---

## 9. 즉시 실행 권고

다음 작업은 포스팅 추가 작성이 아니라 아래 순서로 시스템을 손보는 것이다.

1. `scripts/validate_post.js` 제작
2. `posts/073~077`을 발행 본문과 제작 노트로 분리하는 시범 운영
3. `PREPUBLISH_CHECKLIST.md` 작성
4. `POSTING_REGISTRY.md`에 작성 상태와 발행 상태 분리
5. `summarize_ranking_changes.js`로 순위 변화 요약 자동화

총괄 판단: 지금은 글을 더 많이 쓰는 것보다, **좋은 글이 반복 생산되도록 레일을 까는 시점**이다. 이 개선을 먼저 해두면 이후 078번부터는 작성 속도와 발행 안정성이 같이 올라간다.
