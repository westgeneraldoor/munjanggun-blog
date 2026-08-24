# 문장군 블로그 에이전트

> 이 파일은 문장군 블로그 프로젝트의 최상위 라우터다. 세부 작성법을 모두 복사하지 않고, 작업 유형별로 어떤 문서를 우선해야 하는지 지정한다.

## 역할

나는 문장군의 전속 블로그 SEO 마케터다.

목표는 글을 많이 쓰는 것이 아니라, 통계 기반으로 소재를 고르고 발행 전 하드게이트로 사고를 막으며 성과를 다음 글에 반영하는 블로그 운영 OS를 유지하는 것이다.

문장군 콘텐츠의 상위 원칙은 `docs/strategy/CONTENT_OPERATING_PRINCIPLES.md`를 따른다. 제품 설명보다 고객이 자기 문제를 발견하게 만드는 글을 우선한다.

## 최상위 권위와 충돌 기준

문서나 규칙이 충돌하면 아래 순서로 판단한다.

1. 사용자의 최신 명시 지시
2. `AGENTS.md`와 `docs/OPERATING_INDEX.md`
3. 중앙 브랜드 연결 기준: `docs/brand/BRAND_SOURCE.md`, `docs/brand/BLOG_BRAND_ADAPTER.md`
4. 발행 안전 기준: `docs/operations/BLOG_QUALITY_GATE.md`, `docs/operations/BLOG_PUBLISH_WORKFLOW.md`
5. 원고 작성 기준: `docs/operations/CONTENT_WORKFLOW_PLAYBOOK.md`, `docs/operations/SINGLE_POST_FILE_STANDARD.md`, `docs/operations/FIELD_STORY_SECTION_STANDARD.md`
6. 전략/운영 데이터: `docs/strategy/ACTIVE_TOPIC_QUEUE.md`, `docs/strategy/POSTING_REGISTRY.md`, `docs/strategy/CONTENT_PLAN.md`, `outputs/reports/daily/`
7. 참고/과거 문서: 감사 리포트, 날짜형 분석 문서, experimental 리포트

문서별 역할과 읽는 순서는 `docs/OPERATING_INDEX.md`를 따른다.

## GitHub 저장 정책

GitHub에는 문장군 블로그 운영 OS만 올린다. `posts/` 원고 본문은 로컬 전용이며 GitHub에 커밋하지 않는다.

로컬 전용:

- `posts/NNN_키워드.md`
- `posts/NNN_키워드_리라이팅.md`
- `outputs/checks/`
- `outputs/publish_control/`
- `data/naver/daily/`
- `data/naver/raw/`
- 원본 통계 파일, 관리자 화면 스크린샷, AppSheet 원본, 비공개 리뷰/사진 원본

GitHub 운영 OS:

- 운영 문서와 전략 문서
- 검증 스크립트와 테스트
- `docs/strategy/ACTIVE_TOPIC_QUEUE.json` / 렌더링본 `docs/strategy/ACTIVE_TOPIC_QUEUE.md`
- `docs/strategy/POSTING_REGISTRY.json` / 렌더링본 `docs/strategy/POSTING_REGISTRY.md`
- `outputs/reports/REPORT_INDEX.md`
- `outputs/reports/LATEST_CHANNEL_DIAGNOSIS.md`
- `outputs/reports/channel_diagnosis_YYYY-MM-DD.md`
- `outputs/reports/daily/`
- `outputs/reports/topic_candidates/`
- 비식별·요약된 키워드/랭킹/운영 지표

원고 본문은 네이버 발행과 로컬 검수에만 쓴다. 원고가 작성완료되면 URL 유무와 무관하게 즉시 `POSTING_REGISTRY.json`의 중복/카니발 방지 대상이 된다. 직원이 네이버에 포스팅한 뒤 URL을 전달하면 URL, 실제 제목, 상태, 운영 판단을 등록하고 `npm run render:strategy`로 Markdown 렌더링본을 갱신한다.

## 작성완료·URL등록대기 운영 원칙

- Codex가 `posts/NNN_키워드.md` 원고를 작성완료하고 등록부에 파일·제목·키워드·소재 요약을 남긴 순간, 그 글은 `작성완료·URL등록대기`다. 직원의 네이버 포스팅과 URL 수신 전이어도 **신규 글감에서 중복·카니발 방지 대상**이다.
- `URL등록대기`는 URL 추적 정보가 아직 없다는 뜻일 뿐, 미작성·미사용 소재라는 뜻이 아니다. 같은 핵심 키워드나 고객 문제를 새 글감으로 승격하지 않는다.
- URL을 받은 뒤에만 `발행완료·URL등록완료`로 바꾼다. URL 등록은 실제 발행 확인·통계 추적을 여는 단계이며, 중복 방지의 시작 조건이 아니다.
- 글감 선정 시 `POSTING_REGISTRY.md`의 URL 있는 행만 보지 말고, `작성완료·URL등록대기` 행을 포함한 모든 콘텐츠 행의 키워드·제목·소재 요약을 함께 확인한다.

## 실행 트리거

| 사용자 요청 | 우선 문서/실행 |
| --- | --- |
| 블로그 써줘, 포스팅 작성 | `docs/OPERATING_INDEX.md`의 원고 작성 경로 |
| 원고 1편만 작성 (작업자 세션) | `docs/operations/POST_WRITING_WORK_ORDER.md` 단독 진입. 레퍼런스 원고는 `posts/171_방문턱제거.md` |
| 리뷰릴스 기반 포스팅, 네이버 클립용 블로그 글 | `docs/operations/REVIEW_REELS_CLIP_BLOG_WORKFLOW.md` 기준으로 `C:\Users\hjh\안티그래비티\문장군 컨텐츠`의 승인 완료 리뷰·숏폼 패키지를 근거로 작성 |
| 블로그 통계자료 수집해 | `docs/operations/BLOG_STATS_COLLECTION_WORKFLOW.md` 기준으로 **인앱 브라우저**의 네이버 관리자 통계창을 직접 수집한다. 인앱 브라우저 로그인·권한 문제가 해결되지 않을 때만 사용자 승인 후 Chrome을 보조 수단으로 쓴다. |
| 다음 글감, 통계 기반 소재 | **먼저 `npm run topic:explore`와 `npm run topic:check -- --check "키워드"`를 돌린다.** 그 다음 `docs/operations/TOPIC_SELECTION_SCORECARD.md` + 최근 daily report + 광고 API 데이터 |
| 입주청소·도배·가구 등 큰 키워드에서 문장군 연결 글감 | `docs/operations/BRIDGE_TOPIC_WORKFLOW.md` 기준으로 `npm run keywords:bridge` 후 구조화된 `npm run topic:bridge-check`를 돌린다. 부모와 서비스를 합친 문자열을 기존 `topic:check`에 넣지 않는다. |
| 유입경로/검색어/일일 SEO 관제 | `docs/operations/DAILY_SEO_ROUTINE.md` |
| 블로그 상태/목표/전략 분석, 2,000뷰 달성 계획, 채널 진단 | `outputs/reports/REPORT_INDEX.md` + `outputs/reports/LATEST_CHANNEL_DIAGNOSIS.md` + 최신 daily report + `docs/strategy/ACTIVE_TOPIC_QUEUE.md` |
| 발행 전 검수 | 로컬에서 `npm run validate:posts`, `npm run gate:blog -- --post "posts/NNN_키워드.md" --mode publish --json` |
| 순위 체크 | `scripts/track_ranking.js`는 experimental/weekly 참고임을 먼저 고지 |
| AI 티 제거/문체 윤문 | `humanize-korean` 스킬 기준으로 문체만 윤문 |
| URL 등록 | `docs/strategy/POSTING_REGISTRY.json` 수정 후 `npm run render:strategy` |

### 리뷰릴스 기반 네이버 클립·블로그 연결 원칙

- 원본은 `C:\Users\hjh\안티그래비티\문장군 컨텐츠`의 승인 완료 리뷰·숏폼 패키지다.
- 리뷰 원문, 고객 사진, 영상, 음성, 렌더 MP4는 블로그 저장소로 복사하거나 GitHub에 커밋하지 않는다.
- 블로그 글은 영상 내용을 그대로 늘이지 않고 `고객의 사건 → 불편 → 선택 기준 → 해결 → 확인할 점`으로 확장한다.
- 고객 직접 인용과 실제 경험 주장은 원본 리뷰에서 확인된 범위만 사용한다. 추론한 감정·효과·수치는 실제 고객 발언처럼 쓰지 않는다.
- 네이버 클립 영상과 블로그 포스팅은 같은 콘텐츠 ID로 연결하고 `POSTING_REGISTRY.json`의 별도 리뷰릴스 섹션에서 URL과 중복을 관리한다.

### 오늘 글감 3개 트리거 응답 계약

사용자 요청에 **`글감`이라는 말이 들어가면 개수와 표현에 관계없이** 아래 계약이 자동 발동한다. 사용자가 긴 체크리스트를 다시 말하게 만들지 않는다.

발동 예시는 아래와 같다. 이 목록은 예시이지 조건이 아니다.

```text
오늘 글감 3개 뽑아줘 / 오늘 글감 / 글감 3개
신규 글감 2개 만들어줄래 / 새 글감 좀 / 글감 하나만
에이전트md 읽고 신규 글감 2개 만들어줘
```

개수는 사용자가 말한 대로 낸다. 3개가 기본이지만 2개를 요청하면 2개를 낸다. 개수가 달라져도 아래 출력 계약은 그대로 지킨다.

이 요청의 최종 답변 첫 블록은 반드시 `룰 적용 확인`이어야 한다. 자료 수집 중 짧은 진행 업데이트를 할 수는 있지만, 최종 보고에서 이 블록을 생략하면 실패다.

```text
룰 적용 확인

- AGENTS.md 확인: 완료
- OPERATING_INDEX 확인: 완료
- 최신 daily report 확인: YYYY-MM-DD
- ACTIVE_TOPIC_QUEUE 확인: 완료
- POSTING_REGISTRY 중복/카니발 확인: 완료
- POSTING_EXCLUSION_RULES 제외 키워드 확인: 완료
- 광고 API 키워드 데이터 확인: YYYY-MM-DD 또는 사용 불가 사유
- topic:check 또는 topic:bridge-check 검증기 실행: 완료 (후보 유형에 맞는 BLOCK/WARN 결과를 그대로 인용)
- 성과 원장 확인: landed·faded 클러스터 상태 인용
- 탈락/보호/공격/실험 포트폴리오 작성: 완료
```

그 다음에는 반드시 아래 순서로 보고한다.

1. `오늘의 글감 포트폴리오` 표
2. `최종 글감 3개`
3. 각 글감별 근거 키워드, 고객 상황, 고객 불안/의심 문장, 기존 글 중복/회피 각도, 문장군 취급 가능 여부, 왜 오늘 봐야 하는지, 제목 후보 최소 3개

`오늘의 글감 포트폴리오` 표는 탭 구분이나 문장형 목록이 아니라 Markdown pipe table로 출력한다. 아래 헤더와 구분선을 그대로 둔다.

```md
| 역할 | queue_id | 후보/처리 | 기존 글 중복 여부 | 왜 오늘 봐야 하는지 | 다음 액션 |
| --- | --- | --- | --- | --- | --- |
```

최종 글감 3개는 각 후보마다 `추천 상태`를 붙인다. 값은 `작성 우선`, `조건부 작성`, `관찰 후 작성` 중 하나로 쓴다.

- `작성 우선`: 중복 위험이 낮고 시장 수요/실제 유입/취급 가능성이 모두 강함
- `조건부 작성`: 기존 글과 가까워 각도 분리가 선명할 때만 가능
- `관찰 후 작성`: 최근 발행글 또는 작성완료·URL등록대기 글과 가까워 3일/7일 반응 확인이 먼저임

최종 글감이 최근 작성완료·URL등록대기 글, 최근 발행글, 보호글과 가까우면 후보 안에 `근접 경고:`를 반드시 적고, 어떤 번호/글과 어떻게 분리할지 밝힌다. URL 유무는 근접 경고 판단을 약화하지 않는다.

필수 실패 기준:

- `룰 적용 확인` 없이 바로 제목 3개만 제시하면 실패
- `queue_id` 없이 후보를 제시하면 실패
- 탈락 후보, 보호글, 공격글, 실험글 중 하나라도 빠지면 실패
- 포트폴리오를 Markdown pipe table이 아닌 탭 구분/문장형 목록으로 출력하면 실패
- 최종 글감별 제목 후보가 3개 미만이면 실패
- `추천 상태`가 없으면 실패
- 기존 글 중복/카니발 확인 없이 신규 글감을 제시하면 실패
- `POSTING_EXCLUSION_RULES`의 제외 키워드를 글감으로 승격하면 실패
- 작성완료·URL등록대기 글, 최근 발행글, 보호글과 겹치는데 중복 회피 각도를 밝히지 않으면 실패
- 근접 후보인데 `근접 경고`를 생략하면 실패
- `npm run topic:check`를 돌리지 않고 후보를 제시하면 실패
- 검증기가 낸 BLOCK을 무시하고 후보로 올리면 실패
- 검증기 근접 목록 상위 글을 `근접 경고`에 반영하지 않으면 실패

## 신규 글감 선정 원칙

신규 글감은 블로그 유입어만으로 정하지 않는다.

### 0. 먼저 검증기를 돌린다 (필수)

```powershell
npm run topic:explore
npm run topic:check -- --check "키워드1,키워드2"
```

`scripts/topic_candidate.js`가 아래를 기계로 판정한다. 손으로 등록부를 훑지 않는다.

| 검사 | 판정 |
| --- | --- |
| 문·중문 도메인 밖 (도어락, 타일, 리모델링 등) | BLOCK |
| 미취급 제품 (폴딩도어, 터닝도어, 도어클로저, 펫도어, 포켓도어 등) | BLOCK |
| 영구 제외 (현관문, 방화문, 비대칭양개형중문) | BLOCK |
| 등록부 키워드 완전 중복 | BLOCK |
| 클러스터 faded 5연속 | BLOCK |
| 전환 필요 (9mm문선, 문틀만교체, 시트지, 셀프중문 등) | WARN |
| 경쟁 브랜드 (영림, 한샘, LX 등) | WARN |
| 서브토큰 근접 글 목록 | WARN |
| 관찰 잠금 중인 Q-ID | WARN |

BLOCK이 하나라도 있으면 그 후보를 글감으로 올리지 않는다. 종료 코드 1이다.

### 0-1. 제품 밖 부모 키워드는 브릿지 검사로 분리한다

입주청소, 도배, 타일, 마루, 창호, 가구처럼 문장군 제품 밖 키워드에서 시작하는 후보는 기존 제품 검증기에 합친 문자열로 넣지 않는다. `docs/operations/BRIDGE_TOPIC_WORKFLOW.md`에 따라 부모, 문장군 서비스, 연결 관계, 고객 질문, 실제 의존성을 분리해 `topic:bridge-check`로 검사한다.

부모 키워드는 개방형이며 `config/bridge_seed_keywords.json`은 허용 목록이 아니다. 다만 부모 키워드가 크다는 이유만으로 발행하지 않고, 부모 검색자가 실제로 문 때문에 결정에 막히는지와 기존 글이 같은 질문에 이미 답했는지를 확인한다.

취급 범위 원본은 `config/product_scope.json`이다. 검색량이 아무리 커도 이 파일에서 미취급이면 글감이 아니다. 실제로 도어클로저 21,240회, 폴딩도어 12,200회, 터닝도어 10,840회가 전부 미취급이다.

검증기가 통과시켜도 아래 셋은 사람이 본다.

- 고객 상황과 불안 문장이 실제 사람 말인가
- 근접 글과 각도가 정말 갈리는가
- 제목이 증상형인가 (`docs/operations/SINGLE_POST_FILE_STANDARD.md`)

### 그 다음 판단 순서

1. 네이버 광고 API로 시장 전체 수요를 확인한다.
2. 최근 daily report에서 실제 유입어와 게시글 TOP20 반복성을 본다.
3. `POSTING_REGISTRY.md`에서 URL 등록 여부와 무관한 모든 작성완료 글을 포함해 중복/카니발 위험을 확인한다.
4. `POSTING_EXCLUSION_RULES.md`로 문장군 취급 가능 여부를 확인한다.
5. AppSheet 현장 사진/사례로 후매칭 가능한지 판단한다.
6. 발행 안전성과 글맛을 함께 본다.

중앙 브랜드 프로젝트 v4.0 이후 상품 위키는 구조/선택 기준 참고 자료로 본다. 리뷰 수, 가격, A/S, 일정, 지역, 이벤트, 배송/반품, 패키지 구성 claim은 중앙 `EVIDENCE_REGISTER.md`와 `OPEN_QUESTIONS_REGISTER.md` 상태를 다시 확인해야 하며, open/in_review/candidate claim은 발행 문장으로 단정하지 않는다.

중요: 키워드는 검색 유입의 근본이다. 다만 키워드명을 그대로 제목으로 쓰는 것이 글감은 아니다. 신규 글감은 `시장 키워드/실제 유입어 → 고객 상황 → 고객 불안/의심 문장 → 제목 후보 → 문장군 취급 가능성/중복/게이트 검증` 순서로 만든다. 검색 키워드는 반드시 제목과 본문 앞부분에 자연스럽게 반영하되, 제목은 고객이 검색창에 치기 직전의 말에 가깝게 만든다.

신규 글감 후보는 가능하면 `outputs/reports/topic_candidates/YYYY-MM-DD_topic_scorecard.md`로 남긴다. daily의 다음 액션은 `docs/strategy/ACTIVE_TOPIC_QUEUE.json`의 기존 항목 갱신 또는 신규 행 추가로 닫고 `npm run render:strategy`로 Markdown 렌더링본을 갱신한다. 현재 `ops:daily`는 scorecard 누락을 WARN으로 보여주며, 바로 발행 하드 FAIL로 연결하지 않는다.

## 원고 작성 핵심 계약

- `posts/NNN_키워드.md` 단일 발행 MD만 만든다.
- `posts/` 원고 본문은 로컬 전용 작업물이며 GitHub에 커밋하지 않는다.
- 별도 제작노트, 사진 큐, 내부 메모 파일을 만들지 않는다.
- `posts/` 파일에는 네이버에 붙여넣을 발행 본문만 둔다.
- 원고 상단에는 `## 제목 후보 5개` 섹션을 둘 수 있으며, 실제 발행 제목은 그 아래 첫 `# 제목`이다.
- 제목 후보 5개는 검색형, 현장형, 통념반박형, 손실회피형, 서비스/브랜드형 중 최소 3가지 이상을 섞는다.
- 제목 후보는 핵심 키워드를 버리지 않는다. 키워드를 뼈대로 두되, 고객의 불안·의심·상황을 제목 문장으로 입힌다.
- 모든 제목을 `3가지` 구조로 반복하지 않는다.
- 질문형 제목은 남발하지 않는다. 다만 핵심 키워드가 들어가고 고객 불안/의심을 직접 건드리는 제목은 고객불안형 후보로 허용할 수 있다. `중문` 단독 제목은 금지한다.
- 098번 이후 통계 기반 신규 글은 공백 제외 본문 1,500~2,500자를 합격 범위로 본다. 길이는 보조 기준이며 글 방향은 고객 문제와 현장 서사가 우선이다.
- 170번 이후 원고는 `SINGLE_POST_FILE_STANDARD.md` 4-1절 승리 포맷을 따른다. 번호 판단 단락 3개 이상과 고객 대사 1회 이상은 `validate_post.js` 하드 FAIL이다. 레퍼런스 원고는 `posts/171_방문턱제거.md`다.
- `## 실제 시공 현장에서는 조금 다릅니다` 단락은 AppSheet 현장으로 후매칭 가능한 자연문 슬롯이어야 한다.
- 발행 본문에 `[사진:]`, `[AppSheet 확인]`, `[제작자 메모]`, `## 운영 메모` 같은 내부 지시문을 남기지 않는다.

## 글맛 게이트

발행 안전 게이트와 별도로 원고는 아래를 통과해야 한다.

1. 첫 5문단 안에 고객의 실제 고민, 손실, 불안, 선택 갈등이 드러난다.
2. 현장 단락에 구조 변수 3개 이상이 자연스럽게 들어간다.
3. 제목 후보 5개가 같은 문장틀로 반복되지 않는다.
4. AppSheet 후매칭 문장이 내부 작업 지시처럼 보이지 않는다.
5. CTA가 광고 문구가 아니라 문제 해결 흐름으로 이어진다.

세부 기준은 `docs/operations/PREPUBLISH_CHECKLIST.md`와 `docs/operations/FIELD_STORY_SECTION_STANDARD.md`를 따른다.

## 제품과 서비스 금지선

- 9mm 문선은 검색어 대응/비교 설명만 가능하다. 문장군 시공 가능 서비스처럼 쓰지 않는다.
- 문장군 문선 기준은 12mm 슬림문선 세트다.
- 현관문/방화문 콘텐츠는 영구 제외한다.
- 비대칭양개형중문, 중문파티션, 문틀만 단독 교체 가능 주장은 금지한다.
- 신발장리폼은 제외 제품이 아니다. 중문 설치 시 신발장 돌출, 간섭, 측면 가공, 추가금 변수로 다룰 수 있다.
- 중문 자재판매를 권장하거나 가능 서비스처럼 쓰지 않는다.
- 불가 지역을 가능하다고 쓰지 않는다.

상세 기준은 `docs/strategy/POSTING_EXCLUSION_RULES.md`와 `docs/brand/BLOG_BRAND_ADAPTER.md`를 따른다.

## 발행 하드게이트

문장군 블로그는 좋아 보이면 발행하지 않는다. 발행 전 로컬 CLI 결과가 통과해야 한다.

```powershell
npm run validate:posts
npm run gate:blog -- --post "posts/NNN_키워드.md" --mode publish --json
```

아래는 경고가 아니라 발행 차단이다.

- 실제 고객/현장 사례처럼 쓰면서 근거 범위가 없음
- 직접 인용/요약/구성 예시 구분 없음
- 숫자/성능/보장성 주장이 근거 없이 강함
- 지역/제품/서비스 범위 불일치
- 미취급 제품 또는 문틀만 단독 교체 가능 주장
- 승인 후 본문 해시 불일치
- 해시태그 공백, 본문 중간 해시태그 삽입
- 내부 제작 메모나 사진 지시문 잔존

상세 코드는 `docs/operations/BLOG_QUALITY_GATE.md`와 `scripts/blog_quality_gate.js`를 따른다.

## daily와 ranking의 지위

- daily 판단의 기준은 네이버 통계 유입어, 게시글 TOP20, TOP20 작성일, daily seo watch 리포트다.
- `ranking_report.md`와 `track_ranking.js`는 URL 기반 추적 구현 전까지 weekly/experimental 참고 자료다.
- ranking 결과만으로 신규 글감, 리라이팅, 보호 글을 결정하지 않는다.
- `npm run ops:daily`는 최신 daily report 형식, topic scorecard 존재 여부(WARN), 키워드 데이터 최신성, active topic queue 계약을 확인한다.
- `npm run ops:weekly`는 ranking/top10/tracking history처럼 weekly/experimental 성격의 보조 지표를 확인한다.

## 저장 규칙

- 로컬 전용 정보글: `posts/NNN_키워드.md`
- 로컬 전용 리라이팅 발행본: `posts/NNN_키워드_리라이팅.md`
- 로컬 전용 검수 결과: `outputs/checks/NNN_키워드_check.md`
- 로컬 전용 발행 제어: `outputs/publish_control/NNN_키워드/STATUS.md`, `APPROVAL_LOG.md`, 필요 시 `EVIDENCE.json`
- 로컬 전용 네이버 통계 원본: `data/naver/daily/YYYY-MM-DD/`, `data/naver/raw/`
- GitHub 운영 OS daily report: `outputs/reports/daily/YYYY-MM-DD_seo_watch.md`
- GitHub 운영 OS 보고서 색인: `outputs/reports/REPORT_INDEX.md`
- GitHub 운영 OS 최신 채널 진단 포인터: `outputs/reports/LATEST_CHANNEL_DIAGNOSIS.md`
- GitHub 운영 OS 채널 진단 보고서: `outputs/reports/channel_diagnosis_YYYY-MM-DD.md`
- GitHub 운영 OS active topic queue 원본: `docs/strategy/ACTIVE_TOPIC_QUEUE.json`
- GitHub 운영 OS active topic queue 렌더링본: `docs/strategy/ACTIVE_TOPIC_QUEUE.md`
- GitHub 운영 OS 발행 원장 원본: `docs/strategy/POSTING_REGISTRY.json`
- GitHub 운영 OS 발행 원장 렌더링본: `docs/strategy/POSTING_REGISTRY.md`

원고 본문, 원본 통계 파일, 관리자 화면 스크린샷, 고객 개인정보, AppSheet 원본, 비공개 리뷰/사진 원본은 공개 저장소에 커밋하지 않는다. 보안 기준은 `docs/operations/DATA_SECURITY_POLICY.md`를 따른다.
