const SERVICE_CONNECTION_TERMS = [
  '중문', '방문', '문틀', '문짝', '문선', '문턱', '도어', '몰딩',
  '문교체', '화장실문', '욕실문', '안방문', '손잡이', '경첩',
  '레일', '롤러', '실측', '현관',
];

function normalize(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[\s.,!?·/()\[\]{}:'"`~_-]/g, '');
}

function matchConfiguredTerm(value, items) {
  const target = normalize(value);
  return (items || []).find((item) => target.includes(normalize(item.term)));
}

function parentVerdict(parentKeyword, policy, scope) {
  const parent = String(parentKeyword || '').trim();
  if (!parent) {
    return { level: 'BLOCK', code: 'PARENT_REQUIRED', reason: '부모 키워드가 필요하다', blocks: [{ code: 'PARENT_REQUIRED', reason: '부모 키워드가 필요하다' }], warnings: [] };
  }

  const permanent = matchConfiguredTerm(parent, scope.excluded_permanent);
  if (permanent) {
    const block = { code: 'PARENT_PERMANENT_EXCLUSION', reason: permanent.reason, term: permanent.term };
    return { level: 'BLOCK', ...block, blocks: [block], warnings: [] };
  }

  const excluded = matchConfiguredTerm(parent, scope.excluded_product);
  if (excluded) {
    const block = { code: 'PARENT_EXCLUDED_PRODUCT', reason: excluded.reason, term: excluded.term };
    return { level: 'BLOCK', ...block, blocks: [block], warnings: [] };
  }

  const known = matchConfiguredTerm(parent, policy.known_parent_contexts);
  if (known) {
    return {
      level: 'PASS',
      code: 'PARENT_CONTEXT_KNOWN',
      reason: known.rule,
      term: known.term,
      blocks: [],
      warnings: [],
    };
  }

  const warning = {
    code: 'NEW_PARENT_KEYWORD',
    reason: '처음 보는 부모 키워드다. 허용 목록 수정 없이 진행하되 실제 문 의존성을 사람이 확인한다',
  };
  return { level: 'WARN', code: warning.code, reason: warning.reason, blocks: [], warnings: [warning] };
}

function relationVerdict(relationType, policy) {
  const relation = (policy.relation_types || {})[String(relationType || '').trim()];
  if (!relation) {
    const block = { code: 'RELATION_UNKNOWN', reason: '등록되지 않은 연결 관계다' };
    return { level: 'BLOCK', ...block, blocks: [block], warnings: [] };
  }
  const warnings = relation.human_review
    ? [{ code: 'RELATION_HUMAN_REVIEW', reason: relation.review_reason || '사람 검토가 필요한 연결 관계다' }]
    : [];
  return {
    level: warnings.length > 0 ? 'WARN' : 'PASS',
    code: warnings.length > 0 ? 'RELATION_HUMAN_REVIEW' : 'RELATION_ALLOWED',
    label: relation.label,
    blocks: [],
    warnings,
  };
}

function entryText(entry) {
  return [entry.text, entry.title, entry.topic].filter(Boolean).join(' ');
}

function bridgeDuplicateSummary(candidate, entries, scope, duplicateCheck) {
  const parent = normalize(candidate.parent_keyword);
  const question = normalize(candidate.customer_question);
  const parentMatches = (entries || [])
    .filter((entry) => parent && normalize(entryText(entry)).includes(parent))
    .map((entry) => ({ no: entry.no, title: entry.title || '', topic: entry.topic || '' }));
  const questionMatches = (entries || [])
    .filter((entry) => question && normalize(entryText(entry)).includes(question))
    .map((entry) => ({ no: entry.no, title: entry.title || '', topic: entry.topic || '' }));
  return {
    parent: parentMatches,
    service: duplicateCheck(candidate.service_keyword, entries || [], scope),
    question: questionMatches,
  };
}

function dependencyHasServiceConnection(candidate) {
  const dependency = normalize(candidate.dependency_statement);
  const service = normalize(candidate.service_keyword);
  if (!dependency) return false;
  if (service && dependency.includes(service)) return true;
  return SERVICE_CONNECTION_TERMS.some((term) => {
    const normalized = normalize(term);
    return service.includes(normalized) && dependency.includes(normalized);
  });
}

function serviceHasDoorDomain(serviceKeyword) {
  const service = normalize(serviceKeyword);
  return SERVICE_CONNECTION_TERMS.some((term) => service.includes(normalize(term)));
}

function exactVolume(parentKeyword, volumes) {
  const parent = normalize(parentKeyword);
  const hit = (volumes || []).find((item) => normalize(item.keyword) === parent);
  if (!hit) return null;
  return { keyword: hit.keyword, total: hit.total, competition: hit.competition };
}

function validateBridgeCandidate(candidate, context) {
  const blocks = [];
  const warnings = [];
  const parent = parentVerdict(candidate.parent_keyword, context.policy, context.scope);
  const relation = relationVerdict(candidate.relation_type, context.policy);
  const service = context.scopeVerdict(candidate.service_keyword, context.scope);

  blocks.push(...parent.blocks, ...relation.blocks);
  warnings.push(...parent.warnings, ...relation.warnings);

  if (!String(candidate.service_keyword || '').trim()) {
    blocks.push({ code: 'SERVICE_REQUIRED', reason: '문장군 서비스 키워드가 필요하다' });
  } else if (!serviceHasDoorDomain(candidate.service_keyword)) {
    blocks.push({ code: 'SERVICE_DOMAIN_REQUIRED', reason: '서비스 키워드는 구체적인 문·중문 취급 영역이어야 한다' });
  } else if (service.level === 'BLOCK') {
    blocks.push({ code: 'SERVICE_SCOPE_BLOCK', reason: service.reason || service.label });
  } else if (service.level === 'WARN') {
    warnings.push({ code: 'SERVICE_SCOPE_WARN', reason: service.rule || service.label });
  }

  if (!String(candidate.customer_question || '').trim()) {
    blocks.push({ code: 'QUESTION_REQUIRED', reason: '고객 질문이 필요하다' });
  }
  if (!String(candidate.dependency_statement || '').trim()) {
    blocks.push({ code: 'DEPENDENCY_REQUIRED', reason: '부모 키워드와 문 서비스의 의존 문장이 필요하다' });
  } else if (!dependencyHasServiceConnection(candidate)) {
    blocks.push({ code: 'DEPENDENCY_SERVICE_CONNECTION_REQUIRED', reason: '의존 문장에 구체적인 문·중문 서비스 연결이 보이지 않는다' });
  }

  const duplicates = bridgeDuplicateSummary(candidate, context.entries || [], context.scope, context.duplicateCheck);
  if (duplicates.question.length > 0) {
    blocks.push({
      code: 'QUESTION_ALREADY_REGISTERED',
      reason: `같은 고객 질문이 등록부에 있다: ${duplicates.question.map((item) => item.no).join(', ')}`,
    });
  }
  if (duplicates.parent.length > 0 || duplicates.service.exact.length > 0 || duplicates.service.near.length > 0) {
    warnings.push({ code: 'REGISTRY_PROXIMITY_REVIEW', reason: '부모 또는 서비스 근접 글의 소재를 직접 대조한다' });
  }

  const volume = exactVolume(candidate.parent_keyword, context.volumes || []);
  if (!volume) {
    warnings.push({ code: 'PARENT_VOLUME_MISSING', reason: '브릿지 광고 API 데이터에 부모 키워드가 없다' });
  }

  return {
    blocked: blocks.length > 0,
    blocks,
    warnings,
    parent,
    relation,
    service,
    duplicates,
    volume,
  };
}

module.exports = {
  validateBridgeCandidate,
  parentVerdict,
  relationVerdict,
  bridgeDuplicateSummary,
};
