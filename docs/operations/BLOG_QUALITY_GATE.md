# 문장군 블로그 품질 게이트

> 이 문서는 `scripts/blog_quality_gate.js`가 막아야 하는 기준이다. 문서상 체크가 아니라 CLI 결과가 통과해야 발행한다.

## 1. CLI 계약

```powershell
node scripts/blog_quality_gate.js --post "posts/085_문틀교체비용.md" --mode publish --json
```

출력 예시:

```json
{
  "ok": false,
  "decision": "BLOCK",
  "exit_code": 1,
  "mode": "publish",
  "post": "posts/085_문틀교체비용.md",
  "summary": { "fail": 1, "warn": 0 },
  "issues": [
    {
      "severity": "fail",
      "code": "STATUS_MISSING",
      "message": "STATUS.md is required before publishing."
    }
  ]
}
```

## 2. 하드 FAIL

발행 제어:

- `STATUS_MISSING`
- `APPROVAL_LOG_MISSING`
- `PUBLISH_NOT_ALLOWED`
- `POST_QA_NOT_PASS`
- `PUBLISH_APPROVAL_MISSING`
- `POST_ALREADY_PUBLISHED`

원고 품질:

- `POST_VALIDATION_FAILED`
- `TITLE_NUMBER_MISSING`
- `PHOTO_PLACEHOLDER_IN_POST`
- `PRODUCTION_NOTE_IN_POST`
- `BODY_HASHTAG_PRESENT`
- `HASHTAG_SECTION_MISSING`
- `BRAND_HASHTAG_MISSING`
- `DOOR_FRAME_ONLY_CLAIM`
- `EXCLUDED_PRODUCT_CLAIM`
- `SERVICE_SCOPE_OVERREACH`
- 질문형 제목
- `중문` 단독 제목
- 금지 표현 포함
- 불가 지역 가능 표현
- 미완성 내부링크 문구
- 본문에 `# 제목 후보` 잔존

등록부:

- `REGISTRY_ENTRY_MISSING`
- 이미 네이버 URL이 등록된 글을 다시 publish 모드로 발행하려는 경우

입력:

- `POST_ARG_MISSING`
- `POST_MISSING`
- `MODE_INVALID`
- `INPUT_ERROR`

## 3. WARN

아래는 기존 `validate_post.js`에서 WARN으로 둘 수 있다.

- 제목 길이 권장 범위 이탈
- 내부링크 2개 미만
- 해시태그 개수 권장 범위 이탈
- 사진 플레이스홀더 잔존
- 최근 제목 패턴 반복

단, `--strict`를 붙이면 WARN도 발행 차단으로 본다.

## 4. 테스트 기준

테스트는 실제 CLI를 실행해야 한다.

```powershell
npm run test:blog-gate
```

필수 증명:

- 정상 발행대기 글 통과
- `STATUS.md` 없음 차단
- 발행 승인 로그 없음/보류 문구 차단
- 이미 발행완료 URL이 있는 글 재발행 차단
- 기존 원고 검수 실패 시 발행 차단
