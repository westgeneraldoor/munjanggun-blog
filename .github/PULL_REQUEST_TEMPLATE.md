# 문장군 블로그 변경 체크리스트

## 변경 유형

- [ ] URL 등록
- [ ] 운영 문서
- [ ] 자동화/스크립트
- [ ] 전략/리포트/scorecard
- [ ] 데이터/키워드 산출물

## 공개 저장 범위

- [ ] `posts/` 원고 본문을 커밋하지 않았다.
- [ ] `outputs/checks/` 원고 검수 산출물을 커밋하지 않았다.
- [ ] `outputs/publish_control/` 발행 제어 파일을 커밋하지 않았다.
- [ ] 네이버 원본 통계, 관리자 화면 스크린샷, AppSheet 원본, 고객 자료를 커밋하지 않았다.
- [ ] 제작노트/사진 큐/내부 메모 파일을 새로 만들지 않았다.
- [ ] 공개 리포트에는 연락처, 주소, 고객명, 원본 상담 내용이 남아 있지 않다.

## 검증

- [ ] `npm run validate`
- [ ] 원고를 로컬에서 발행하려는 경우에만 `npm run validate:posts`와 `npm run gate:blog -- --post "posts/NNN_키워드.md" --mode publish --json`
- [ ] 네트워크 산출물을 갱신한 경우 `npm run track`, `npm run analyze`, `npm run dashboard` 결과가 experimental/보조 지표임을 확인
