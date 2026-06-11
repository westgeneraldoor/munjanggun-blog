# 문장군 블로그 운영 가이드

## 주요 명령

```bash
npm run check              # 스크립트 문법 검사
npm run track              # 네이버 블로그 순위 추적
npm run analyze            # TOP 10 상위 글 분석
npm run keywords:regional  # 지역 키워드 데이터 수집
npm run keywords:product   # 제품/서비스 키워드 데이터 수집
npm run dashboard          # 순위 대시보드 생성
```

## 주요 경로

- 전략 문서: `docs/strategy/`
- 키워드 원본 데이터: `data/raw/`
- 가공 데이터와 순위 이력: `data/processed/`
- 리포트: `outputs/reports/`
- 대시보드: `outputs/dashboards/`
- 완성 원고: `posts/`
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

1. 새 글 작성 전 `docs/strategy/BRAND_CONTEXT.md`, `docs/strategy/SEO_KEYWORD_RESEARCH.md`, `docs/strategy/CONTENT_PLAN.md`, `docs/strategy/POSTING_REGISTRY.md`, `outputs/reports/top10_analysis.md`를 확인합니다.
2. 완성 원고는 `posts/NNN_키워드.md` 규칙으로 저장합니다.
3. 발행 후 URL은 `docs/strategy/POSTING_REGISTRY.md`에 등록합니다.
4. 순위 추적 결과는 `data/processed/tracking_history.json`에 누적됩니다.
5. 생성 리포트와 대시보드는 `outputs/` 아래에 저장됩니다.
