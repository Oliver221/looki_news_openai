const ticker = document.getElementById('ticker');
const stats = document.getElementById('stats');

function fmtTime(iso) {
  const d = new Date(iso);
  return d.toLocaleString('zh-CN', { hour12: false });
}

function renderStats(s) {
  stats.innerHTML = `
    <div>总条数：<strong>${s.total}</strong></div>
    <div>新闻：<strong>${s.news}</strong> | 评论：<strong>${s.comments}</strong></div>
    <div>负向反馈：<strong>${s.negative}</strong></div>
    <div>更新时间：${fmtTime(s.updatedAt)}</div>
  `;
}

function card(item) {
  return `
    <article class="item">
      <div class="meta">
        <span class="badge ${item.sentiment}">${item.type === 'news' ? '新闻' : '评论'} · ${item.sentiment}</span>
        <div>${item.source}</div>
        <div>${fmtTime(item.publishedAt)}</div>
      </div>
      <div>
        <h3 class="title"><a href="${item.link}" target="_blank" rel="noreferrer">${item.title}</a></h3>
        <p class="content">${(item.content || '').slice(0, 220)}</p>
        ${item.analysis?.length ? `<div class="analysis">AI建议：${item.analysis.join('；')}</div>` : ''}
      </div>
    </article>
  `;
}

async function loadFeed() {
  ticker.innerHTML = '<p>正在抓取 Looki 全球动态...</p>';
  try {
    const res = await fetch('/api/feed');
    const data = await res.json();
    renderStats(data.stats);

    const html = data.items.map(card).join('');
    ticker.innerHTML = html + html;
  } catch (e) {
    ticker.innerHTML = `<p>数据抓取失败：${e.message}</p>`;
  }
}

loadFeed();
setInterval(loadFeed, 1000 * 60 * 8);
