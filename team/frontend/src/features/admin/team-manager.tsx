import type { GatewayAgent } from "../../types";

type TeamManagerProps = {
  name: string;
  description: string;
  primaryAgentId: string;
  agents: GatewayAgent[];
  onNameChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onPrimaryAgentIdChange: (value: string) => void;
  onCreate: () => void;
};

export function TeamManager({
  name,
  description,
  primaryAgentId,
  agents,
  onNameChange,
  onDescriptionChange,
  onPrimaryAgentIdChange,
  onCreate,
}: TeamManagerProps) {
  return (
    <section className="admin-card" id="teams">
      <p className="eyebrow">团队</p>
      <h2>业务团队</h2>
      <div className="admin-grid">
        <label className="field-stack">
          <span>团队名称</span>
          <input
            className="text-input"
            aria-label="团队名称"
            name="teamName"
            value={name}
            onChange={(event) => onNameChange(event.target.value)}
            placeholder="销售团队"
          />
        </label>
        <label className="field-stack">
          <span>团队说明</span>
          <input
            className="text-input"
            aria-label="团队说明"
            name="teamDescription"
            value={description}
            onChange={(event) => onDescriptionChange(event.target.value)}
            placeholder="负责销售跟进与客户沟通"
          />
        </label>
        <label className="field-stack">
          <span>主 Agent</span>
          <select
            className="text-input"
            aria-label="主 Agent"
            value={primaryAgentId}
            onChange={(event) => onPrimaryAgentIdChange(event.target.value)}
          >
            <option value="">请选择一个 Agent</option>
            {agents.map((agent) => (
              <option key={agent.id} value={agent.externalAgentId}>
                {agent.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <button className="primary-button" type="button" onClick={onCreate}>
        创建团队
      </button>
    </section>
  );
}
