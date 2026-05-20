# 🚀 문장군 블로그 SEO 자동화 파이프라인

문장군(도어/중문/현관문 시공 전문업체)의 네이버 블로그 SEO 콘텐츠 기획, 작성, 순위 추적 및 분석을 체계적으로 자동화하는 관리 시스템입니다.

---

## 🛠️ 주요 기능 및 기술 스택

* **키워드 발굴**: 네이버 검색광고 API를 이용하여 지역 타겟 및 3계층 연관 키워드를 분석 및 정렬합니다.
* **실시간 순위 추적**: Puppeteer(헤드리스 크롬)를 구동하여 시크릿 모드와 동일한 환경에서 블로그 탭의 실제 노출 순위를 수집합니다.
* **상위 10개 글 분석**: 네이버 오픈 API를 통해 키워드별 상위 10개 포스트의 제목 패턴(길이, 숫자 포함 여부 등)과 최신성 등을 분석하여 콘텐츠 승리 공식을 도출합니다.
* **통합 대시보드**: 수집된 순위 추적 데이터를 차트(Chart.js)와 표로 렌더링하여 트렌드를 모니터링할 수 있는 정적 HTML 대시보드를 생성합니다.

---

## 🔑 환경 변수 설정 (`.env`)

프로젝트 루트 디렉토리에 `.env` 파일을 생성하고 아래의 인증 정보 및 실행 옵션들을 입력해 주어야 합니다.  
*(※ `.env` 파일은 `.gitignore`에 등록되어 있어 원격 저장소에 업로드되지 않습니다.)*

```env
# 1. 네이버 블로그 및 실행 설정
NAVER_BLOG_ID=doorgeneral
# Chrome 실행 경로 (미설정 시 OS별 기본 경로 자동 탐색)
CHROME_PATH=C:\Program Files\Google\Chrome\Application\chrome.exe

# 2. 네이버 검색 API (블로그 순위 추적 및 TOP10 분석용)
NAVER_CLIENT_ID=your_naver_client_id
NAVER_CLIENT_SECRET=your_naver_client_secret

# 3. 네이버 검색광고 API (키워드 발굴용)
NAVER_AD_API_KEY=your_ad_api_key
NAVER_AD_SECRET_KEY=your_ad_secret_key
NAVER_AD_CUSTOMER_ID=your_ad_customer_id
```

---

## 🏃 스크립트 실행 방법

로컬 터미널에서 아래의 Node.js 명령어들을 실행하여 작업을 수행할 수 있습니다.

### 1. 지역 키워드 발굴 및 데이터 업데이트
대형 시드 키워드 리스트를 기준으로 검색광고 API를 조회하여 연관 키워드 데이터를 최신화합니다.
```bash
node scripts/fetch_keyword_data.js
```

### 2. 네이버 블로그 탭 순위 추적
Puppeteer를 띄워 타겟 키워드들에 대해 문장군 블로그의 노출 순위를 확인하고 결과를 저장합니다.
```bash
node scripts/track_ranking.js
```

### 3. 상위 TOP 10 글 패턴 분석
특정 키워드들의 네이버 검색 상위 10개 포스트 정보를 수집하여 승리 공식을 도출하고 `top10_analysis.md` 리포트를 작성합니다.
```bash
node scripts/analyze_top10.js
```

### 4. 순위 모니터링 대시보드 HTML 갱신
수집된 순위 이력(`tracking_history.json`)을 바탕으로 실시간 트렌드 확인이 가능한 `ranking_dashboard.html` 파일을 재생성합니다.
```bash
node scripts/generate_dashboard.js
```

---

## 📂 프로젝트 구조

```
문장군블로그/
├── scripts/
│   ├── utils/
│   │   └── env_loader.js       ← 공통 환경변수 로더 (자동 구동)
│   ├── fetch_keyword_data.js   ← 키워드 발굴
│   ├── track_ranking.js        ← 블로그 순위 추적
│   ├── analyze_top10.js        ← 상위 TOP 10 분석
│   ├── generate_dashboard.js   ← 대시보드 HTML 생성
│   └── generate_mock_history.js← 대시보드 테스트용 모의 데이터 생성
├── posts/                      ← 발행 및 작성된 포스팅 마크다운 보관 폴더
├── BRAND_CONTEXT.md            ← 문장군 브랜드 아이덴티티 및 전략
├── SEO_KEYWORD_RESEARCH.md     ← 3계층 검색 전략 키워드 데이터
├── CONTENT_PLAN.md             ← 월간 블로그 발행 기획 캘린더
├── POSTING_REGISTRY.md         ← 포스팅 발행 링크 아카이브
├── ranking_dashboard.html      ← 모니터링 웹 대시보드
└── top10_analysis.md           ← TOP 10 상위 노출 분석 결과 리포트
```
