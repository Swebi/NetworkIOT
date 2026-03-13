import { Card, CardContent } from "@/components/ui/card";

export function KPICards({ liveData, systemStatus }) {
  const totalOccupancy = liveData.reduce((sum, r) => sum + r.currentOccupancy, 0);
  const avgOccupancy = liveData.length
    ? Math.round(totalOccupancy / liveData.length)
    : 0;
  const highDensityCount = liveData.filter(
    (r) => r.densityLevel === "high"
  ).length;

  const kpis = [
    { label: "TOTAL OCCUPANCY", value: totalOccupancy },
    { label: "ROOMS MONITORED", value: liveData.length },
    { label: "HUBS ACTIVE", value: systemStatus?.hubsActive ?? 0 },
    { label: "HIGH DENSITY", value: highDensityCount },
    { label: "AVG PER ROOM", value: avgOccupancy },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
      {kpis.map((kpi) => (
        <Card
          key={kpi.label}
          className="rounded-lg border-border bg-card"
        >
          <CardContent className="p-4">
            <p className="text-2xl font-semibold text-primary">{kpi.value}</p>
            <p className="mt-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {kpi.label}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
