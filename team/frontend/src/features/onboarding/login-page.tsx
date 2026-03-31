import { type FormEvent, useState } from "react";
import type { LoginAdminInput } from "../../types";

type LoginPageProps = {
  pending?: boolean;
  error?: string | null;
  onSubmit?: (input: LoginAdminInput) => void | Promise<void>;
  onGoToRegister?: () => void;
};

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function LoginPage({ pending = false, error, onSubmit, onGoToRegister }: LoginPageProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedEmail = email.trim().toLowerCase();
    if (!isValidEmail(normalizedEmail) || !password) {
      setValidationError("请输入邮箱和密码。");
      return;
    }

    setValidationError(null);
    void onSubmit?.({
      email: normalizedEmail,
      password,
    });
  }

  const message = validationError ?? error;

  return (
    <main className="team-shell">
      <section className="invite-panel onboarding-panel">
        <div className="panel-header">
          <p className="eyebrow">Team v1</p>
          <h1>登录管理员账号</h1>
          <p className="lead onboarding-copy">继续进入当前公司的管理台，完成品牌、Gateway 与团队配置。</p>
        </div>
        <form className="onboarding-form" onSubmit={handleSubmit}>
          <div className="form-grid">
            <label className="field-stack" htmlFor="login-email">
              <span>邮箱</span>
              <input
                id="login-email"
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
            <label className="field-stack" htmlFor="login-password">
              <span>密码</span>
              <input
                id="login-password"
                className="text-input"
                name="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  setValidationError(null);
                }}
                placeholder="输入管理员密码"
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
              登录并继续
            </button>
            <button className="link-button" type="button" onClick={onGoToRegister} disabled={pending}>
              没有账号，去注册
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
