# 문장군 블로그 발행 하드게이트 워크플로

> 목적: 좋은 원고를 빨리 발행하되, 제품 오류·승인 오독·등록 누락·중복 발행 사고는 CLI로 차단한다.

## 1. 기본 원칙

- `posts/` 파일은 발행 본문만 담는다.
- 원고 작성 완료와 네이버 발행 승인은 다른 상태다.
- 사용자의 "좋아", "다음", "진행"은 발행 승인으로 해석하지 않는다.
- 발행 전에는 반드시 블로그 품질 게이트를 통과해야 한다.
- 하나라도 FAIL이면 네이버 블로그에 붙여넣지 않는다.

## 2. 케이스별 잠금 파일

발행할 글마다 아래 폴더를 둘 수 있다.

```text
outputs/publish_control/NNN_키워드/
├── STATUS.md
└── APPROVAL_LOG.md
```

`STATUS.md`는 현재 발행 가능 상태를 잠그는 파일이다.  
`APPROVAL_LOG.md`는 누가 어떤 범위까지 승인했는지 남기는 감사 로그다.

초기값은 항상 차단 상태다.

```markdown
- Publish allowed: `NO`
- Post QA: `PENDING`

| Gate | Status | Notes |
| --- | --- | --- |
| Post QA | pending | run post validation first |
| Publish allowed | not_allowed | final approval required |
```

발행 직전에만 아래처럼 바꾼다.

```markdown
- Publish allowed: `YES`
- Post QA: `PASS`

| Gate | Status | Notes |
| --- | --- | --- |
| Post QA | pass | post validation passed |
| Publish allowed | pass | ready for Naver paste |
```

## 3. 승인 로그 규칙

발행 승인은 반드시 별도 항목으로 남긴다.

```markdown
## 2026-06-17 - Publish Approval

- Decision: Blog publish approved.
- Approved scope: Publish this checked post to Naver Blog.
- Not approved: Changing title, deleting CTA, or publishing a different file.
```

아래 표현은 발행 승인으로 보지 않는다.

- `review only`
- `not approved`
- `pending`
- `보류`
- `미승인`
- `좋다`, `진행`, `확인`

## 4. 발행 전 CLI

발행 직전 실행:

```powershell
npm run gate:blog -- --post "posts/085_문틀교체비용.md" --mode publish --json
```

특정 제어 폴더를 지정할 때:

```powershell
npm run gate:blog -- --post "posts/085_문틀교체비용.md" --mode publish --control-dir "outputs/publish_control/085_문틀교체비용" --json
```

결과 기준:

- `ok: true` + `decision: ALLOW` → 발행 가능
- `ok: false` 또는 `decision: BLOCK` → 발행 금지

## 5. 발행 후

발행 후 사용자가 URL을 주면:

1. `docs/strategy/POSTING_REGISTRY.md` URL과 발행일 등록
2. 최근 작성본 상태를 `발행완료`로 변경
3. 다음 데일리 통계 자료에 발행 링크 포함
4. URL 등록 후 같은 글은 `POST_ALREADY_PUBLISHED`로 재발행 차단
