import { memo } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { LayoutDashboard, Calendar, Users, FileText, Settings, NotebookPen, Home, Wallet, CalendarDays, UserCog, DollarSign } from "lucide-react";

const items = [
  { to: "/", label: "Home", icon: Home },
  { to: "/bookings", label: "Bookings", icon: NotebookPen },
  { to: "/calendar", label: "Calendar", icon: CalendarDays },
  { to: "/clients", label: "Clients", icon: Users },
  { to: "/payments", label: "Payments", icon: DollarSign },
];

function BottomNav() {
  const location = useLocation();

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-card/95 backdrop-blur-sm border-t border-border/50 shadow-lg safe-area-bottom">
      <ul className="flex items-stretch justify-around py-1.5 px-2">
        {items.map(({ to, label, icon: Icon }) => {
          const active = location.pathname === to || (to !== "/" && location.pathname.startsWith(to));
          return (
            <li key={to} className="flex-1">
              <NavLink
                to={to}
                className={`flex flex-col items-center gap-0.5 px-2 py-2 rounded-xl transition-all duration-200 touch-feedback no-select ${
                  active 
                    ? "text-primary bg-primary/10" 
                    : "text-muted-foreground hover:text-foreground active:bg-muted/50"
                }`}
              >
                <Icon className={`h-5 w-5 transition-transform ${active ? "scale-110" : ""}`} />
                <span className={`text-[10px] font-medium transition-all ${active ? "opacity-100" : "opacity-70"}`}>
                  {label}
                </span>
              </NavLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export default memo(BottomNav);
