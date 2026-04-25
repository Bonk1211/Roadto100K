export function SettingsScreen() {
  return (
    <div className="flex h-full items-center justify-center">
      <div
        className="max-w-lg rounded-lg bg-white p-8 text-center shadow-card"
        style={{ border: '1px solid #E5E7EB' }}
      >
        <h2 className="text-section-heading text-text-primary">Settings</h2>
        <p className="mt-3 text-base text-muted-text">
          Agent configuration is managed via the SafeSend admin console (out of
          scope for this demo). The mock-api endpoint is{' '}
          <span className="font-mono text-text-primary">
            http://localhost:4000
          </span>
          .
        </p>
      </div>
    </div>
  );
}
