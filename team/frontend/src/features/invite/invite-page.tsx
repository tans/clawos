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
        <p className="eyebrow">Invite entry</p>
        <h1>Join your company workspace</h1>
        <p className="lead">
          Enter through your invite link to access your team conversations and the company assistant.
        </p>
        <form className="invite-form" onSubmit={handleSubmit}>
          <label className="field-label" htmlFor="invite-display-name">
            Nickname
          </label>
          <input
            id="invite-display-name"
            className="text-input"
            name="displayName"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            placeholder="Your name"
            disabled={pending}
          />
          <button className="primary-button" type="submit" disabled={pending}>
            Enter workspace
          </button>
        </form>
        {error ? <div className="status-banner status-error">{error}</div> : null}
        <div className="info-row">
          <span>Invite token</span>
          <strong>{token}</strong>
        </div>
      </section>
    </main>
  );
}
