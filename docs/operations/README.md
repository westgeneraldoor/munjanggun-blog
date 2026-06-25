# 문장군 블로그 운영 가이드

## 주요 명령

```bash
npm run check              # 스크립트 문법 검사
npm run validate           # 구조/데이터/최신성/원고 검증
npm run validate:posts     # 068번 이후 원고 품질 게이트
npm run validate:data      # config/순위이력/등록부 스키마 검증
npm run check:freshness    # 리포트와 대시보드 최신성 점검
npm run ranking:summary    # experimental 순위 변화 요약 리포트 생성
npm run ops:daily          # 일일 운영 최신성 점검
npm run track              # experimental 네이버 블로그 순위 추적
npm run analyze            # TOP 10 상위 글 분석
npm run keywords:regional  # 지역 키워드 데이터 수집
npm run keywords:product   # 제품/서비스 키워드 데이터 수집
npm run dashboard          # 순위 대시보드 생성
```

## 주요 경로

- 전략 문서: `docs/strategy/`
- 콘텐츠 작업 플레이북: `docs/operations/CONTENT_WORKFLOW_PLAYBOOK.md`
- 주제 선정 스코어카드: `docs/operations/TOPIC_SELECTION_SCORECARD.md`
- 발행 전 체크리스트: `docs/operations/PREPUBLISH_CHECKLIST.md`
- 키워드 원본 데이터: `data/raw/`
- 가공 데이터와 순위 이력: `data/processed/`
- 리포트: `outputs/reports/`
- 대시보드: `outputs/dashboards/`
- 제작 노트: 사용하지 않음. 원고는 `posts/NNN_키워드.md` 단일 발행 MD만 작성
- 자동 검수 결과: `outputs/checks/`
- 발행 본문: `posts/`
- 실행 설정: `config/`

## 환경 변수

루트의 `.env` 파일에 값을 둡니다. `.env`는 Git에 올리지 않습니다.

```env
NAVER_BLOG_ID=doorgeneral
CHROME_PATH=C:\Program Files\Google\Chrome\Application\chrome.exe
NAVER_CLIENT_ID=your_naver_client_id
NAVER_CLIENT_SECRET=your_naver_client_secret
NAVER_AD_API_KEY=your_ad_api_key
NAVER_AD_SECRET_KEY=your_ad_secret_key
NAVER_AD_CUSTOMER_ID=your_ad_customer_id
```

## 운영 규칙

1. 새 글 작성 전 `docs/strategy/BRAND_CONTEXT.md`, `docs/strategy/SEO_KEYWORD_RESEARCH.md`, `docs/operations/TOPIC_SELECTION_SCORECARD.md`, `docs/strategy/CONTENT_PLAN.md`, `docs/strategy/POSTING_REGISTRY.md`, `outputs/reports/top10_analysis.md`를 확인합니다.
2. 신규 글 작성인지 리라이팅인지 애매하면 `docs/operations/CONTENT_WORKFLOW_PLAYBOOK.md`의 보호 글/리라이팅 큐를 먼저 확인합니다.
3. 발행 본문은 `posts/NNN_키워드.md` 규칙으로 저장합니다.
4. 제작노트는 만들지 않습니다. 사진 큐와 AppSheet 후매칭 방향은 본문 문장 안에 자연스럽게 녹입니다.
5. 발행 전 `npm run validate:posts`와 `docs/operations/PREPUBLISH_CHECKLIST.md`를 확인합니다.
6. 발행 후 URL은 `docs/strategy/POSTING_REGISTRY.md`에 등록합니다.
7. 순위 추적 결과는 `data/processed/tracking_history.json`에 누적되지만, 특정 게시물 URL 기준이 구현되기 전까지 자동 의사결정 근거로 사용하지 않습니다.
8. 생성 리포트와 대시보드는 `outputs/` 아래에 저장됩니다.
9. 신규 글감은 블로그 유입어만으로 정하지 않고, 네이버 광고 API 시장 수요와 블로그 실제 반응을 함께 본 뒤 문장군 필터를 통과한 주제만 후보로 올립니다.
