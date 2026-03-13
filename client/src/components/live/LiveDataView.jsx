import { useState, useEffect } from "react";
import { KPICards } from "./KPICards";
import { OccupancyTable } from "./OccupancyTable";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getLiveData, getSystemStatus } from "@/data/mockApi";
import { Bar, BarChart, XAxis, YAxis, CartesianGrid } from "recharts";

const occupancyChartConfig = {
  occupancy: {
    label: "Occupancy",
    color: "#3b82f6",
  },
};

export function LiveDataView() {
  const [liveData, setLiveData] = useState([]);
  const [systemStatus, setSystemStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = () => {
      setLoading(true);
      setTimeout(() => {
        setLiveData(getLiveData());
        setSystemStatus(getSystemStatus());
        setLoading(false);
      }, 400);
    };
    load();
    const interval = setInterval(load, 10000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-lg" />
      </div>
    );
  }

  const chartData = liveData.map((r) => ({
    room: r.roomName.replace(" ", "\n"),
    occupancy: r.currentOccupancy,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold text-foreground">
          live data.
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {systemStatus?.hubsActive ?? 0} hubs active · Last updated: just now
        </p>
      </div>

      <KPICards liveData={liveData} systemStatus={systemStatus} />

      <div className="grid gap-6 lg:grid-cols-2">
        <OccupancyTable liveData={liveData} />
        <Card className="rounded-lg border-border">
          <CardHeader>
            <CardTitle className="font-display text-lg">
              Occupancy by room
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={occupancyChartConfig}
              className="h-[280px] w-full"
            >
              <BarChart data={chartData} margin={{ left: 0, right: 12 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="room"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "hsl(var(--muted-foreground))" }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "hsl(var(--muted-foreground))" }}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="occupancy" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
