# 문장군 Active Topic Queue

> Generated from docs/strategy/ACTIVE_TOPIC_QUEUE.json. Edit the JSON source and run npm run render:strategy.

> 업데이트: 2026-09-01
> 목표: 완료 이력은 성과 원장에 남기고, 이 실행판에는 지금 사람이 처리해야 할 8~15개 항목만 둔다.

## 역할

- daily report는 증거 로그, Posting Registry는 중복 방지 원장, Active Topic Queue는 다음 행동을 닫는 실행판이다.
- 원고, URL, 성과 관찰은 서로 다른 상태다. 한 칸으로 합치거나 URL이 없다는 이유로 미작성으로 되돌리지 않는다.
- `observation_status`의 `monitor_3d`와 `monitor_7d`는 공개 URL이 확인된 글에만 쓴다.

## lane/action/status 계약

| 구분                 | 허용값                                                                                                                                         | 의미                            |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| lane               | protect / attack / experiment / exclude                                                                                                     | 성과 보호 / 시장 공격 / 제한 실험 / 확장 차단 |
| action_status      | internal_link / rewrite_candidate / scorecard_needed / draft_ready / publish_waiting / url_registration_pending / observe / excluded / done | 지금 해야 할 단일 행동                 |
| manuscript_status  | idea / draft_ready / written / published / not_applicable                                                                                   | 원고의 실제 진행 상태                  |
| url_status         | none / pending / registered / not_applicable                                                                                                | 공개 URL 확인 상태                  |
| observation_status | not_started / monitor_3d / monitor_7d / landed / faded / not_applicable                                                                     | 공개 후 성과 관찰 상태                 |

## 운영 규칙

- `written + pending + not_started`는 작성완료·URL등록대기다. 신규 글감에서 이미 사용한 소재로 본다.
- `published + registered + monitor_3d/monitor_7d`만 관찰 대상으로 둔다.
- attack lane은 최소 3개를 유지하고 시장 검색량을 비워두지 않는다.
- exclude lane은 세 상태 축을 모두 `not_applicable`로 두고 작성·발행 액션을 걸지 않는다.
- 완료 이력은 실행판에 쌓지 않고 등록부·성과 원장·daily에 보존한다.

## 목표 갭

| 기준일        | 조회수  | 일 2,000까지 갭 | 판단                                                        |
| ---------- | ---- | ----------- | --------------------------------------------------------- |
| 2026-08-31 | 1313 | 687         | 통합검색 비중 78.39%. 7일 평균 목표 1,400은 9월 말에 확정 일별 데이터로 별도 검증한다. |

## 현재 실행판

| id    | lane       | action_status            | manuscript_status | url_status     | observation_status | topic                             | primary_keyword | market_volume | current_signal                                                                                                                                | linked_asset                                                                             | next_action                                                              | due        | risk                                                            | updated_at |
| ----- | ---------- | ------------------------ | ----------------- | -------------- | ------------------ | --------------------------------- | --------------- | ------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | ---------- | --------------------------------------------------------------- | ---------- |
| Q-058 | experiment | observe                  | published         | registered     | monitor_7d         | 화장실 리모델링과 욕실문·문틀 결정 순서            | 화장실리모델링         | 19680         | 203번은 2026-08-28 10:00 KST 공개 발행을 확인했다. 8월 31일까지 유효 TOP20 4일·0회라 D7까지 관찰한다.                                                                   | posts/203_화장실리모델링욕실문순서.md, docs/strategy/BRIDGE_COHORT_APPROVAL_20260824.md              | D7까지 전체 TOP20 진입 여부만 기록하고 단일 관측 전에는 성과를 단정하지 않는다.                        | 2026-09-04 | 문틀만 단독 교체 가능 주장 금지. 타일·방수 공사를 문장군 서비스로 확대하지 않음                  | 2026-09-01 |
| Q-059 | experiment | observe                  | published         | registered     | monitor_3d         | 문짝 교체 뒤 기존 문짝 처리 범위               | 대형폐기물           | 25340         | 204번은 2026-08-29 10:00 KST 공개 발행을 확인했다. 8월 31일까지 유효 TOP20 3일·0회다.                                                                             | posts/204_문짝교체기존문짝무상수거.md, docs/strategy/BRIDGE_COHORT_APPROVAL_20260824.md              | D3 이후 전체 TOP20 관찰을 시작하고, 수거 범위를 다른 공사로 확장하지 않는다.                         | 2026-09-01 | 기존 문짝 100% 무상 처리는 문짝만 교체 범위에 한정. 다른 폐기물로 확대 금지                  | 2026-09-01 |
| Q-060 | experiment | observe                  | published         | registered     | monitor_3d         | 현관타일과 중문 설치 순서                    | 현관타일            | 3650          | 205번은 2026-08-30 10:00 KST 공개 발행을 확인했고, 발행일 관리자 TOP20 8위·18회가 첫 관측이다.                                                                         | posts/205_현관타일중문설치순서.md, docs/strategy/BRIDGE_COHORT_APPROVAL_20260824.md                | D3 이후 전체 TOP20 재등장 여부를 확인하며, 발행일 1회만으로 landed 판정하지 않는다.                  | 2026-09-02 | 어느 공정이 항상 먼저라고 단정하지 않음. 067번 철거 손상 질문과 분리                       | 2026-09-01 |
| Q-061 | experiment | observe                  | published         | registered     | monitor_3d         | 종합인테리어와 반셀프 견적의 관리 범위             | 인테리어견적          | 1840          | 206번은 2026-09-01 11:46 KST 공개 발행을 확인했다. 같은 날 실시간값은 확정 일별 성과와 분리한다.                                                                            | posts/206_인테리어견적반셀프관리범위.md, docs/strategy/BRIDGE_COHORT_APPROVAL_20260824.md             | 다음 확정일 이후부터 전체 TOP20 관찰을 시작하고, 동일일 실시간 성과를 확정값으로 쓰지 않는다.                 | 2026-09-04 | 보편 마진율·일률적 절감액 단정 금지. 일정·조율·책임 범위로만 비교                          | 2026-09-01 |
| Q-062 | experiment | observe                  | published         | registered     | monitor_3d         | 신혼집 문 공사 예산 배분                    | 신혼집             | 700           | 207번은 2026-08-31 15:28 KST 공개 발행을 확인했다. 8월 31일은 부분일 관측이므로 성과를 판정하지 않는다.                                                                       | posts/207_신혼집문공사예산.md, docs/strategy/BRIDGE_COHORT_APPROVAL_20260824.md                  | 다음 확정일 이후부터 전체 TOP20 관찰을 시작하고, 12개월 무이자를 총공사비 절감으로 표현하지 않는다.             | 2026-09-03 | 12개월 무이자는 현재 공식 조건 안에서만 사용. 총공사비 절감으로 표현 금지                     | 2026-09-01 |
| Q-063 | attack     | url_registration_pending | written           | pending        | not_started        | 중문교체, 30년 된 부모님 댁에서 의견이 갈린 이유     | 중문교체            | 740           | 브릿지 검사 BLOCK 없음. 부모님댁인테리어 수요는 미확인이고 서비스 키워드 중문교체는 2026-09-01 원본 기준 740회다. 승인 리뷰 125에서 가족 의견이 갈린 실제 사건을 확인했다.                                  | posts/208_중문교체부모님댁.md, outputs/reports/topic_candidates/2026-09-01_topic_scorecard.md    | 직원이 검수 완료 원고를 네이버에 게시한 뒤 실제 제목과 URL을 전달한다. URL 확인 전 성과 관찰을 시작하지 않는다.     | 2026-09-02 | 067·121·147·161과 중문교체 서비스 근접. 부모 검색량 미확인, 한 사례를 일반화하지 않음        | 2026-09-01 |
| Q-064 | attack     | url_registration_pending | written           | pending        | not_started        | 아기 있는 집 현관중문, 신발장 울타리 대신 선택한 이유   | 현관중문            | 11680         | 브릿지 검사 BLOCK 없음. 육아인테리어 수요는 미확인이고 서비스 키워드 현관중문은 2026-09-01 원본 기준 11,680회다. 승인 리뷰 126에서 실제 선택 사건을 확인했다.                                        | posts/209_아기있는집현관중문.md, outputs/reports/topic_candidates/2026-09-01_topic_scorecard.md   | 직원이 검수 완료 원고를 네이버에 게시한 뒤 실제 제목과 URL을 전달한다. URL 확인 전 성과 관찰을 시작하지 않는다.     | 2026-09-03 | 현관중문 서비스 글 다수와 근접. 육아 안전 컨설팅·효과 보장 금지, 부모 검색량 미확인               | 2026-09-01 |
| Q-065 | attack     | url_registration_pending | written           | pending        | not_started        | 현관중문 인테리어, 흰색 대신 연보라색을 끝까지 찾은 이유  | 현관중문인테리어        | 950           | 브릿지 검사 BLOCK 없음. 컬러인테리어 수요는 미확인이고 현관중문인테리어는 2026-09-01 원본 기준 950회, 서비스 키워드 현관중문은 11,680회다. 승인 리뷰 127에서 연보라색 설치 사건을 확인했다.                      | posts/210_현관중문인테리어연보라.md, outputs/reports/topic_candidates/2026-09-01_topic_scorecard.md | 직원이 검수 완료 원고를 네이버에 게시한 뒤 실제 제목과 URL을 전달한다. URL 확인 전 성과 관찰을 시작하지 않는다.     | 2026-09-04 | 034·042·126·164 디자인·색 일반론과 근접. 해당 색상 가능 범위를 모든 계약에 확대 금지        | 2026-09-01 |
| Q-066 | experiment | url_registration_pending | written           | pending        | not_started        | 썩은 화장실 문짝 한 개와 포인트 색상 선택          | 화장실문색상          | 미확인           | 제품 검사 BLOCK 없음. 문장군은 무료 방문견적 때 컬러북·카탈로그를 가져가 고객이 직접 보고 만져 색상을 선택한다는 사장님 확인이 있다.                                                               | posts/211_화장실문짝포인트색상.md, outputs/reports/topic_candidates/2026-09-01_topic_scorecard.md  | 직원이 검수 완료 원고를 네이버에 게시한 뒤 실제 제목과 URL을 전달한다. URL 확인 전 성과 관찰을 시작하지 않는다.     | 2026-09-05 | 169·175와 한 짝 교체 범위 근접, 194·203 관찰 중. 손상 원인·공정 순서 반복 금지          | 2026-09-01 |
| Q-067 | experiment | url_registration_pending | written           | pending        | not_started        | 입주박람회 중문 계약 전 확인할 현장 실측 범위        | 입주박람회           | 1460          | 브릿지 검사 BLOCK 없음. 입주박람회 1,460회이며 등록부에 같은 고객 질문이 없다. 계약과 책임 연결은 사람 검토 WARN이다.                                                                   | posts/212_입주박람회중문계약.md, outputs/reports/topic_candidates/2026-09-01_topic_scorecard.md   | 직원이 검수 완료 원고를 네이버에 게시한 뒤 실제 제목과 URL을 전달한다. URL 확인 전 성과 관찰을 시작하지 않는다.     | 2026-09-06 | 법률·취소·환불 단정 금지. 현관중문 서비스 글과 근접하므로 입주박람회 계약 전 질문으로 분리            | 2026-09-01 |
| Q-068 | experiment | url_registration_pending | written           | pending        | not_started        | 중문 설치 직후와 한 달 뒤 두 번 남긴 고객 후기      | 한달사용중문후기        | 미확인           | 제품 검사 BLOCK 없음. 승인 리뷰 124에서 같은 고객의 설치 직후 리뷰와 한 달 뒤 사용 후기를 확인했다.                                                                               | posts/213_한달사용중문후기.md, outputs/reports/topic_candidates/2026-09-01_topic_scorecard.md    | 직원이 검수 완료 원고를 네이버에 게시한 뒤 실제 제목과 URL을 전달한다. URL 확인 전 성과 관찰을 시작하지 않는다.     | 2026-09-07 | 036·038·067·078 등 중문 사용 후기와 근접. 두 시점 리뷰라는 사건 차별성 유지             | 2026-09-01 |
| Q-069 | experiment | url_registration_pending | written           | pending        | not_started        | 로봇청소기가 방마다 들어가기 시작한 구축아파트 방문교체 후기 | 방문교체            | 8580          | 브릿지 검사 BLOCK 없음. 방문교체는 2026-09-01 원본 기준 8,580회다. 구형 리뷰 패키지 020에서 전체 방문·문틀 교체와 문턱 정리 뒤 로봇청소기·아이 동선 변화를 확인했고, 로봇청소기 때문에 문을 바꾼다는 역인과는 원고에서 제거했다. | posts/214_로봇청소기방문턱.md, outputs/reports/topic_candidates/2026-09-01_topic_scorecard.md    | 직원이 검수 완료 원고를 네이버에 게시한 뒤 실제 제목과 URL을 전달한다. 구형 패키지이므로 블로그 원고 승인 뒤에만 발행한다. | 2026-09-09 | 171번과 서비스 완전 중복. 방문턱제거를 단독 서비스처럼 쓰지 않고 노후 방문 공사의 부수적 생활 변화로만 설명 | 2026-09-01 |
| Q-030 | exclude    | excluded                 | not_applicable    | not_applicable | not_applicable     | 중문 개구부·생활동선 전술 재설계 차단             | 중문설치            | 2600          | C-H2-H3-OPENING-CONFIG은 faded 8·landed 1(183번)이다. 183번의 두 번 관측은 반복 전술 확대 근거가 아니므로 보호선을 유지한다.                                                  | -                                                                                        | 같은 개구부·생활동선 전술의 범위를 넓히지 않고, 기존 faded 판정만 보존한다.                           | 2026-12-31 | 중문 전체 수요 부재가 아니라 반복 전술 실패에 대한 보호선                               | 2026-09-01 |

## 다음 운영 판단

1. 194·199·201~207번은 공개 제목·URL·발행일을 대조해 등록했다. 200번만 이번 공개 검색 재확인에서도 후보가 없어 작성완료·URL등록대기로 유지한다.
2. 8월 24~31일 확정 통계와 TOP20 160행을 전수 백필했다. 201·202번은 faded, 203~207번은 각 발행일 기준 관찰 단계로 성과를 합산하지 않는다.
3. Q-030은 반복 전술의 확대 차단으로 유지한다. 183번 landed 2회는 기존 faded 묶음의 반례로 기록하되 새 글감 확대 근거로 사용하지 않는다.
4. 브릿지 코호트 Q-056~Q-062는 공개 URL을 등록했다. 205번의 발행일 TOP20 8위·18회는 단일 관측이며, D3~D14 재등장 전에는 landed로 승격하지 않는다.
5. 200번은 로컬 원고가 있으나 발행 승인 기록이 없어 하드게이트가 차단한다. 승인 전 발행하지 않는다.
6. 208~214는 검수 완료 원고로 작성해 등록부에 작성완료·URL등록대기로 선등록했다. 리뷰 근거는 승인 패키지 범위만 사용했고, 214번은 구형 020 패키지의 사건 순서를 바로잡아 노후 방문 교체 뒤 생긴 생활 변화로 작성했다.
