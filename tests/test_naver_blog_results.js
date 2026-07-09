const assert = require('assert');
const {
  parseBlogLink,
  collectUniquePostResults,
  findAccountRank,
} = require('../scripts/lib/naver_blog_results');

assert.deepStrictEqual(
  parseBlogLink('https://blog.naver.com/doorgeneral/224278984631'),
  {
    blogId: 'doorgeneral',
    postId: '224278984631',
    href: 'https://blog.naver.com/doorgeneral/224278984631',
  },
);

assert.deepStrictEqual(
  parseBlogLink('https://blog.naver.com/PostView.naver?blogId=doorgeneral&logNo=224278984631'),
  {
    blogId: 'doorgeneral',
    postId: '224278984631',
    href: 'https://blog.naver.com/PostView.naver?blogId=doorgeneral&logNo=224278984631',
  },
);

const results = collectUniquePostResults([
  { href: 'https://blog.naver.com/doorgeneral', title: 'profile link must not rank' },
  { href: 'https://blog.naver.com/otherblog/111', title: 'other post' },
  { href: 'https://blog.naver.com/doorgeneral/222', title: 'target post' },
  { href: 'https://blog.naver.com/doorgeneral/222?duplicate=1', title: 'duplicate target' },
  { href: 'https://blog.naver.com/PostView.naver?blogId=doorgeneral&logNo=333', title: 'next post' },
]);

assert.deepStrictEqual(
  results.map((item) => `${item.blogId}|${item.postId}`),
  ['otherblog|111', 'doorgeneral|222', 'doorgeneral|333'],
);
assert.strictEqual(findAccountRank(results, 'doorgeneral'), 2);

console.log('naver blog result parsing tests passed');
