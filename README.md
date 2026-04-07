# Looki News TV Wall

为小米电视全屏展示设计的 Looki / Looki L1 动态资讯墙：
- 动态聚合海外/国内新闻（Google News RSS）
- 动态聚合用户评论（Reddit + Hacker News）
- 正向内容直接展示
- 负向内容附带 AI 自动改进建议
- 温暖风格、滚动 feed 流，适合办公室屏保替换

## 快速开始

```bash
npm install
npm start
```

打开：`http://localhost:3000`，电视浏览器全屏访问即可。

## 数据接口

- `GET /api/feed`
  - 返回聚合后条目、统计信息（新闻数、评论数、负向数、更新时间）

## 可扩展建议

- 接入公司内网数据源或微博/B 站评论采集
- 增加 LLM 情感分类与更细粒度改进建议
- 增加屏保模式（无人操作自动隐藏链接交互）
