# 문장군 블로그 운영 파이프라인

문장군 네이버 블로그 SEO 콘텐츠를 기획, 작성, 검수, 추적, 분석하기 위한 운영 OS 저장소입니다.

## 빠른 실행

```bash
npm run check
npm run validate
npm run validate:local
npm run ops:daily
npm run ops:weekly
```

`npm run validate`는 GitHub에 올리는 운영 OS 검증용입니다.
`npm run validate:local`은 로컬에 있는 `posts/` 원고까지 함께 검수할 때 사용합니다.

## GitHub 저장 범위

GitHub에는 운영 OS만 올립니다.

올리는 것:

- 운영 문서와 전략 문서
- 검증 스크립트와 테스트
- 비식별 daily report
- active topic queue
- posting registry
- scorecard와 운영 템플릿

올리지 않는 것:

- `posts/` 원고 본문
- `outputs/checks/` 원고 검수 산출물
- `outputs/publish_control/` 발행 제어 파일
- 네이버 관리자 화면 스크린샷
- AppSheet 원본, 고객 자료, 비공개 리뷰/사진 원본

원고는 로컬에서 작성하고 검수한 뒤 네이버에 발행합니다. 발행 후 URL, 제목, 상태, 운영 판단은 `docs/strategy/POSTING_REGISTRY.md`에 기록합니다.

## 구조

```text
config/              실행 설정과 키워드 목록
data/raw/            공개 가능 API 원본/요약 데이터
data/processed/      가공 데이터와 순위 이력
docs/strategy/       SEO, 콘텐츠 계획, 등록부, 실행판
docs/operations/     운영 문서
outputs/reports/     분석/추적 리포트
outputs/dashboards/  HTML 대시보드
posts/               로컬 전용 완성 원고, GitHub 커밋 금지
scripts/             실행 스크립트
scripts/lib/         공통 경로, 저장, 환경 유틸
tests/               검증 스크립트
```

상세 운영 방법은 `AGENTS.md`와 `docs/OPERATING_INDEX.md`를 먼저 확인합니다.
