import { NavLink, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Activity, History, TrendingUp } from "lucide-react";

const navItems = [
  { path: "/", label: "Live Data", icon: Activity },
  { path: "/historical", label: "Historical", icon: History },
  { path: "/predictions", label: "Predictions", icon: TrendingUp },
];

const routeNames = {
  "/": "Live Data",
  "/historical": "Historical",
  "/predictions": "Predictions",
};

const rooms = ["Main Hall", "Room 101", "Room 102", "Room 201", "Room 202"];

export function Sidebar() {
  const { pathname } = useLocation();
  const routeName = routeNames[pathname] ?? "Dashboard";

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-border bg-card">
      <div className="flex h-14 items-center border-b border-border px-4">
        <span className="font-display text-lg font-semibold text-foreground">
          {routeName}
        </span>
      </div>
      <nav className="flex flex-1 flex-col gap-1 p-4">
        <div className="space-y-1">
          {navItems.map((item, i) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                  isActive
                    ? "border border-primary/50 bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )
              }
            >
              <span className="text-muted-foreground">
                0{i + 1}
              </span>
              <item.icon className="size-4" />
              {item.label}
            </NavLink>
          ))}
        </div>
        <div className="mt-8">
          <p className="mb-2 px-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Rooms
          </p>
          <div className="space-y-1">
            {rooms.map((room) => (
              <div
                key={room}
                className="rounded-lg px-3 py-2 text-sm text-muted-foreground"
              >
                {room}
              </div>
            ))}
          </div>
        </div>
        <div className="mt-auto pt-8">
          <p className="px-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Crowd Insights
          </p>
        </div>
      </nav>
    </aside>
  );
}
