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
      <p className="eyebrow">公司</p>
      <h2>公司资料</h2>
      <div className="admin-grid">
        <label className="field-stack">
          <span>公司名称</span>
          <input
            className="text-input"
            aria-label="公司名称"
            name="companyName"
            value={brandName}
            onChange={(event) => onBrandNameChange(event.target.value)}
            placeholder="阿尔法科技"
          />
        </label>
        <label className="field-stack">
          <span>主题色</span>
          <input
            className="text-input"
            aria-label="主题色"
            name="themeColor"
            value={themeColor}
            onChange={(event) => onThemeColorChange(event.target.value)}
            placeholder="#1d4ed8"
          />
        </label>
        <label className="field-stack">
          <span>欢迎语</span>
          <input
            className="text-input"
            aria-label="欢迎语"
            name="welcomeText"
            value={welcomeText}
            onChange={(event) => onWelcomeTextChange(event.target.value)}
            placeholder="欢迎来到阿尔法科技"
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
        保存公司资料
      </button>
    </section>
  );
}
