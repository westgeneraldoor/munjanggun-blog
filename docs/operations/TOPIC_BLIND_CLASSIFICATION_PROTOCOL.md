# 소재 유형 블라인드 분류 프로토콜

> 목적: 성패를 본 뒤 소재 이름을 붙이는 순환논리를 막는다.
> 적용 대상: `outputs/reports/topic_analysis/*_topic_blind_dataset.json`
> 금지 대상: verdict, 발행일, 글번호, TOP20 순위, 기존 landed/faded 목록을 본 분류자

## 1. 분류 전 자격 확인

분류자는 시작 전에 아래를 모두 만족해야 한다.

- 이 프로젝트의 `post_performance.json`을 읽지 않았다.
- landed/faded 글번호·제목 목록을 읽지 않았다.
- `docs/strategy/archive/TOPIC_SELECTION_REDESIGN_PLAN_V0.1_2026-08-05.md`의 성공/실패 예시를 읽지 않았다.
- 다른 분류자의 결과 파일을 읽지 않았다.
- 제공된 블라인드 데이터 외의 파일을 검색하지 않는다.

하나라도 만족하지 못하면 분류하지 말고 `contaminated: true`로 종료한다.

## 2. 분류 정의

### 입력 보조 필드

`has_summary`는 `topic_summary` 또는 `target_keywords` 중 하나라도 있으면 `true`, 둘 다 비어 제목만 있으면 `false`다. 분류 라벨이 아니며, `false`인 항목은 제공 정보가 적으므로 필요한 경우 `confidence: low`를 사용한다. `[날짜 마스킹]`은 입력에서 제거된 날짜, `[다른 글]`은 입력에서 제거된 다른 게시글 번호·파일명의 대체 표기다. 두 표기를 소재 특징이나 발행 순서로 해석하지 않는다.

생성기는 날짜뿐 아니라 `TOP20 진입`, `보호 자산`, `순위 이탈 보강`, 큐 ID, 작성 템플릿, `발행본·복구용`처럼 결과·운영 방식을 암시하는 문장을 제거한다. 등록부의 실제 글번호가 `번` 또는 내부링크 번호열 문맥에 등장하거나 `NNN_이름.md` 형태의 파일명이 나오면 `[다른 글]`로 바꾼다. 정제 뒤 이런 단서나 깨진 마스킹 토큰이 남으면 출력 파일을 쓰지 않고 실패해야 한다.

### intent_type

| 값 | 정의 |
| --- | --- |
| `cost` | 가격, 견적, 추가금, 예산, 비용 범위가 중심 |
| `symptom_repair` | 안 닫힘, 썩음, 처짐, 소리 등 증상 진단·수리가 중심 |
| `comparison` | 제품·구조·방법 중 무엇을 고를지 비교가 중심 |
| `installation_constraint` | 폭, 가벽, 스위치, 신발장, 공정 순서 등 설치 조건이 중심 |
| `design_case` | 색상, 유리, 분위기, 사례·후기가 중심 |
| `brand_service` | 업체, 브랜드, A/S, 상담·시공 주체가 중심 |
| `other` | 위 어느 하나로도 정하기 어려움 |

### demand_breadth

| 값 | 정의 |
| --- | --- |
| `broad` | 제품·서비스 대표 검색 의도를 정면으로 다룸 |
| `mid` | 대표 검색 의도 안의 흔한 고객 문제나 선택 기준 |
| `narrow` | 특정 부품·모서리·계절·현장 예외처럼 조건이 매우 좁음 |

검색량 숫자를 추정하지 않는다. 제목과 소재 범위의 폭만 분류한다.

### problem_explicitness

| 값 | 정의 |
| --- | --- |
| `explicit` | 고객의 손실·불편·불안·선택 갈등이 제목이나 요약에 직접 드러남 |
| `implicit` | 문제는 있으나 설명을 읽어야 드러남 |
| `none` | 제품·사례·정보 소개가 중심이고 고객 문제가 드러나지 않음 |

### service_alignment

| 값 | 정의 |
| --- | --- |
| `direct` | 문·중문 교체·설치·수리 선택과 직접 연결 |
| `adjacent` | 인테리어·마감·생활 문제로 연결되지만 서비스 연결이 간접적 |
| `unclear` | 제공 정보만으로 판단 불가 |

### confidence

| 값 | 정의 |
| --- | --- |
| `high` | 제목과 요약이 같은 방향이고 경계가 명확함 |
| `medium` | 가장 가까운 값은 있으나 다른 값도 가능함 |
| `low` | 정보 부족 또는 두 범주가 비슷함 |

## 3. 새 분류자에게 전달할 메타 프롬프트

아래 프롬프트를 새 세션마다 동일하게 사용한다. 분류자 A와 B는 서로의 결과를 보지 않는다.

```text
역할
당신은 문장군 블로그의 소재 특성을 분류하는 독립 코더입니다. 성과 예측이나 전략 제안이 아니라, 제공된 텍스트에 보이는 특성만 일관되게 라벨링합니다.

오염 확인
작업 전에 다음을 답하세요: 이 프로젝트의 landed/faded 결과, post_performance.json, 과거 성공·실패 글 목록, 다른 분류자의 결과를 본 적이 있습니까?
하나라도 예이면 파일을 분류하지 말고 contaminated=true와 본 항목만 출력하세요.

입력
오직 지정된 topic_blind_dataset.json만 읽으세요. 다른 프로젝트 파일, Git 이력, daily report, 등록부, 검색 결과를 열지 마세요.

분류 규칙
TOPIC_BLIND_CLASSIFICATION_PROTOCOL.md의 intent_type, demand_breadth, problem_explicitness, service_alignment, confidence 정의를 그대로 사용하세요. 성과가 좋을지 나쁠지 추측하지 마세요. 새 축/파생 축도 판정하지 마세요.

독립성 제약
- blind_id를 변경하지 마세요.
- 모든 blind_id를 정확히 한 번 분류하세요.
- 제공되지 않은 날짜, 검색량, 글번호, 발행순서를 추정하지 마세요.
- 다른 파일이나 인터넷을 검색하지 마세요.
- 애매하면 confidence=low로 두고 짧은 reason을 쓰세요.

출력
JSON 한 파일만 만드세요.
{
  "schema_version": 1,
  "classifier_id": "사용자에게 받은 ID",
  "contaminated": false,
  "outcome_data_seen": false,
  "records": [
    {
      "blind_id": "T-...",
      "intent_type": "cost|symptom_repair|comparison|installation_constraint|design_case|brand_service|other",
      "demand_breadth": "broad|mid|narrow",
      "problem_explicitness": "explicit|implicit|none",
      "service_alignment": "direct|adjacent|unclear",
      "confidence": "high|medium|low",
      "reason": "입력 텍스트에 근거한 한 문장"
    }
  ]
}

자체 검증
저장 전 입력 ID 수와 출력 ID 수, 중복 ID, 누락 ID, 허용 값 밖 라벨을 검사하고 모두 0인지 확인하세요.
```

## 4. 결과 파일 이름

```text
outputs/checks/topic_blind_labels_classifier_a.json
outputs/checks/topic_blind_labels_classifier_b.json
```

`outputs/checks/`는 로컬 검수 영역이다. 분류 결과를 검토하기 전까지 두 분류자에게 서로의 파일 경로를 알려주지 않는다.

## 5. 합의와 해제 순서

1. A와 B 결과의 형식·누락·중복을 검사한다.
2. outcome을 열기 전에 필드별 일치율과 Cohen's kappa를 계산한다.
3. 불일치는 제3의 깨끗한 분류자에게 해당 blind record만 전달한다.
4. 합의 라벨 파일을 고정하고 해시를 기록한다.
5. 그 뒤에만 blind_id를 성과 원장과 결합한다.
6. 전체 기간이 아니라 같은 발행 구간 안에서 landed/faded를 비교한다.

현재 Codex와 Claude는 5단계 이후의 계산·검토는 할 수 있지만 1~4단계의 분류자나 분류 중재자가 될 수 없다.
