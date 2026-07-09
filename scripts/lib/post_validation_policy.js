const { paths } = require('./paths');
const { readJsonFile } = require('./file_store');

const POLICY_PATH = paths.config('post_validation_policy.json');

function positiveInteger(value, fallback) {
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

function loadPostValidationPolicy(filePath = POLICY_PATH) {
  const raw = readJsonFile(filePath, {});
  const bodyChars = raw.field_story_body_chars_no_spaces || {};
  const titleLength = raw.title_length || {};
  const hashtagCount = raw.hashtag_count || {};
  const patternQuota = raw.pattern_quota || {};

  return {
    defaultFromNumber: positiveInteger(raw.default_from_number, 68),
    fieldStoryLengthFromNumber: positiveInteger(raw.field_story_length_from_number, 98),
    fieldStoryRequiredSectionFromNumber: positiveInteger(raw.field_story_required_section_from_number, 101),
    fieldStoryRequiredHeading: String(raw.field_story_required_heading || '## 실제 시공 현장에서는 조금 다릅니다'),
    operationMemoHeading: String(raw.operation_memo_heading || '## 운영 메모'),
    fieldStoryMinCharsNoSpaces: positiveInteger(bodyChars.min, 1500),
    fieldStoryMaxCharsNoSpaces: positiveInteger(bodyChars.max, 2500),
    titleMinLength: positiveInteger(titleLength.min, 24),
    titleMaxLength: positiveInteger(titleLength.max, 40),
    hashtagMinCount: positiveInteger(hashtagCount.min, 5),
    hashtagMaxCount: positiveInteger(hashtagCount.max, 10),
    internalLinksMin: positiveInteger(raw.internal_links_min, 2),
    recentPatternCount: positiveInteger(patternQuota.recent_count, 5),
    maxSamePattern: positiveInteger(patternQuota.max_same_pattern, 3),
  };
}

module.exports = {
  POLICY_PATH,
  loadPostValidationPolicy,
};
