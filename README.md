# 문장군 블로그 운영 파이프라인

문장군 네이버 블로그 SEO 콘텐츠를 기획, 작성, 추적, 분석하기 위한 프로젝트입니다.

## 빠른 실행

```bash
npm run check
npm run track
npm run analyze
npm run dashboard
```

## 구조

```text
config/              실행 설정과 키워드/시드 목록
data/raw/            API 원본 데이터
data/processed/      필터링 데이터와 순위 이력
docs/strategy/       브랜드, SEO, 콘텐츠 플랜, 등록부, 결정 로그
docs/operations/     운영 문서
outputs/reports/     분석/추적 리포트
outputs/dashboards/  HTML 대시보드
posts/               완성 블로그 원고
scripts/             실행 스크립트
scripts/lib/         공통 경로, 저장, 환경변수 유틸
tests/               검증 스크립트
```

상세 운영 방법은 [docs/operations/README.md](docs/operations/README.md)를 확인하세요.
