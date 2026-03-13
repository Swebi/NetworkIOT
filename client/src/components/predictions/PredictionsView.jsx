import { useState, useEffect } from "react";
import { ExpectedCrowdChart } from "./ExpectedCrowdChart";
import { OvercrowdingAlerts } from "./OvercrowdingAlerts";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getPredictions, getOvercrowdingAlerts } from "@/data/mockApi";

export function PredictionsView() {
  const [predictions, setPredictions] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setTimeout(() => {
      setPredictions(getPredictions());
      setAlerts(getOvercrowdingAlerts());
      setLoading(false);
    }, 400);
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-80 rounded-lg" />
          <Skeleton className="h-80 rounded-lg" />
        </div>
      </div>
    );
  }

  const summaryCards = [
    {
      label: "Rooms with alerts",
      value: alerts.length,
    },
    {
      label: "Rooms forecasted",
      value: predictions.length,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold text-foreground">
          predictions.
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Expected crowd next hour and overcrowding alerts
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {summaryCards.map((card) => (
          <Card key={card.label} className="rounded-lg border-border">
            <CardContent className="p-4">
              <p className="text-2xl font-semibold text-primary">{card.value}</p>
              <p className="mt-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {card.label}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ExpectedCrowdChart data={predictions} />
        <OvercrowdingAlerts alerts={alerts} />
      </div>
    </div>
  );
}
