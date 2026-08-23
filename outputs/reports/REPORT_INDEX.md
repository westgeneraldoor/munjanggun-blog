# 문장군 운영 보고서 색인

> 목적: daily, scorecard, ranking, 채널 진단 보고서가 흩어져 새 세션에서 묻히지 않게 하는 보고서 지도다.
> 새 장기/전략 보고서를 만들면 이 파일과 관련 `LATEST_*` 포인터를 함께 갱신한다.

## 빠른 입구

| 상황 | 먼저 볼 파일 | 판단 기준 |
| --- | --- | --- |
| 채널 상태/목표/전략 분석 | `outputs/reports/LATEST_CHANNEL_DIAGNOSIS.md` | 최신 장기 진단의 결론과 다음 읽을 파일 |
| 일일 유입경로/검색어 관제 | 최신 `outputs/reports/daily/YYYY-MM-DD_seo_watch.md` | daily report가 주 근거 |
| 오늘 글감/신규 후보 | 최신 daily + 최신 `outputs/reports/topic_candidates/YYYY-MM-DD_topic_scorecard.md` | daily는 증거, scorecard는 후보 판단 |
| 소재 선정 구조 재검증 | `docs/strategy/REWRITE_COHORT_PREREGISTRATION_20260818.md` + `outputs/reports/topic_analysis/2026-08-18_preregistered_w5_verdict.md` + `docs/strategy/TOPIC_SELECTION_REDESIGN_PLAN_V0.2.md` | 180~191은 8월 31일 전 판정 금지. W5 0/13은 원인 조사 재개 신호, W6 1/3은 연속 붕괴의 반례 |
| 순위 변화 참고 | `outputs/reports/search_rank_measurement_2026-08-18.md`, `outputs/reports/ranking_report.md`, `outputs/reports/ranking_changes_summary.md` | URL 기반 계측값. weekly/experimental 보조 |
| TOP10 구조 참고 | `outputs/reports/top10_analysis.md` | 제목/구조 참고, 단독 의사결정 금지 |

## 최신 운영 보고서

| 유형 | 최신 파일 | 기준일/기간 | 용도 |
| --- | --- | --- | --- |
| 채널 진단 | `outputs/reports/channel_diagnosis_2026-08-12.md` | 2026-07-29~2026-08-11 확정 daily, 2026-08-12 광고 API | 최근 7일 1,226회 기준선, 공개/URL/관찰 분리, 5연속 faded 가드 판단 |
| 최신 포인터 | `outputs/reports/LATEST_CHANNEL_DIAGNOSIS.md` | 2026-08-12 | 새 세션용 진입점 |
| daily | `outputs/reports/daily/2026-08-24_seo_watch.md` | 2026-08-23 확정, 2026-08-24 08:34 실시간 | 1,036조회·순방문자 795·방문 횟수 824·평균 사용 시간 2m 30s, 통합검색 80.67%. 8월 20~23일 TOP20 80행 전수, 195~198 및 REVIEW 2건 URL·발행일 등록 완료 |
| W5 사전 등록 판정 | `outputs/reports/topic_analysis/2026-08-18_preregistered_w5_verdict.md` | 2026-07-19~07-31 발행군, 2026-08-17 데이터 | 13건 모두 D3~D14 0회로 원인 조사 재개. W6 171 landed로 연속 붕괴 서술은 철회 |
| 리라이팅 코호트 사전 등록 | `docs/strategy/REWRITE_COHORT_PREREGISTRATION_20260818.md` | 180~191, 최종 판정 2026-08-31 | 중간에는 창 마감·등장 횟수만 기록. 12건 완료 전 판정 금지, 192 이후는 모수 제외 |
| topic scorecard | `outputs/reports/topic_candidates/2026-07-14_topic_scorecard.md` | 2026-07-13 통계, 2026-07-06 광고 API 기반 | 159~161번의 방문 진단·중문 철거 후 재설치 각도와 중복 회피 판단 |
| topic blind dataset | `outputs/reports/topic_analysis/2026-08-06_topic_blind_dataset.json` | 2026-08-06 성과 원장 | 글번호·날짜·순위·판정이 제거된 123건 독립 분류 입력 |
| search rank measurement | `outputs/reports/search_rank_measurement_2026-08-18.md` | 2026-08-18 14:07 KST | 61개 URL-키워드 조합의 계측 조건과 지정 소재 원본 순위 |
| ranking | `outputs/reports/ranking_report.md` | 2026-08-18 | URL 기반 순위 참고 |
| ranking summary | `outputs/reports/ranking_changes_summary.md` | 2026-07-27 -> 2026-08-18 | 순위 변화 보조 |
| TOP10 analysis | `outputs/reports/top10_analysis.md` | 2026-07-06 갱신 | 상위 글 제목/구조 참고 |

## 채널 진단 이력

| 보고서 | 기준 자료 | 핵심 결론 |
| --- | --- | --- |
| `outputs/reports/channel_diagnosis_2026-08-12.md` | 2026-07-29~08-11 daily, 08-11 TOP20, 08-12 검색광고 API, 성과 원장 | 최근 7일 평균 1,226회. 기존 허브 보호, 186~189 URL 확인, 181~185 분리 관찰이 우선 |
| `outputs/reports/channel_diagnosis_2026-07-15.md` | 인앱 브라우저 관리자 통계, 2026-06-15~07-14 일별 원본, 2026-07-15 실시간 현황 | 1,100뷰 방어선은 형성됐으나 2,000뷰의 다음 병목은 재방문·내부 링크 회수 |
| `outputs/reports/channel_diagnosis_2026-07-09.md` | 네이버 블로그 관리자 통계 전체 메뉴, 2026-07-08 일간 확정값, 2026-07-09 실시간 현황 | 조회수 중심 daily에서 UV, 평균 사용 시간, 재방문율, 시간대별 유입어, 기기/성별/연령, 지표 다운로드 기반 운영으로 확장 필요 |
| `outputs/reports/channel_diagnosis_2026-07-08.md` | 2026-06-26~2026-07-07 daily, ranking, 공감수, ACTIVE_TOPIC_QUEUE | 1,100대 방어선 형성. 2,000 돌파는 허브 복구와 내부링크 회수 구조가 필요 |

## daily 이력

| 보고서 | 기준일 | 핵심 메모 |
| --- | --- | --- |
| `outputs/reports/daily/2026-08-24_seo_watch.md` | 2026-08-23 | 조회수 1,036·순방문자 795·방문 횟수 824·평균 사용 시간 2m 30s. TOP20 20행, 198번 첫날 9위(16회), 195~198·REVIEW 2건 URL 등록. |
| `outputs/reports/daily/2026-08-23_seo_watch.md` | 2026-08-22 | 조회수 1,142·순방문자 832·방문 횟수 879·평균 사용 시간 2m 55s. TOP20 20행 백필. |
| `outputs/reports/daily/2026-08-22_seo_watch.md` | 2026-08-21 | 조회수 1,106·순방문자 886·방문 횟수 912·평균 사용 시간 2m 54s. TOP20 20행 백필. |
| `outputs/reports/daily/2026-08-21_seo_watch.md` | 2026-08-20 | 조회수 1,246·순방문자 933·방문 횟수 981·평균 사용 시간 2m 37s. TOP20 20행 백필. |
| `outputs/reports/daily/2026-08-20_seo_watch.md` | 2026-08-19 | 조회수 1,424·순방문자 1,089·방문 횟수 1,129·평균 사용 시간 2m 55s. TOP20 20행, 171번 제목 별칭 매핑 보완. |
| `outputs/reports/daily/2026-08-19_seo_watch.md` | 2026-08-18 | 조회수 1,340·순방문자 1,064·방문 횟수 1,104·평균 사용 시간 2m 44s. 관리자 백필 TOP20 20행. |
| `outputs/reports/daily/2026-08-18_seo_watch.md` | 2026-08-17 | 조회수 1,212·통합검색 81.39%. TOP20 20행, 187~191 URL·발행일을 공개 모바일 블로그에서 직접 대조해 등록. |
| `outputs/reports/daily/2026-08-17_seo_watch.md` | 2026-08-16 | 조회수 1,076·순방문자 853·방문 횟수 890·평균 사용 시간 2m 27s. 관리자 백필 TOP20 20행. |
| `outputs/reports/daily/2026-08-16_seo_watch.md` | 2026-08-15 | 조회수 1,067·순방문자 839·방문 횟수 876·평균 사용 시간 2m 17s. 관리자 백필 TOP20 20행. |
| `outputs/reports/daily/2026-08-15_seo_watch.md` | 2026-08-14 | 조회수 1,089·순방문자 876·방문 횟수 907·평균 사용 시간 2m 54s. 관리자 백필 TOP20 20행. |
| `outputs/reports/daily/2026-08-14_seo_watch.md` | 2026-08-13 | 조회수 1,174·순방문자 948·방문 횟수 985·평균 사용 시간 2m 54s. 관리자 백필 TOP20 20행. |
| `outputs/reports/daily/2026-08-13_seo_watch.md` | 2026-08-12 | 조회수 1,227·통합검색 80.52%. TOP20 20행, 186 URL과 신규 REVIEW URL은 절대 발행일 미확인으로 분리 관찰. |
| `outputs/reports/daily/2026-08-12_seo_watch.md` | 2026-08-11 | 조회수 1,315·통합검색 79.58%. TOP20 20행, 신규 REVIEW URL 1건은 원본 미매칭으로 분리 관찰. |
| `outputs/reports/daily/2026-08-11_seo_watch.md` | 2026-08-10 | 조회수 1,442·통합검색 78.14%. TOP20 20행, 181~185 URL·발행일 직접 확인 등록. 184 제목 중복은 URL·글번호로 구분. |
| `outputs/reports/daily/2026-08-10_seo_watch.md` | 2026-08-09 | 조회수 1,208·통합검색 77.98%. TOP20 20행 전수. |
| `outputs/reports/daily/2026-08-09_seo_watch.md` | 2026-08-08 | 기존 일일 관찰 보고. |
| `outputs/reports/daily/2026-08-08_seo_watch.md` | 2026-08-07 | 조회수 1,197·통합검색 77.45%. 누락 TOP20 20행 백필. |
| `outputs/reports/daily/2026-08-06_seo_watch.md` | 2026-08-05 | 조회수 1,104·통합검색 80.48%. TOP20 20행 전수, 170 공감 1위는 조회 TOP20과 분리 관찰. |
| `outputs/reports/daily/2026-08-05_seo_watch.md` | 2026-08-04 | 조회수 1,247·통합검색 78.67%. 드레스룸·몰딩·문 닫힘·중문가격·문선 비교 보호축 유지, 170은 3일 단독 관찰, 174·176은 7일 분리 관찰. |
| `outputs/reports/daily/2026-08-04_seo_watch.md` | 2026-08-03 | 조회수 1,300·통합검색 78.44%. 드레스룸·방문 닫힘·천장몰딩·걸레받이 보호축 유지, 126·171·173·174·175·176·179 URL 등록 후 분리 관찰. |
| `outputs/reports/daily/2026-08-03_seo_watch.md` | 2026-08-02 | 조회수 1,182·통합검색 77.12%. 드레스룸·걸레받이·천장몰딩·방문 닫힘 보호축 동시 잔존. |
| `outputs/reports/daily/2026-08-02_seo_watch.md` | 2026-08-01 | 조회수 1,070·통합검색 78.92%. 비용·설치·교체 의도는 기존 허브와 신규 사건형 글을 분리 관찰. |
| `outputs/reports/daily/2026-08-01_seo_watch.md` | 2026-07-31 | 조회수 1,008·통합검색 78.46%. 비용·종류·방문교체 수요는 기존 허브 연결 우선. |
| `outputs/reports/daily/2026-07-31_seo_watch.md` | 2026-07-30 | 조회수 1,035·통합검색 78.98%. 드레스룸·걸레받이·천장몰딩·방문 닫힘 보호축 유지. |
| `outputs/reports/daily/2026-07-30_seo_watch.md` | 2026-07-29 | 조회수 1,104·순방문자 873. 통합검색 79.36%. 드레스룸·걸레받이·문선·방문교체 보호축 유지, 178·리뷰릴스-004는 URL 등록 직후라 별도 관찰. |
| `outputs/reports/daily/2026-07-29_seo_watch.md` | 2026-07-28 | 조회수 1,201. 통합검색 80.12%. 드레스룸·걸레받이·화장실문·세탁실 보호축 유지, 177·리뷰릴스-100은 URL 등록 직후라 별도 관찰. |
| `outputs/reports/daily/2026-07-28_seo_watch.md` | 2026-07-27 | 조회수 1,285. 통합검색 75.81%. 드레스룸·걸레받이·세탁실의 기존 보호축 유지, 3연동 중문 방음 검색어는 성능 보장으로 확장하지 않음. |
| `outputs/reports/daily/2026-07-27_seo_watch.md` | 2026-07-26 | 조회수 1,145. 통합검색 76.72%. 드레스룸·걸레받이·세탁실 보호축 유지, 166~168·리뷰릴스-114는 URL 등록 직후라 3일 관찰로 분리. |
| `outputs/reports/daily/2026-07-26_seo_watch.md` | 2026-07-25 | 조회수 992. 통합검색 82.51%. 방문교체 검색은 비용·닫힘 원인·열림 방향을 분리 관찰. |
| `outputs/reports/daily/2026-07-25_seo_watch.md` | 2026-07-24 | 조회수 1,126. 통합검색 79.58%. 드레스룸·걸레받이·세탁실의 조건 판단형 보호축 유지. |
| `outputs/reports/daily/2026-07-24_seo_watch.md` | 2026-07-23 | 조회수 1,144. 통합검색 78.19%. 걸레받이·방문 닫힘·드레스룸의 서로 다른 문제 상황을 보존. |
| `outputs/reports/daily/2026-07-23_seo_watch.md` | 2026-07-22 | 조회수 1,121·순방문자 889·평균 사용 시간 3분 1초. 164·리뷰릴스-098 공감·댓글 1·2위, 조회 TOP20 미진입이라 검색 잔존은 미판정. |
| `outputs/reports/daily/2026-07-22_seo_watch.md` | 2026-07-21 | 조회수 1,164·순방문자 909·평균 사용 시간 3분 1초. 통합검색 80.28% 유지, 163·리뷰릴스-098 URL 등록 후 3일/7일 분리 관찰. |
| `outputs/reports/daily/2026-07-21_seo_watch.md` | 2026-07-20 | 조회수 1,202·평균 사용 시간 3분 12초. 162번 발행 당일 TOP20 18위·공감 44·댓글 3, 리뷰릴스-036은 공감 28·댓글 5지만 클립 재생 없음. |
| `outputs/reports/daily/2026-07-20_seo_watch.md` | 2026-07-19 | 조회수 1,098로 연휴 저점 회복. 161번 발행 당일 TOP20 공동 8위·공감 33·댓글 4, 리뷰릴스 클립 재생은 미확인. |
| `outputs/reports/daily/2026-07-19_seo_watch.md` | 2026-07-18 | 조회수 1,005. 160번 공감 30·댓글 2지만 조회 TOP20 미진입. |
| `outputs/reports/daily/2026-07-18_seo_watch.md` | 2026-07-17 | 조회수 943. 159번 공감 26, 리뷰릴스-034 공감 22, 두 글 모두 검색 전환은 미확인. |
| `outputs/reports/daily/2026-07-17_seo_watch.md` | 2026-07-16 | 조회수 951. 158번 공감 40, 리뷰릴스-025 공감 27, 클립 재생은 미확인. |
| `outputs/reports/daily/2026-07-16_seo_watch.md` | 2026-07-15 | 조회수 1,063. 최근 7일 성장 유지, 157번·리뷰릴스-005의 초기 공명 확인. |
| `outputs/reports/daily/2026-07-15_seo_watch.md` | 2026-07-14 | 조회수 1,130. 검색 유입은 강하고, 비용·설치·교체 허브의 내부 회수 강화가 다음 우선순위. |
| `outputs/reports/daily/2026-07-14_seo_watch.md` | 2026-07-13 | 조회수 1,201. 아파트 중문 설치 비용·세탁실 문 교체·문짝교체비용 반복, 152~154는 첫날 관찰 상태. |
| `outputs/reports/daily/2026-07-13_seo_watch.md` | 2026-07-12 | 조회수 1,086. 문교체비용·중문 설치비용·화장실문교체비용이 상위권. 150~151은 발행 첫날 관찰 상태. |
| `outputs/reports/daily/2026-07-12_seo_watch.md` | 2026-07-11 | 조회수 919. 중문 비용·종류, 문짝교체비용, 세탁실 문 교체가 TOP20 유지. |
| `outputs/reports/daily/2026-07-11_seo_watch.md` | 2026-07-10 | 조회수 1,022. 몰딩·중문 비용·문교체비용·문선 보호축 유지. |
| `outputs/reports/daily/2026-07-10_seo_watch.md` | 2026-07-09 | 조회수 1,204로 1,200대 회복. 검색 유입 75.07%, 몰딩·중문비용·방문교체·문선 상위권 유지. 142~144 초기 반응 관찰 |
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
