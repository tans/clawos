import { type FormEvent, useState } from "react";
import type { CreateOwnedCompanyInput, TeamAppCompanyMode } from "../../types";

type CreateCompanyPageProps = {
  pending?: boolean;
  error?: string | null;
  onSubmit?: (input: CreateOwnedCompanyInput) => void | Promise<void>;
};

function isValidSlug(slug: string): boolean {
  return /^[a-z0-9-]{2,32}$/.test(slug);
}

export function CreateCompanyPage({ pending = false, error, onSubmit }: CreateCompanyPageProps) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [mode, setMode] = useState<TeamAppCompanyMode>("unmanned");
  const [validationError, setValidationError] = useState<string | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedName = name.trim();
    const normalizedSlug = slug.trim().toLowerCase();
    if (!normalizedName) {
      setValidationError("请输入公司名称。");
      return;
    }
    if (!normalizedSlug) {
      setValidationError("请输入公司标识。");
      return;
    }
    if (normalizedSlug.length < 2) {
      setValidationError("公司标识至少需要 2 个字符。");
      return;
    }
    if (!isValidSlug(normalizedSlug)) {
      setValidationError("公司标识只能包含小写字母、数字和连字符。");
      return;
    }

    setValidationError(null);
    void onSubmit?.({
      name: normalizedName,
      slug: normalizedSlug,
      mode,
    });
  }

  const message = validationError ?? error;

  return (
    <main className="team-shell">
      <section className="invite-panel onboarding-panel">
        <div className="panel-header">
          <p className="eyebrow">Team v1</p>
          <h1>创建公司</h1>
          <p className="lead onboarding-copy">创建第一家公司后，会直接进入管理台继续配置品牌、Gateway 与团队。</p>
        </div>
        <form className="onboarding-form" onSubmit={handleSubmit}>
          <div className="form-grid">
            <label className="field-stack" htmlFor="company-name">
              <span>公司名称</span>
              <input
                id="company-name"
                className="text-input"
                name="name"
                value={name}
                onChange={(event) => {
                  setName(event.target.value);
                  setValidationError(null);
                }}
                placeholder="阿尔法科技"
                disabled={pending}
              />
            </label>
            <label className="field-stack" htmlFor="company-slug">
              <span>公司标识</span>
              <input
                id="company-slug"
                className="text-input"
                name="slug"
                value={slug}
                onChange={(event) => {
                  setSlug(event.target.value);
                  setValidationError(null);
                }}
                placeholder="alpha-ops"
                disabled={pending}
              />
            </label>
            <label className="field-stack" htmlFor="company-mode">
              <span>公司模式</span>
              <select
                id="company-mode"
                className="text-input"
                name="mode"
                value={mode}
                onChange={(event) => {
                  setMode(event.target.value as TeamAppCompanyMode);
                  setValidationError(null);
                }}
                disabled={pending}
              >
                <option value="unmanned">无人值守</option>
                <option value="standard">标准协作</option>
              </select>
            </label>
          </div>
          {message ? (
            <div className="status-banner status-error" role="alert" aria-live="polite">
              {message}
            </div>
          ) : null}
          <div className="button-row onboarding-actions">
            <button className="primary-button" type="submit" disabled={pending}>
              创建公司并进入管理台
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
