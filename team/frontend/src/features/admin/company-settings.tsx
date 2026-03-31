type CompanySettingsProps = {
  brandName: string;
  themeColor: string;
  welcomeText: string;
  logoUrl: string;
  onBrandNameChange: (value: string) => void;
  onThemeColorChange: (value: string) => void;
  onWelcomeTextChange: (value: string) => void;
  onLogoUrlChange: (value: string) => void;
  onSave: () => void;
};

export function CompanySettings({
  brandName,
  themeColor,
  welcomeText,
  logoUrl,
  onBrandNameChange,
  onThemeColorChange,
  onWelcomeTextChange,
  onLogoUrlChange,
  onSave,
}: CompanySettingsProps) {
  return (
    <section className="admin-card" id="company">
      <p className="eyebrow">Company</p>
      <h2>Company profile</h2>
      <div className="admin-grid">
        <label className="field-stack">
          <span>Company name</span>
          <input
            className="text-input"
            aria-label="Company name"
            name="companyName"
            value={brandName}
            onChange={(event) => onBrandNameChange(event.target.value)}
            placeholder="Alpha Ops"
          />
        </label>
        <label className="field-stack">
          <span>Theme color</span>
          <input
            className="text-input"
            aria-label="Theme color"
            name="themeColor"
            value={themeColor}
            onChange={(event) => onThemeColorChange(event.target.value)}
            placeholder="#1d4ed8"
          />
        </label>
        <label className="field-stack">
          <span>Welcome text</span>
          <input
            className="text-input"
            aria-label="Welcome text"
            name="welcomeText"
            value={welcomeText}
            onChange={(event) => onWelcomeTextChange(event.target.value)}
            placeholder="Welcome to Alpha Ops"
          />
        </label>
        <label className="field-stack">
          <span>Logo URL</span>
          <input
            className="text-input"
            aria-label="Logo URL"
            name="logoUrl"
            value={logoUrl}
            onChange={(event) => onLogoUrlChange(event.target.value)}
            placeholder="/uploads/alpha/logo.png"
          />
        </label>
      </div>
      <button className="primary-button" type="button" onClick={onSave}>
        Save company
      </button>
    </section>
  );
}
