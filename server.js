const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const KEYWORDS = ['looki', 'looki l1', 'looki.ai', 'Looki', 'Looki L1'];

function decodeHtml(str = '') {
  return str
    .replace(/<!\[CDATA\[|\]\]>/g, '')
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"');
}

function parseRssItems(xml = '') {
  const matches = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)];
  return matches.map((m) => {
    const item = m[1];
    const pick = (tag) => {
      const reg = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`);
      return decodeHtml((item.match(reg) || [])[1] || '');
    };
    return {
      title: pick('title'),
      link: pick('link'),
      contentSnippet: pick('description'),
      pubDate: pick('pubDate') || new Date().toISOString()
    };
  });
}

function scoreSentiment(text = '') {
  const lower = text.toLowerCase();
  const positiveWords = ['good', 'great', 'love', 'like', 'excellent', 'amazing', '清晰', '喜欢', '不错', '优秀'];
  const negativeWords = ['bad', 'bug', 'issue', 'problem', 'slow', 'hate', '差', '卡顿', '问题', '崩溃', '失望', '难用'];
  let score = 0;
  positiveWords.forEach((w) => lower.includes(w) && (score += 1));
  negativeWords.forEach((w) => lower.includes(w) && (score -= 1));
  if (score > 0) return 'positive';
  if (score < 0) return 'negative';
  return 'neutral';
}

function buildImprovementAdvice(text = '') {
  const lower = text.toLowerCase();
  const advice = [];
  if (lower.includes('slow') || lower.includes('卡')) advice.push('优化加载链路与缓存策略，优先提升首屏和切换响应速度。');
  if (lower.includes('bug') || lower.includes('error') || lower.includes('崩溃')) advice.push('强化异常监控和灰度发布，针对高频故障建立快速修复闭环。');
  if (lower.includes('贵') || lower.includes('price')) advice.push('补充分层套餐与优惠方案，降低首次决策门槛。');
  if (lower.includes('难用') || lower.includes('复杂')) advice.push('聚焦关键路径做交互减负，采用引导式流程。');
  if (!advice.length) advice.push('建议按负面主题聚类，先修复影响面最大的 Top 问题。');
  return advice;
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'looki-tv-wall/1.0' }
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return response.text();
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'looki-tv-wall/1.0' }
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return response.json();
}

async function fetchGoogleNews(query, locale = 'en-US') {
  const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=${locale}&gl=US&ceid=US:en`;
  const xml = await fetchText(rssUrl);
  return parseRssItems(xml).slice(0, 8).map((item) => ({
    id: `news-${Buffer.from(item.link || item.title).toString('base64').slice(0, 16)}`,
    type: 'news',
    source: 'Google News',
    title: item.title || 'Untitled',
    content: item.contentSnippet || item.title || '',
    link: item.link,
    publishedAt: item.pubDate,
    sentiment: 'positive',
    analysis: []
  }));
}

async function fetchRedditComments(query) {
  const data = await fetchJson(`https://www.reddit.com/search.json?q=${encodeURIComponent(query)}&sort=new&limit=10`);
  const posts = data?.data?.children || [];
  return posts.map(({ data: p = {} }) => {
    const content = `${p.title || ''} ${p.selftext || ''}`.trim();
    const sentiment = scoreSentiment(content);
    return {
      id: `reddit-${p.id}`,
      type: 'comment',
      source: `Reddit r/${p.subreddit || 'unknown'}`,
      title: p.title || 'Reddit post',
      content: p.selftext || p.title || '',
      link: p.permalink ? `https://www.reddit.com${p.permalink}` : 'https://www.reddit.com',
      publishedAt: p.created_utc ? new Date(p.created_utc * 1000).toISOString() : new Date().toISOString(),
      sentiment,
      analysis: sentiment === 'negative' ? buildImprovementAdvice(content) : []
    };
  });
}

async function fetchHnComments(query) {
  const data = await fetchJson(`https://hn.algolia.com/api/v1/search_by_date?query=${encodeURIComponent(query)}&tags=comment&hitsPerPage=12`);
  return (data?.hits || []).map((hit) => {
    const text = decodeHtml(hit.comment_text || '');
    const sentiment = scoreSentiment(text);
    return {
      id: `hn-${hit.objectID}`,
      type: 'comment',
      source: 'Hacker News',
      title: hit.story_title || 'HN Comment',
      content: text,
      link: hit.story_url || `https://news.ycombinator.com/item?id=${hit.story_id}`,
      publishedAt: hit.created_at || new Date().toISOString(),
      sentiment,
      analysis: sentiment === 'negative' ? buildImprovementAdvice(text) : []
    };
  });
}


function getFallbackItems() {
  const now = new Date().toISOString();
  return [
    {
      id: 'mock-1',
      type: 'news',
      source: 'Demo Source',
      title: 'Looki L1 在办公显示场景中获得积极反馈',
      content: '多地办公室测试显示，信息流模式提升了团队对产品动态的感知效率。',
      link: 'https://looki.ai',
      publishedAt: now,
      sentiment: 'positive',
      analysis: []
    },
    {
      id: 'mock-2',
      type: 'comment',
      source: 'Demo Community',
      title: '用户反馈：内容刷新偶尔延迟',
      content: '部分用户提到在网络较差时更新速度偏慢。',
      link: 'https://looki.ai',
      publishedAt: now,
      sentiment: 'negative',
      analysis: ['优化加载链路与缓存策略，优先提升首屏和切换响应速度。']
    }
  ];
}

async function getFeed() {
  const newsQueries = ['Looki', 'Looki L1', 'looki.ai', 'Looki 小米'];
  const newsResults = (await Promise.all(newsQueries.map((q) => fetchGoogleNews(q).catch(() => [])))).flat();
  const commentResults = (
    await Promise.all(
      KEYWORDS.flatMap((q) => [fetchRedditComments(q).catch(() => []), fetchHnComments(q).catch(() => [])])
    )
  ).flat();

  const dedupe = new Map();
  [...newsResults, ...commentResults].forEach((item) => {
    const key = `${item.title}|${item.link}`;
    if (!dedupe.has(key)) dedupe.set(key, item);
  });

  let items = Array.from(dedupe.values())
    .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt))
    .slice(0, 120);

  if (items.length === 0) items = getFallbackItems();

  return {
    items,
    stats: {
      total: items.length,
      news: items.filter((i) => i.type === 'news').length,
      comments: items.filter((i) => i.type === 'comment').length,
      negative: items.filter((i) => i.sentiment === 'negative').length,
      updatedAt: new Date().toISOString()
    }
  };
}

function serveStatic(reqPath, res) {
  const safePath = reqPath === '/' ? '/index.html' : reqPath;
  const filePath = path.join(PUBLIC_DIR, safePath);
  if (!filePath.startsWith(PUBLIC_DIR)) return false;

  if (!fs.existsSync(filePath)) return false;
  const ext = path.extname(filePath);
  const mime = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8'
  }[ext] || 'text/plain; charset=utf-8';

  res.writeHead(200, { 'Content-Type': mime });
  res.end(fs.readFileSync(filePath));
  return true;
}

const server = http.createServer(async (req, res) => {
  const urlObj = new URL(req.url, `http://${req.headers.host}`);

  if (urlObj.pathname === '/api/feed') {
    try {
      const data = await getFeed();
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(data));
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: 'Failed to fetch feed', details: error.message }));
    }
    return;
  }

  if (!serveStatic(urlObj.pathname, res)) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not Found');
  }
});

server.listen(PORT, () => {
  console.log(`Looki News Wall running at http://localhost:${PORT}`);
});
