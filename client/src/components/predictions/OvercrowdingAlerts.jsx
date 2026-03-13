import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle } from "lucide-react";

export function OvercrowdingAlerts({ alerts }) {
  if (!alerts?.length) {
    return (
      <Card className="rounded-lg border-border">
        <CardHeader>
          <CardTitle className="font-display text-lg">
            Overcrowding alerts
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Rooms at or above capacity threshold
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-12 text-center">
            <p className="text-sm text-muted-foreground">
              No overcrowding alerts at this time
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-lg border-border">
      <CardHeader>
        <CardTitle className="font-display text-lg flex items-center gap-2">
          <AlertTriangle className="size-5 text-destructive" />
          Overcrowding alerts
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          {alerts.length} room{alerts.length !== 1 ? "s" : ""} above threshold
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {alerts.map((alert) => (
            <div
              key={alert.roomId}
              className="flex items-center justify-between rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3"
            >
              <div>
                <p className="font-medium text-foreground">{alert.roomName}</p>
                <p className="text-sm text-muted-foreground">
                  Current: {alert.currentOccupancy} · Threshold: {alert.threshold}
                </p>
              </div>
              <Badge variant="destructive" className="rounded-md">
                {alert.densityLevel}
              </Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
