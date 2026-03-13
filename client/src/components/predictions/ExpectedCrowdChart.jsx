import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Area, AreaChart, XAxis, YAxis, CartesianGrid } from "recharts";

const expectedConfig = {
  expectedNextHour: {
    label: "Expected",
    color: "#3b82f6",
  },
};

export function ExpectedCrowdChart({ data }) {
  const chartData = data.map((r, i) => ({
    room: r.roomName,
    expectedNextHour: r.expectedNextHour,
    index: i,
  }));

  return (
    <Card className="rounded-lg border-border">
      <CardHeader>
        <CardTitle className="font-display text-lg">
          Expected crowd next hour
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          ML-based forecast per room
        </p>
      </CardHeader>
      <CardContent>
        <ChartContainer config={expectedConfig} className="h-[280px] w-full">
          <AreaChart data={chartData} margin={{ left: 0, right: 12 }}>
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
            <Area
              type="monotone"
              dataKey="expectedNextHour"
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
