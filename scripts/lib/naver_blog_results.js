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
      title: typeof link === 'string' ? '' : String(link.title || '').trim().substring(0, 80),
    });
  });

  return results;
}

function findAccountRank(results, blogId) {
  const index = results.findIndex((item) => item.blogId === blogId);
  return index === -1 ? 0 : index + 1;
}

module.exports = {
  parseBlogLink,
  collectUniquePostResults,
  findAccountRank,
};
