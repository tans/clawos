export interface ChangelogItem {
  version: string;
  date: string;
  channel: "stable" | "beta" | "alpha";
  highlights: string[];
}

export const changelogItems: ChangelogItem[] = [
  {
    version: "0.9.45-alpha",
    date: "2026-03-22",
    channel: "alpha",
    highlights: ["新增 Alpha 发布通道展示。", "每次合并后自动生成 Alpha 版本。", "首页新增中文更新日志模块。"],
  },
  {
    version: "0.9.44",
    date: "2026-03-20",
    channel: "stable",
    highlights: ["优化下载入口文案。", "改进 MCP 版本下载 API 响应。"],
  },
];
