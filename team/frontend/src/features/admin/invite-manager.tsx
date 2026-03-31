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
      <p className="eyebrow">邀请</p>
      <h2>邀请链接</h2>
      <div className="admin-grid">
        <label className="field-stack">
          <span>使用次数上限</span>
          <input
            className="text-input"
            aria-label="使用次数上限"
            value={usageLimit}
            onChange={(event) => onUsageLimitChange(event.target.value)}
            placeholder="5"
          />
        </label>
        <label className="field-stack">
          <span>有效时长（小时）</span>
          <input
            className="text-input"
            aria-label="有效时长（小时）"
            value={expiresInHours}
            onChange={(event) => onExpiresInHoursChange(event.target.value)}
            placeholder="24"
          />
        </label>
      </div>
      <button className="primary-button" type="button" onClick={onCreate}>
        创建邀请链接
      </button>
      <div className="info-row">
        <span>当前邀请</span>
        <strong>{latestInvite?.token ?? "单公司复用链接"}</strong>
      </div>
    </section>
  );
}
