# 문장군 블로그 운영 파이프라인

문장군 네이버 블로그 SEO 콘텐츠를 기획, 작성, 추적, 분석하기 위한 프로젝트입니다.

## 빠른 실행

```bash
npm run check
npm run validate
npm run validate:posts
npm run track
npm run analyze
npm run dashboard
npm run ranking:summary
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
outputs/checks/      원고 자동 검수 결과
outputs/publish_control/  발행 승인/해시/근거 제어 파일
posts/               완성 블로그 원고
scripts/             실행 스크립트
scripts/lib/         공통 경로, 저장, 환경변수 유틸
tests/               검증 스크립트
```

> 문장군 블로그는 제작노트 파일을 만들지 않습니다. 원고는 `posts/NNN_키워드.md` 단일 발행 MD만 사용하고, 사진 매칭 방향과 AppSheet 현장 치환 가능성은 본문 문장 안에 자연스럽게 녹입니다.

상세 운영 방법은 [docs/operations/README.md](docs/operations/README.md)를 확인하세요.
새 세션에서 콘텐츠 작성이나 리라이팅을 이어갈 때는 [docs/operations/CONTENT_WORKFLOW_PLAYBOOK.md](docs/operations/CONTENT_WORKFLOW_PLAYBOOK.md)를 먼저 확인하세요.
네이버 발행 전에는 [docs/operations/PREPUBLISH_CHECKLIST.md](docs/operations/PREPUBLISH_CHECKLIST.md)와 `npm run validate:posts`를 확인하세요.

[[AGENTS]]
