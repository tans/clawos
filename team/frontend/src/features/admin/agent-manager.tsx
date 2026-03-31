import type { GatewayAgent } from "../../types";

type AgentManagerProps = {
  agents: GatewayAgent[];
};

export function AgentManager({ agents }: AgentManagerProps) {
  return (
    <section className="admin-card" id="agents">
      <p className="eyebrow">Agent</p>
      <h2>主 Agent 列表</h2>
      <ul className="sidebar-list">
        {agents.length ? (
          agents.map((agent) => (
            <li key={agent.id}>
              <strong>{agent.name}</strong>
              <span>{agent.description ?? "已就绪，可用于邀请制团队会话。"}</span>
            </li>
          ))
        ) : (
          <li>
            <strong>还没有同步到 Agent</strong>
            <span>请先测试 Gateway 连通性并同步 Agent，再创建团队。</span>
          </li>
        )}
      </ul>
    </section>
  );
}
