import { Outlet, useLocation } from "react-router-dom";
import { Sidebar } from "./Sidebar";

const routeNames = {
  "/": "Live Data",
  "/historical": "Historical",
  "/predictions": "Predictions",
};

export function Layout() {
  const { pathname } = useLocation();
  const routeName = routeNames[pathname] ?? "Dashboard";

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div className="flex flex-1 flex-col">
        <header className="flex h-14 items-center justify-between border-b border-border px-6">
          <span className="font-display text-lg font-semibold text-foreground">
            {routeName}
          </span>
        </header>
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
