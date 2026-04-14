import { initMissionTables, createThread, createReply, createProposal, addEvent } from "../src/models/mission.model";

initMissionTables();

// 创建10个虚构任务数据
const tasks = [
  {
    title: "调研竞品市场价格策略",
    intent: "research",
    budget: 1500,
    body: "需要调研主流竞品的定价策略，包括月度订阅、年度套餐和按需付费三种模式的具体价格区间。",
    constraints: JSON.stringify({ deadline: "2026-04-20", format: "表格+图表" }),
  },
  {
    title: "优化用户登录流程",
    intent: "feature",
    budget: 3000,
    body: "当前登录流程存在3个不必要的步骤，需要简化为单页登录，并增加第三方登录支持。",
    constraints: JSON.stringify({ deadline: "2026-04-25", tech: "OAuth2.0" }),
  },
  {
    title: "修复支付回调延迟问题",
    intent: "bugfix",
    budget: 2000,
    body: "支付完成后回调延迟超过5秒，影响用户体验。需要排查支付网关和网络延迟原因。",
    constraints: JSON.stringify({ priority: "high", deadline: "2026-04-16" }),
  },
  {
    title: "设计新版首页UI方案",
    intent: "design",
    budget: 5000,
    body: "为新版首页设计更现代的UI方案，突出核心功能入口，优化首屏信息架构。",
    constraints: JSON.stringify({ deadline: "2026-04-30", style: "简洁现代" }),
  },
  {
    title: "编写API接口文档",
    intent: "docs",
    budget: 1000,
    body: "为所有新增API接口编写完整的Swagger文档，包括请求参数、返回值和错误码说明。",
    constraints: JSON.stringify({ format: "Swagger/OpenAPI 3.0" }),
  },
  {
    title: "性能优化图片加载",
    intent: "optimization",
    budget: 1800,
    body: "列表页图片加载慢，需要实现懒加载和WebP格式支持，优化CDN缓存策略。",
    constraints: JSON.stringify({ deadline: "2026-04-22", metric: "LCP<2.5s" }),
  },
  {
    title: "新增数据导出功能",
    intent: "feature",
    budget: 2500,
    body: "支持将查询数据导出为Excel和CSV格式，支持自定义列和筛选条件。",
    constraints: JSON.stringify({ deadline: "2026-04-28", formats: ["xlsx", "csv"] }),
  },
  {
    title: "修复搜索结果排序异常",
    intent: "bugfix",
    budget: 1200,
    body: "关键词搜索结果的相关性排序不正确，部分长尾词结果与预期不符。",
    constraints: JSON.stringify({ priority: "medium" }),
  },
  {
    title: "设计消息推送系统",
    intent: "architecture",
    budget: 4000,
    body: "设计完整的消息推送系统架构，支持WebSocket和极光推送，支持离线消息存储。",
    constraints: JSON.stringify({ deadline: "2026-05-10", scalability: "支持10万并发" }),
  },
  {
    title: "用户反馈数据分析",
    intent: "analytics",
    budget: 800,
    body: "分析近一个月用户反馈数据，提取高频问题和改进建议，形成分析报告。",
    constraints: JSON.stringify({ period: "2026-03-01 to 2026-04-01", output: "报告" }),
  },
];

const now = new Date().toISOString();

tasks.forEach((task, index) => {
  const threadId = createThread({
    title: task.title,
    intent: task.intent,
    budget: task.budget,
    constraints_json: task.constraints,
    body: task.body,
    creator_id: 1,
  });

  // 为部分任务添加回复和提案
  if (index < 6) {
    createReply({
      thread_id: threadId,
      author_id: 1,
      reply_type: "note",
      body: `任务已接收，正在进行初步分析...`,
    });

    createProposal({
      thread_id: threadId,
      plan_json: JSON.stringify([
        { step: 1, action: "需求确认", time: "1小时" },
        { step: 2, action: "技术方案设计", time: "2小时" },
        { step: 3, action: "编码实现", time: task.intent === "bugfix" ? "2小时" : "4小时" },
        { step: 4, action: "测试验证", time: "1小时" },
      ]),
      cost_estimate: task.budget * 0.8,
      latency_estimate: 8,
      confidence: 0.85 + Math.random() * 0.1,
      agent_id: 2,
    });
  }

  addEvent("task_created", {
    thread_id: threadId,
    intent: task.intent,
    title: task.title,
    created_at: now,
  });

  console.log(`Created task ${index + 1}: ${task.title} (id: ${threadId})`);
});

console.log(`\n✅ 成功创建10个虚构任务数据！`);