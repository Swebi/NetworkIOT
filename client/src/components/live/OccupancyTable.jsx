import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const densityColors = {
  low: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  medium: "bg-white/15 text-zinc-200 border-zinc-400/40",
  high: "bg-red-500/20 text-red-400 border-red-500/30",
};

export function OccupancyTable({ liveData }) {
  return (
    <Card className="rounded-lg border-border">
      <CardHeader>
        <CardTitle className="font-display text-lg">
          {liveData.length} room{liveData.length !== 1 ? "s" : ""} monitored
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="pb-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Room
                </th>
                <th className="pb-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Occupancy
                </th>
                <th className="pb-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Density
                </th>
              </tr>
            </thead>
            <tbody>
              {liveData.map((room) => (
                <tr
                  key={room.roomId}
                  className="border-b border-border/50 last:border-0"
                >
                  <td className="py-4">
                    <span className="font-medium text-foreground">
                      {room.roomName}
                    </span>
                  </td>
                  <td className="py-4">
                    <span className="text-primary font-semibold">
                      {room.currentOccupancy}
                    </span>
                  </td>
                  <td className="py-4">
                    <Badge
                      variant="outline"
                      className={cn(
                        "rounded-md border capitalize",
                        densityColors[room.densityLevel] ?? densityColors.low
                      )}
                    >
                      {room.densityLevel}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
