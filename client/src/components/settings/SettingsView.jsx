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
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    Promise.all([getStatus(), getSettings()])
      .then(([s, cfg]) => {
        setStatus(s);
        setRssi(cfg.rssi_threshold ?? -100);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = () => {
    setSaving(true);
    updateSettings({ rssi_threshold: rssi })
      .then(() => { setSaved(true); setTimeout(() => setSaved(false), 2000); })
      .catch((e) => setError(e.message))
      .finally(() => setSaving(false));
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
              onClick={handleSave}
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
    </div>
  );
}
