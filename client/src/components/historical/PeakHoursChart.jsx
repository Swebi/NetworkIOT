import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Area, AreaChart, XAxis, YAxis, CartesianGrid } from "recharts";

const peakHoursConfig = {
  count: {
    label: "Occupancy",
    color: "#3b82f6",
  },
};

export function PeakHoursChart({ data }) {
  return (
    <Card className="rounded-lg border-border">
      <CardHeader>
        <CardTitle className="font-display text-lg">
          Peak hours
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Hourly occupancy distribution over a typical day
        </p>
      </CardHeader>
      <CardContent>
        <ChartContainer config={peakHoursConfig} className="h-[280px] w-full">
          <AreaChart data={data} margin={{ left: 0, right: 12 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey="hour"
              tickLine={false}
              axisLine={false}
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Area
              type="monotone"
              dataKey="count"
              stroke="#3b82f6"
              fill="#3b82f6"
              fillOpacity={0.3}
              strokeWidth={2}
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
