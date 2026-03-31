import type { TeamInvite } from "../../types";

type InviteManagerProps = {
  usageLimit: string;
  expiresInHours: string;
  latestInvite: TeamInvite | null;
  onUsageLimitChange: (value: string) => void;
  onExpiresInHoursChange: (value: string) => void;
  onCreate: () => void;
};

export function InviteManager({
  usageLimit,
  expiresInHours,
  latestInvite,
  onUsageLimitChange,
  onExpiresInHoursChange,
  onCreate,
}: InviteManagerProps) {
  return (
    <section className="admin-card" id="invites">
      <p className="eyebrow">Invites</p>
      <h2>Invite links</h2>
      <div className="admin-grid">
        <label className="field-stack">
          <span>Usage limit</span>
          <input
            className="text-input"
            aria-label="Usage limit"
            value={usageLimit}
            onChange={(event) => onUsageLimitChange(event.target.value)}
            placeholder="5"
          />
        </label>
        <label className="field-stack">
          <span>Expires in hours</span>
          <input
            className="text-input"
            aria-label="Expires in hours"
            value={expiresInHours}
            onChange={(event) => onExpiresInHoursChange(event.target.value)}
            placeholder="24"
          />
        </label>
      </div>
      <button className="primary-button" type="button" onClick={onCreate}>
        Create invite
      </button>
      <div className="info-row">
        <span>Invite mode</span>
        <strong>{latestInvite?.token ?? "Single company / reusable links"}</strong>
      </div>
    </section>
  );
}
