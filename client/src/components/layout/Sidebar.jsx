import { NavLink } from "react-router-dom";
import { LayoutDashboard, Layers, Settings, Bot } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { path: "/", label: "Dashboard", icon: LayoutDashboard },
  { path: "/zones", label: "Zones", icon: Layers },
  { path: "/ai", label: "AI Assistant", icon: Bot },
  { path: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-border bg-card">
      {/* Logo / app name */}
      <div className="flex h-14 items-center gap-2.5 border-b border-border px-4">
        <span className="text-primary">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3" />
            <circle cx="12" cy="12" r="8" />
            <circle cx="12" cy="12" r="12" strokeOpacity="0.3" />
          </svg>
        </span>
        <span className="text-sm font-semibold tracking-tight text-foreground">
          BLE Occupancy
        </span>
      </div>

      {/* Nav */}
      <nav className="flex flex-1 flex-col gap-0.5 p-3">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === "/"}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
                isActive
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )
            }
          >
            <item.icon className="size-4 shrink-0" />
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t border-border p-4">
        <p className="text-xs text-muted-foreground/50">Raspberry Pi Monitor</p>
      </div>
    </aside>
  );
}
