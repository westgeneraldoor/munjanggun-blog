function decodeHtmlEntities(value) {
  return String(value || '')
    .replace(/&amp;/g, '&')
    .replace(/&#38;/g, '&');
}

function urlFromHref(href) {
  try {
    return new URL(decodeHtmlEntities(href), 'https://search.naver.com');
  } catch (err) {
    return null;
  }
}

function parseBlogLink(href) {
  const text = decodeHtmlEntities(href);
  if (!/blog\.naver\.com/i.test(text)) return null;

  const url = urlFromHref(text);
  if (!url || !/blog\.naver\.com$/i.test(url.hostname)) return null;

  const pathname = decodeURIComponent(url.pathname || '');
  const directPostMatch = pathname.match(/^\/([a-zA-Z0-9_]+)\/(\d+)(?:\/)?$/);
  const queryBlogId = url.searchParams.get('blogId') || url.searchParams.get('blogid') || '';
  const queryPostId = url.searchParams.get('logNo') || url.searchParams.get('logno') || '';
  const homeMatch = pathname.match(/^\/([a-zA-Z0-9_]+)(?:\/)?$/);

  const blogId = (directPostMatch && directPostMatch[1])
    || queryBlogId
    || (homeMatch && homeMatch[1])
    || '';
  const postId = (directPostMatch && directPostMatch[2]) || queryPostId || '';

  if (!blogId || ['PostView', 'PostList', 'NBlogTop', 'prologue'].includes(blogId)) return null;
  if (blogId.length < 3) return null;

  return {
    blogId,
    postId,
    href: text,
  };
}

function collectUniquePostResults(links) {
  const results = [];
  const seen = new Set();

  links.forEach((link) => {
    const href = typeof link === 'string' ? link : link.href;
    const parsed = parseBlogLink(href);
    if (!parsed || !parsed.postId) return;

    const key = `${parsed.blogId}|${parsed.postId}`;
    if (seen.has(key)) return;
    seen.add(key);

    results.push({
      blogId: parsed.blogId,
      postId: parsed.postId,
      href: parsed.href,
      title: typeof link === 'string'
        ? ''
        : String(link.title || '').replace(/새 창 열림\s*$/, '').trim().substring(0, 80),
    });
  });

  return results;
}

function findAccountRank(results, blogId) {
  const index = results.findIndex((item) => item.blogId === blogId);
  return index === -1 ? 0 : index + 1;
}

function collectAccountMatches(results, blogId, postNoByPostId = new Map()) {
  return results.flatMap((item, index) => {
    if (item.blogId !== blogId) return [];
    return [{
      rank: index + 1,
      url: `https://blog.naver.com/${item.blogId}/${item.postId}`,
      logNo: item.postId,
      postNo: postNoByPostId.get(item.postId) || '',
      title: item.title || '',
    }];
  });
}

function groupTargetsByKeyword(targets) {
  const groups = new Map();
  targets.forEach((target) => {
    const group = groups.get(target.keyword) || [];
    group.push(target);
    groups.set(target.keyword, group);
  });
  return [...groups].map(([keyword, groupedTargets]) => ({ keyword, targets: groupedTargets }));
}

function evaluateTargetRanking(searchResults, target, blogId) {
  const accountRank = findAccountRank(searchResults, blogId);
  const targetIndex = target.postId
    ? searchResults.findIndex((item) => item.blogId === blogId && item.postId === target.postId)
    : -1;

  if (targetIndex >= 0) {
    const item = searchResults[targetIndex];
    return {
      rank: targetIndex + 1,
      accountRank,
      title: item.title,
      matchedTitle: item.title,
      matchedUrl: item.href,
      matchType: 'url',
      totalFound: searchResults.length,
      note: '',
    };
  }

  return {
    rank: 0,
    accountRank,
    title: '',
    matchedTitle: '',
    matchedUrl: '',
    matchType: target.postId ? 'url_not_found' : 'account_fallback',
    totalFound: searchResults.length,
    note: target.postId
      ? `target URL not found in TOP ${searchResults.length}`
      : `TOP ${searchResults.length} account fallback`,
  };
}

module.exports = {
  parseBlogLink,
  collectUniquePostResults,
  findAccountRank,
  collectAccountMatches,
  groupTargetsByKeyword,
  evaluateTargetRanking,
};
