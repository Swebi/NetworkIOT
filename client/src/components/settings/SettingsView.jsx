import { useState, useEffect } from "react";
import { getStatus, getSettings, updateSettings } from "@/data/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

function StatusDot({ ok }) {
  return (
    <span
      className={`inline-block size-2 rounded-full ${ok ? "bg-emerald-400" : "bg-red-400"}`}
    />
  );
}

export function SettingsView() {
  const [status, setStatus] = useState(null);
  const [rssi, setRssi] = useState(-100);
  const [ntfyTopic, setNtfyTopic] = useState("");
  const [cooldown, setCooldown] = useState(10);
  const [scannerId, setScannerId] = useState("pi");
  const [saved, setSaved] = useState(false);
  const [savedAlerts, setSavedAlerts] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingAlerts, setSavingAlerts] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    Promise.all([getStatus(), getSettings()])
      .then(([s, cfg]) => {
        setStatus(s);
        setRssi(cfg.rssi_threshold ?? -100);
        setNtfyTopic(cfg.ntfy_topic ?? "");
        setCooldown(cfg.alert_cooldown_minutes ?? 10);
        setScannerId(cfg.scanner_id ?? "pi");
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const handleSaveRssi = () => {
    setSaving(true);
    updateSettings({ rssi_threshold: rssi })
      .then(() => { setSaved(true); setTimeout(() => setSaved(false), 2000); })
      .catch((e) => setError(e.message))
      .finally(() => setSaving(false));
  };

  const handleSaveAlerts = () => {
    setSavingAlerts(true);
    updateSettings({
      ntfy_topic: ntfyTopic,
      alert_cooldown_minutes: cooldown,
      scanner_id: scannerId,
    })
      .then(() => { setSavedAlerts(true); setTimeout(() => setSavedAlerts(false), 2000); })
      .catch((e) => setError(e.message))
      .finally(() => setSavingAlerts(false));
  };

  if (loading) {
    return (
      <div className="space-y-6 max-w-2xl">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-36 rounded-lg" />
        <Skeleton className="h-36 rounded-lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="font-display text-3xl font-semibold text-foreground">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Scanner configuration and signal filtering.
        </p>
      </div>

      {error && (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {/* Scanner status */}
      <Card className="rounded-lg border-border">
        <CardHeader>
          <CardTitle className="font-display text-base">Scanner status</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">BLE scanner</span>
            <span className="flex items-center gap-2 text-sm">
              <StatusDot ok={status?.scanner_running} />
              {status?.scanner_running ? "Running" : status?.scanner_error || "Stopped"}
            </span>
          </div>
          {status?.scanner_error && (
            <p className="rounded bg-muted px-3 py-2 text-xs text-muted-foreground">
              {status.scanner_error}
              <br />
              Run <code className="text-primary">sudo bluetoothctl power on</code> to fix.
            </p>
          )}
          <div className="grid grid-cols-2 gap-4 pt-1">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Stable MAC window</p>
              <p className="mt-1 text-lg font-semibold text-foreground">
                {status?.occupancy_window_min ?? "—"} min
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Random MAC window</p>
              <p className="mt-1 text-lg font-semibold text-foreground">
                {status?.random_mac_window_min ?? "—"} min
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* RSSI filter */}
      <Card className="rounded-lg border-border">
        <CardHeader>
          <CardTitle className="font-display text-base">RSSI filter</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <p className="text-sm text-muted-foreground">
            Only count devices with signal stronger than this threshold.
            Lower values include more distant devices.
          </p>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Threshold</span>
              <span className="font-mono font-semibold text-primary">{rssi} dBm</span>
            </div>
            <input
              type="range"
              min={-100}
              max={-30}
              step={5}
              value={rssi}
              onChange={(e) => setRssi(Number(e.target.value))}
              className="w-full accent-primary"
            />
            <div className="flex justify-between text-xs text-muted-foreground/60">
              <span>−100 dBm (all devices)</span>
              <span>−30 dBm (very close only)</span>
            </div>
          </div>
          <div className="flex items-center gap-3 pt-1">
            <button
              onClick={handleSaveRssi}
              disabled={saving}
              className="rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {saving ? "Saving…" : "Save"}
            </button>
            {saved && (
              <span className="text-xs text-emerald-400">Saved</span>
            )}
          </div>
          <div className="rounded bg-muted px-3 py-2 text-xs text-muted-foreground space-y-0.5">
            <p>−50 dBm ≈ 1 m &nbsp;·&nbsp; −65 dBm ≈ 3–5 m &nbsp;·&nbsp; −80 dBm ≈ 10 m</p>
          </div>
        </CardContent>
      </Card>

      {/* Alerts */}
      <Card className="rounded-lg border-border">
        <CardHeader>
          <CardTitle className="font-display text-base">Alerts</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <p className="text-sm text-muted-foreground">
            Push notifications via{" "}
            <a
              href="https://ntfy.sh"
              target="_blank"
              rel="noreferrer"
              className="text-primary underline underline-offset-2"
            >
              ntfy.sh
            </a>
            . Install the ntfy app on your phone and subscribe to your topic.
          </p>

          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm text-muted-foreground">ntfy topic</label>
              <input
                type="text"
                value={ntfyTopic}
                onChange={(e) => setNtfyTopic(e.target.value)}
                placeholder="e.g. networkiot-alerts-abc123"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <p className="mt-1 text-xs text-muted-foreground/60">
                Leave blank to disable alerts. Pick a unique name to avoid collisions.
              </p>
            </div>

            <div>
              <label className="mb-1.5 block text-sm text-muted-foreground">
                Alert cooldown — {cooldown} min
              </label>
              <input
                type="range"
                min={1}
                max={60}
                step={1}
                value={cooldown}
                onChange={(e) => setCooldown(Number(e.target.value))}
                className="w-full accent-primary"
              />
              <div className="flex justify-between text-xs text-muted-foreground/60 mt-1">
                <span>1 min</span>
                <span>60 min</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground/60">
                Minimum time between repeated alerts for the same zone.
              </p>
            </div>

            <div>
              <label className="mb-1.5 block text-sm text-muted-foreground">This device's scanner ID</label>
              <input
                type="text"
                value={scannerId}
                onChange={(e) => setScannerId(e.target.value)}
                placeholder="pi"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <p className="mt-1 text-xs text-muted-foreground/60">
                Must match the Scanner ID set on each zone. Other devices (ESP etc.) use their own IDs.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-1">
            <button
              onClick={handleSaveAlerts}
              disabled={savingAlerts}
              className="rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {savingAlerts ? "Saving…" : "Save"}
            </button>
            {savedAlerts && (
              <span className="text-xs text-emerald-400">Saved</span>
            )}
          </div>

          <div className="rounded bg-muted px-3 py-2 text-xs text-muted-foreground space-y-1">
            <p className="font-medium text-foreground/70">ESP scanner setup</p>
            <p>
              Point each ESP at{" "}
              <code className="text-primary">POST /api/scanner/{"<id>"}/report</code> with body:
            </p>
            <pre className="mt-1 overflow-x-auto text-muted-foreground/80">{`{ "devices": { "AA:BB:CC:DD:EE:FF": { "name": "iPhone", "rssi": -65 } } }`}</pre>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
