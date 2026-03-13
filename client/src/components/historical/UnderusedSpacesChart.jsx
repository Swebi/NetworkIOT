import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Bar, BarChart, XAxis, YAxis, CartesianGrid } from "recharts";

const underusedConfig = {
  utilizationPercent: {
    label: "Utilization %",
    color: "#3b82f6",
  },
  avgOccupancy: {
    label: "Avg Occupancy",
    color: "#60a5fa",
  },
};

export function UnderusedSpacesChart({ data }) {
  return (
    <Card className="rounded-lg border-border">
      <CardHeader>
        <CardTitle className="font-display text-lg">
          Underused spaces
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Rooms with lowest average utilization
        </p>
      </CardHeader>
      <CardContent>
        <ChartContainer config={underusedConfig} className="h-[280px] w-full">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ left: 0, right: 12 }}
          >
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              type="number"
              domain={[0, 100]}
              tickLine={false}
              axisLine={false}
              tick={{ fill: "hsl(var(--muted-foreground))" }}
            />
            <YAxis
              type="category"
              dataKey="roomName"
              width={80}
              tickLine={false}
              axisLine={false}
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar
              dataKey="utilizationPercent"
              fill="#3b82f6"
              radius={[0, 4, 4, 0]}
            />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
