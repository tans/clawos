type GatewaySettingsProps = {
  baseUrl: string;
  apiKey: string;
  onBaseUrlChange: (value: string) => void;
  onApiKeyChange: (value: string) => void;
  onSave: () => void;
  onTest: () => void;
  onSync: () => void;
};

export function GatewaySettings({
  baseUrl,
  apiKey,
  onBaseUrlChange,
  onApiKeyChange,
  onSave,
  onTest,
  onSync,
}: GatewaySettingsProps) {
  return (
    <section className="admin-card" id="gateway">
      <p className="eyebrow">网关</p>
      <h2>Gateway 连接配置</h2>
      <div className="admin-grid">
        <label className="field-stack">
          <span>Base URL</span>
          <input
            className="text-input"
            aria-label="Base URL"
            name="baseUrl"
            value={baseUrl}
            onChange={(event) => onBaseUrlChange(event.target.value)}
            placeholder="https://gateway.example.com"
          />
        </label>
        <label className="field-stack">
          <span>API key</span>
          <input
            className="text-input"
            aria-label="API key"
            name="apiKey"
            value={apiKey}
            onChange={(event) => onApiKeyChange(event.target.value)}
            placeholder="token"
          />
        </label>
      </div>
      <div className="button-row">
        <button className="primary-button" type="button" onClick={onSave}>
          保存 Gateway
        </button>
        <button className="primary-button" type="button" onClick={onTest}>
          测试连接
        </button>
        <button className="secondary-button" type="button" onClick={onSync}>
          同步 Agent
        </button>
      </div>
    </section>
  );
}
