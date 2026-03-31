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
      <p className="eyebrow">Teams</p>
      <h2>Business teams</h2>
      <div className="admin-grid">
        <label className="field-stack">
          <span>Team name</span>
          <input
            className="text-input"
            aria-label="Team name"
            name="teamName"
            value={name}
            onChange={(event) => onNameChange(event.target.value)}
            placeholder="Sales"
          />
        </label>
        <label className="field-stack">
          <span>Team description</span>
          <input
            className="text-input"
            aria-label="Team description"
            name="teamDescription"
            value={description}
            onChange={(event) => onDescriptionChange(event.target.value)}
            placeholder="Sales copilot"
          />
        </label>
        <label className="field-stack">
          <span>Primary agent</span>
          <select
            className="text-input"
            aria-label="Primary agent"
            value={primaryAgentId}
            onChange={(event) => onPrimaryAgentIdChange(event.target.value)}
          >
            <option value="">Select an agent</option>
            {agents.map((agent) => (
              <option key={agent.id} value={agent.externalAgentId}>
                {agent.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <button className="primary-button" type="button" onClick={onCreate}>
        Create team
      </button>
    </section>
  );
}
