import { useState, useEffect, useCallback } from "react";
import { getLiveData } from "@/data/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Area, AreaChart, XAxis, YAxis, CartesianGrid } from "recharts";

const STATUS_STYLES = {
  active: "text-emerald-400",
  out_of_range: "text-yellow-400",
  inactive: "text-muted-foreground",
};

const STATUS_LABELS = {
  active: "Active",
  out_of_range: "Out of range",
  inactive: "Inactive",
};

const historyConfig = {
  count: { label: "Occupancy", color: "#3b82f6" },
};

function KPICard({ label, value, sub }) {
  return (
    <Card className="rounded-lg border-border bg-card">
      <CardContent className="p-4">
        <p className="text-2xl font-semibold text-primary">{value}</p>
        <p className="mt-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        {sub && <p className="mt-0.5 text-xs text-muted-foreground/60">{sub}</p>}
      </CardContent>
    </Card>
  );
}

export function LiveDataView() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    getLiveData()
      .then((d) => { setData(d); setError(null); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 10_000);
    return () => clearInterval(id);
  }, [load]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-lg" />)}
        </div>
        <Skeleton className="h-64 rounded-lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
        <p className="text-sm font-medium text-destructive">Cannot reach Pi API</p>
        <p className="text-xs text-muted-foreground">{error}</p>
        <button
          onClick={load}
          className="mt-2 rounded-md bg-primary/10 px-4 py-1.5 text-xs text-primary hover:bg-primary/20 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  const {
    current_occupancy,
    combined_occupancy,
    tracked_devices,
    stable_devices,
    random_devices,
    last_scan,
    history,
    scan_log,
    devices,
    zones_summary = [],
  } = data;

  const hasZones = zones_summary.length > 0;
  // combined_occupancy includes pi + all zone scanners; fall back to pi if no zones
  const totalOccupancy = hasZones ? combined_occupancy : current_occupancy;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold text-foreground">
          Occupancy Dashboard
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Unique BLE devices detected across all zones
        </p>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard
          label="Total Occupancy"
          value={totalOccupancy}
          sub={hasZones ? `Pi: ${current_occupancy}` : undefined}
        />
        <KPICard
          label="Tracked Devices"
          value={tracked_devices}
          sub={`${stable_devices} stable · ${random_devices} random`}
        />
        <KPICard label="Last Scan" value={last_scan.time} />
        <KPICard label="Devices in Last Scan" value={last_scan.found} />
      </div>

      {/* Zone Breakdown */}
      {hasZones && (
        <Card className="rounded-lg border-border">
          <CardHeader>
            <CardTitle className="font-display text-lg">Zone Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {zones_summary.map((z) => {
                const over = z.threshold !== null && z.occupancy > z.threshold;
                return (
                  <div
                    key={z.id}
                    className={`flex items-center justify-between rounded-lg border px-4 py-3 ${
                      over ? "border-red-500/50 bg-red-500/5" : "border-border bg-muted/30"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className="h-2.5 w-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: z.color }}
                      />
                      <span className="truncate text-sm text-foreground">{z.name}</span>
                    </div>
                    <div className="shrink-0 text-right ml-3">
                      <span className={`text-lg font-semibold ${over ? "text-red-400" : "text-primary"}`}>
                        {z.occupancy}
                      </span>
                      {z.threshold !== null && (
                        <span className="ml-1 text-xs text-muted-foreground">/ {z.threshold}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Charts row */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Occupancy over time */}
        <Card className="rounded-lg border-border">
          <CardHeader>
            <CardTitle className="font-display text-lg">Occupancy over time (Pi)</CardTitle>
          </CardHeader>
          <CardContent>
            {history.length > 0 ? (
              <ChartContainer config={historyConfig} className="h-[240px] w-full">
                <AreaChart data={history} margin={{ left: 0, right: 12 }}>
                  <defs>
                    <linearGradient id="occ-grad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="time"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Area
                    type="monotone"
                    dataKey="count"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    fill="url(#occ-grad)"
                    dot={false}
                  />
                </AreaChart>
              </ChartContainer>
            ) : (
              <p className="py-16 text-center text-sm text-muted-foreground">
                No history yet — waiting for scans.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Recent scans */}
        <Card className="rounded-lg border-border">
          <CardHeader>
            <CardTitle className="font-display text-lg">Recent scans (Pi)</CardTitle>
          </CardHeader>
          <CardContent>
            {scan_log.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      {["Time", "Found", "Active"].map((h) => (
                        <th
                          key={h}
                          className="pb-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {scan_log.slice(0, 10).map((row, i) => (
                      <tr key={i} className="border-b border-border/50 last:border-0">
                        <td className="py-2.5 text-sm font-mono text-muted-foreground">{row.time}</td>
                        <td className="py-2.5 text-sm text-foreground">{row.found}</td>
                        <td className="py-2.5 text-sm text-primary font-medium">{row.active}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="py-16 text-center text-sm text-muted-foreground">No scan data yet.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Device table */}
      <Card className="rounded-lg border-border">
        <CardHeader>
          <CardTitle className="font-display text-lg">
            Detected devices
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              ({devices.length})
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {devices.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    {["MAC Address", "Name", "RSSI", "Type", "Missed", "Last Seen", "Status"].map((h) => (
                      <th
                        key={h}
                        className="pb-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {devices.map((d) => (
                    <tr key={d.mac} className="border-b border-border/50 last:border-0">
                      <td className="py-3 font-mono text-xs text-muted-foreground">{d.mac}</td>
                      <td className="py-3 text-foreground">{d.name || "—"}</td>
                      <td className="py-3 text-foreground">{d.rssi}</td>
                      <td className="py-3 capitalize text-muted-foreground">{d.type}</td>
                      <td className="py-3 text-muted-foreground">{d.miss_count}</td>
                      <td className="py-3 font-mono text-xs text-muted-foreground">{d.last_seen}</td>
                      <td className={`py-3 text-xs font-medium ${STATUS_STYLES[d.status]}`}>
                        {STATUS_LABELS[d.status]}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="py-16 text-center text-sm text-muted-foreground">
              No devices detected. Make sure Bluetooth is enabled.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
