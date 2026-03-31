import type { GatewayAgent } from "../../types";

type AgentManagerProps = {
  agents: GatewayAgent[];
};

export function AgentManager({ agents }: AgentManagerProps) {
  return (
    <section className="admin-card" id="agents">
      <p className="eyebrow">Agents</p>
      <h2>Primary agents</h2>
      <ul className="sidebar-list">
        {agents.length ? (
          agents.map((agent) => (
            <li key={agent.id}>
              <strong>{agent.name}</strong>
              <span>{agent.description ?? "Ready for invite-based team conversations."}</span>
            </li>
          ))
        ) : (
          <li>
            <strong>No synced agents yet</strong>
            <span>Test the gateway and sync agents before creating teams.</span>
          </li>
        )}
      </ul>
    </section>
  );
}
