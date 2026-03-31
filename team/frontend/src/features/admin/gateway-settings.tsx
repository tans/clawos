type GatewaySettingsProps = {
  baseUrl: string;
  apiKey: string;
  onBaseUrlChange: (value: string) => void;
  onApiKeyChange: (value: string) => void;
  onTest: () => void;
  onSync: () => void;
};

export function GatewaySettings({
  baseUrl,
  apiKey,
  onBaseUrlChange,
  onApiKeyChange,
  onTest,
  onSync,
}: GatewaySettingsProps) {
  return (
    <section className="admin-card" id="gateway">
      <p className="eyebrow">Gateway</p>
      <h2>Gateway connection</h2>
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
        <button className="primary-button" type="button" onClick={onTest}>
          Test connection
        </button>
        <button className="secondary-button" type="button" onClick={onSync}>
          Sync agents
        </button>
      </div>
    </section>
  );
}
