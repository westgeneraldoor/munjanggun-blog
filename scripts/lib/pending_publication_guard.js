function plainText(value) {
  return String(value || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizedText(value) {
  return plainText(value)
    .normalize('NFC')
    .toLocaleLowerCase('ko-KR')
    .replace(/[\s\p{P}\p{S}]/gu, '');
}

function keywordTokens(value) {
  return plainText(value)
    .split(/[\s,·/]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2)
    .map((token) => token.replace(/[은는이가을를에의와과만부터까지로도]$/u, ''))
    .filter((token) => token.length >= 2);
}

function titleEvidenceTokens(title) {
  const ignored = new Set(['전', '때', '집', '가지', '이유', '기준', '조건']);
  return keywordTokens(title)
    .filter((token) => !ignored.has(token))
    .filter((token, index, tokens) => tokens.indexOf(token) === index);
}

function kstDateFromEpoch(value) {
  if (!Number.isFinite(Number(value))) return '';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(Number(value)));
  const fields = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${fields.year}-${fields.month}-${fields.day}`;
}

function findMatchingPublicCandidates(pending, candidates) {
  const expectedTitle = normalizedText(pending && pending.title);
  const evidenceTokens = titleEvidenceTokens(pending && pending.title);
  const queryTokens = keywordTokens(pending && pending.targetKeywords);

  return (candidates || []).flatMap((candidate) => {
    const candidateDate = kstDateFromEpoch(candidate && candidate.addDate);
    if (pending && pending.notBeforeDate && candidateDate && candidateDate < pending.notBeforeDate) return [];
    const candidateTitle = normalizedText(candidate && candidate.title);
    const candidateText = normalizedText(`${candidate && candidate.title} ${candidate && candidate.contents}`);
    if (!candidateText) return [];

    if (candidateTitle === expectedTitle) {
      return [{ ...candidate, matchedTokens: ['exact-title'] }];
    }

    const matchedTokens = evidenceTokens.filter((token) => candidateText.includes(normalizedText(token)));
    const keywordMatched = queryTokens.length === 0
      || queryTokens.some((token) => candidateText.includes(normalizedText(token)));
    const requiredMatches = Math.min(3, Math.max(2, evidenceTokens.length));

    if (!keywordMatched || matchedTokens.length < requiredMatches) return [];
    return [{ ...candidate, matchedTokens }];
  });
}

module.exports = {
  findMatchingPublicCandidates,
  keywordTokens,
  kstDateFromEpoch,
  normalizedText,
  plainText,
};
