# 문장군 운영 보고서 색인

> 목적: daily, scorecard, ranking, 채널 진단 보고서가 흩어져 새 세션에서 묻히지 않게 하는 보고서 지도다.
> 새 장기/전략 보고서를 만들면 이 파일과 관련 `LATEST_*` 포인터를 함께 갱신한다.

## 빠른 입구

| 상황 | 먼저 볼 파일 | 판단 기준 |
| --- | --- | --- |
| 채널 상태/목표/전략 분석 | `outputs/reports/LATEST_CHANNEL_DIAGNOSIS.md` | 최신 장기 진단의 결론과 다음 읽을 파일 |
| 일일 유입경로/검색어 관제 | 최신 `outputs/reports/daily/YYYY-MM-DD_seo_watch.md` | daily report가 주 근거 |
| 오늘 글감/신규 후보 | 최신 daily + 최신 `outputs/reports/topic_candidates/YYYY-MM-DD_topic_scorecard.md` | daily는 증거, scorecard는 후보 판단 |
| 순위 변화 참고 | `outputs/reports/ranking_report.md`, `outputs/reports/ranking_changes_summary.md` | weekly/experimental 보조 |
| TOP10 구조 참고 | `outputs/reports/top10_analysis.md` | 제목/구조 참고, 단독 의사결정 금지 |

## 최신 운영 보고서

| 유형 | 최신 파일 | 기준일/기간 | 용도 |
| --- | --- | --- | --- |
| 채널 진단 | `outputs/reports/channel_diagnosis_2026-07-09.md` | 2026-07-08 일간 확정값, 2026-07-09 실시간 일간 현황, 주간/월간 관리자 통계 | 관리자 통계 전체 메뉴 기반 운영 지표 확장 |
| 최신 포인터 | `outputs/reports/LATEST_CHANNEL_DIAGNOSIS.md` | 2026-07-09 | 새 세션용 진입점 |
| daily | `outputs/reports/daily/2026-07-09_seo_watch.md` | 2026-07-08 | L2 표준 daily. 방문 분석, 유입경로, 검색어, TOP20, 공감/댓글 보조 신호 |
| topic scorecard | `outputs/reports/topic_candidates/2026-07-08_topic_scorecard.md` | 2026-07-07 자료 기반 | 신규 후보 4개 판단 |
| ranking | `outputs/reports/ranking_report.md` | 2026-07-07 | URL 기반 순위 참고 |
| ranking summary | `outputs/reports/ranking_changes_summary.md` | 2026-07-06 -> 2026-07-07 | 순위 변화 보조 |
| TOP10 analysis | `outputs/reports/top10_analysis.md` | 2026-07-06 갱신 | 상위 글 제목/구조 참고 |

## 채널 진단 이력

| 보고서 | 기준 자료 | 핵심 결론 |
| --- | --- | --- |
| `outputs/reports/channel_diagnosis_2026-07-09.md` | 네이버 블로그 관리자 통계 전체 메뉴, 2026-07-08 일간 확정값, 2026-07-09 실시간 현황 | 조회수 중심 daily에서 UV, 평균 사용 시간, 재방문율, 시간대별 유입어, 기기/성별/연령, 지표 다운로드 기반 운영으로 확장 필요 |
| `outputs/reports/channel_diagnosis_2026-07-08.md` | 2026-06-26~2026-07-07 daily, ranking, 공감수, ACTIVE_TOPIC_QUEUE | 1,100대 방어선 형성. 2,000 돌파는 허브 복구와 내부링크 회수 구조가 필요 |

## daily 이력

| 보고서 | 기준일 | 핵심 메모 |
| --- | --- | --- |
| `outputs/reports/daily/2026-07-09_seo_watch.md` | 2026-07-08 | 조회수 1,104. 공감 146으로 신규 글 반응 강함. 유리/걸레받이/드레스룸 3일 잔존 관찰 |
| `outputs/reports/daily/2026-07-07_seo_watch.md` | 2026-07-07 | 조회수 1,142. 공감/댓글 강함. 136~138 공감 반응 확인 |
| `outputs/reports/daily/2026-07-06_seo_watch.md` | 2026-07-06 | 조회수 1,163. PC 통합검색 상승. 133~135 당일 관찰권 |
| `outputs/reports/daily/2026-07-05_seo_watch.md` | 2026-07-05 | 조회수 1,054. 비용/방문교체 축 유지 |

## 갱신 규칙

- 새 `channel_diagnosis_YYYY-MM-DD.md`를 만들면 `LATEST_CHANNEL_DIAGNOSIS.md`의 최신 보고서, 결론, 다음 재진단 권장을 갱신한다.
- 새 daily report를 만들면 이 파일의 `최신 운영 보고서`와 `daily 이력` 상단을 갱신한다.
- 새 topic scorecard를 만들면 이 파일의 `최신 운영 보고서`를 갱신한다.
- 원본 통계 이미지, XLSX, AppSheet 원본, 고객 원본 자료는 이 색인에 링크하지 않는다.
- ranking은 보조 자료로만 표기한다.
