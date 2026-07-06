const unavailableRegions = [
  '가평',
  '양평',
  '여주',
  '동두천',
  '포천',
  '연천',
  '강화도',
  '영종도',
  '당진',
  '서산',
  '충주',
  '홍성',
  '논산',
];

const staleReviewPattern = /(15,000|1만\s*5천|4,000|4천|전체\s*5만|누적\s*5만|총\s*5만)/;
const scopedNaverReviewPattern = /네이버\s*상품\s*리뷰[^\r\n]{0,20}3\.5만\s*개\s*이상|3\.5만\s*개\s*이상[^\r\n]{0,20}네이버\s*상품\s*리뷰/;
const oldMiddleDoorSchedulePattern = /중문[^\r\n]{0,30}(3\s*[~\-∼]\s*4\s*일|3일\s*[~\-∼]\s*4일|3\s*-\s*4\s*일)/;
const oldScheduleNearInstallPattern = /(결정\s*후|일정|시공|설치)[^\r\n]{0,20}(3\s*[~\-∼]\s*4\s*일|3일\s*[~\-∼]\s*4일|3\s*-\s*4\s*일)|(3\s*[~\-∼]\s*4\s*일|3일\s*[~\-∼]\s*4일|3\s*-\s*4\s*일)[^\r\n]{0,20}(시공|설치|일정)/;
const unavailableRegionPositivePattern = /(가능|됩니다|해\s*드립니다|제공|진행|설치|시공|방문|실측|견적|무료)/;
const unavailableRegionNegativePattern = /(불가|제외|어렵|안\s*됩니다|안\s*합니다|하지\s*않|못\s*합니다|불가능|금지)/;
const overclaimPatterns = [
  /무조건\s*무상/,
  /평생\s*A\/?S/i,
  /절대\s*추가금\s*없/,
];

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function hasRegionTerm(line, region) {
  const pattern = new RegExp(`(^|[^가-힣])${escapeRegex(region)}(?:시|군|구|도)?([^가-힣]|$)`);
  return pattern.test(line);
}

function findBrandClaimIssues(content) {
  const issues = [];
  const lines = content.split(/\r?\n/);

  unavailableRegions.forEach((region) => {
    const regionLine = lines.find((line) => hasRegionTerm(line, region)
      && unavailableRegionPositivePattern.test(line)
      && !unavailableRegionNegativePattern.test(line));
    if (regionLine) {
      issues.push({
        code: 'UNAVAILABLE_REGION_CLAIM',
        message: `중앙 브랜드 v4.0 기준 불가 지역을 가능 지역처럼 표현했습니다: ${region}`,
      });
    }
  });

  lines.forEach((line) => {
    if (/리뷰/.test(line) && staleReviewPattern.test(line)) {
      issues.push({
        code: 'BRAND_REVIEW_CLAIM_INVALID',
        message: '리뷰 수 claim은 중앙 EVIDENCE_REGISTER 기준으로만 써야 합니다. 15,000개/4,000개/전체 5만 표현은 금지입니다.',
      });
    }

    if (/리뷰/.test(line) && /3\.5만/.test(line) && !scopedNaverReviewPattern.test(line)) {
      issues.push({
        code: 'BRAND_REVIEW_CLAIM_INVALID',
        message: '3.5만 리뷰 claim은 반드시 "네이버 상품 리뷰 3.5만 개 이상" 범위로 한정해야 합니다.',
      });
    }

    if (oldMiddleDoorSchedulePattern.test(line) || oldScheduleNearInstallPattern.test(line)) {
      issues.push({
        code: 'BRAND_SCHEDULE_CLAIM_INVALID',
        message: '중문 일정은 중앙 EVIDENCE_REGISTER 기준 "보통 3~6일" 범위로 안내해야 합니다. 기존 3~4일 표현은 쓰지 않습니다.',
      });
    }

    overclaimPatterns.forEach((pattern) => {
      if (pattern.test(line)) {
        issues.push({
          code: 'BRAND_OVERCLAIM',
          message: '무조건 무상, 평생 A/S, 절대 추가금 없음 같은 보장성 표현은 중앙 브랜드 claim gate에서 금지됩니다.',
        });
      }
    });
  });

  return issues;
}

module.exports = {
  unavailableRegions,
  findBrandClaimIssues,
};
