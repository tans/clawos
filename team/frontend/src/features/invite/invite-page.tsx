import { FormEvent, useState } from "react";

type InviteJoinInput = {
  token: string;
  displayName: string;
};

type InvitePageProps = {
  token: string;
  onJoin?: (input: InviteJoinInput) => void;
  pending?: boolean;
  error?: string | null;
};

export function InvitePage({ token, onJoin, pending = false, error }: InvitePageProps) {
  const [displayName, setDisplayName] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedName = displayName.trim();
    if (!trimmedName) {
      return;
    }

    onJoin?.({
      token,
      displayName: trimmedName,
    });

    setDisplayName("");
  }

  return (
    <main className="team-shell">
      <section className="invite-panel">
        <p className="eyebrow">邀请入口</p>
        <h1>加入公司工作台</h1>
        <p className="lead">通过邀请链接进入团队会话，与公司 Agent 开始协作。</p>
        <form className="invite-form" onSubmit={handleSubmit}>
          <label className="field-label" htmlFor="invite-display-name">
            昵称
          </label>
          <input
            id="invite-display-name"
            className="text-input"
            name="displayName"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            placeholder="请输入你的昵称"
            disabled={pending}
          />
          <button className="primary-button" type="submit" disabled={pending}>
            进入工作台
          </button>
        </form>
        {error ? <div className="status-banner status-error">{error}</div> : null}
        <div className="info-row">
          <span>邀请令牌</span>
          <strong>{token}</strong>
        </div>
      </section>
    </main>
  );
}
