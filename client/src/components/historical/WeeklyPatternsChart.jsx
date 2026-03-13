import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Bar, BarChart, XAxis, YAxis, CartesianGrid } from "recharts";

const weeklyConfig = {
  count: {
    label: "Total",
    color: "#3b82f6",
  },
  avgOccupancy: {
    label: "Avg Occupancy",
    color: "#60a5fa",
  },
};

export function WeeklyPatternsChart({ data }) {
  return (
    <Card className="rounded-lg border-border">
      <CardHeader>
        <CardTitle className="font-display text-lg">
          Weekly patterns
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Day-of-week occupancy comparison
        </p>
      </CardHeader>
      <CardContent>
        <ChartContainer config={weeklyConfig} className="h-[280px] w-full">
          <BarChart data={data} margin={{ left: 0, right: 12 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey="day"
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
            <Bar
              dataKey="count"
              fill="#3b82f6"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
