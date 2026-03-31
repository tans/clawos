import { type FormEvent, useState } from "react";
import type { RegisterAdminInput } from "../../types";

type RegisterPageProps = {
  pending?: boolean;
  error?: string | null;
  onSubmit?: (input: RegisterAdminInput) => void | Promise<void>;
  onGoToLogin?: () => void;
};

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function RegisterPage({ pending = false, error, onSubmit, onGoToLogin }: RegisterPageProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedEmail = email.trim().toLowerCase();
    if (!isValidEmail(normalizedEmail)) {
      setValidationError("请输入有效的邮箱地址。");
      return;
    }
    if (password.length < 8) {
      setValidationError("密码至少需要 8 个字符。");
      return;
    }
    if (password !== confirmPassword) {
      setValidationError("两次输入的密码不一致。");
      return;
    }

    setValidationError(null);
    void onSubmit?.({
      email: normalizedEmail,
      password,
      confirmPassword,
    });
  }

  const message = validationError ?? error;

  return (
    <main className="team-shell">
      <section className="invite-panel onboarding-panel">
        <div className="panel-header">
          <p className="eyebrow">Team v1</p>
          <h1>注册管理员账号</h1>
          <p className="lead onboarding-copy">先创建管理员账号，再继续配置公司与 OpenClaw Gateway。</p>
        </div>
        <form className="onboarding-form" onSubmit={handleSubmit}>
          <div className="form-grid">
            <label className="field-stack" htmlFor="register-email">
              <span>邮箱</span>
              <input
                id="register-email"
                className="text-input"
                name="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  setValidationError(null);
                }}
                placeholder="owner@example.com"
                disabled={pending}
              />
            </label>
            <label className="field-stack" htmlFor="register-password">
              <span>密码</span>
              <input
                id="register-password"
                className="text-input"
                name="password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  setValidationError(null);
                }}
                placeholder="至少 8 个字符"
                disabled={pending}
              />
            </label>
            <label className="field-stack" htmlFor="register-confirm-password">
              <span>确认密码</span>
              <input
                id="register-confirm-password"
                className="text-input"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => {
                  setConfirmPassword(event.target.value);
                  setValidationError(null);
                }}
                placeholder="再次输入密码"
                disabled={pending}
              />
            </label>
          </div>
          {message ? (
            <div className="status-banner status-error" role="alert" aria-live="polite">
              {message}
            </div>
          ) : null}
          <div className="button-row onboarding-actions">
            <button className="primary-button" type="submit" disabled={pending}>
              注册并继续
            </button>
            <button className="link-button" type="button" onClick={onGoToLogin} disabled={pending}>
              已有账号，去登录
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
