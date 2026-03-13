import { useState, useEffect } from "react";
import { PeakHoursChart } from "./PeakHoursChart";
import { WeeklyPatternsChart } from "./WeeklyPatternsChart";
import { UnderusedSpacesChart } from "./UnderusedSpacesChart";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getPeakHours,
  getWeeklyPatterns,
  getUnderusedSpaces,
} from "@/data/mockApi";

export function HistoricalView() {
  const [peakHours, setPeakHours] = useState([]);
  const [weeklyPatterns, setWeeklyPatterns] = useState([]);
  const [underusedSpaces, setUnderusedSpaces] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setTimeout(() => {
      setPeakHours(getPeakHours());
      setWeeklyPatterns(getWeeklyPatterns());
      setUnderusedSpaces(getUnderusedSpaces());
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
        <Skeleton className="h-80 rounded-lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold text-foreground">
          historical analysis.
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Peak hours, weekly patterns, and space utilization
        </p>
      </div>

      <PeakHoursChart data={peakHours} />

      <div className="grid gap-6 lg:grid-cols-2">
        <WeeklyPatternsChart data={weeklyPatterns} />
        <UnderusedSpacesChart data={underusedSpaces} />
      </div>
    </div>
  );
}
