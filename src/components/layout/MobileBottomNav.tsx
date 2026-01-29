import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Home, Calendar, FileText, DollarSign, Plus, X, Users, Package, Building2, BarChart, Settings, FolderOpen } from "lucide-react";
import { cn } from "@/lib/utils";

const MobileBottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [showQuickActions, setShowQuickActions] = useState(false);

  const navItems = [
    { icon: Home, label: "Home", path: "/" },
    { icon: Calendar, label: "Calendar", path: "/calendar" },
    { icon: null, label: "Add", path: null }, // Center button
    { icon: FileText, label: "Bookings", path: "/bookings" },
    { icon: DollarSign, label: "Payments", path: "/payments" },
  ];

  const quickActions = [
    { icon: Users, label: "Clients", action: () => navigate("/clients") },
    { icon: Package, label: "Packages", action: () => navigate("/packages") },
    { icon: Building2, label: "Venues", action: () => navigate("/entities") },
    { icon: FileText, label: "Invoices", action: () => navigate("/invoices") },
    { icon: FolderOpen, label: "Documents", action: () => navigate("/documents") },
    { icon: BarChart, label: "Reports", action: () => navigate("/reports") },
    { icon: DollarSign, label: "Accounts", action: () => navigate("/accounts") },
    { icon: Settings, label: "Settings", action: () => navigate("/settings") },
  ];

  const handleQuickAction = (action: () => void) => {
    action();
    setShowQuickActions(false);
  };

  return (
    <>
      {/* Overlay */}
      {showQuickActions && (
        <div
          className="fixed inset-0 bg-black/20 z-40 md:hidden animate-fade-in"
          onClick={() => setShowQuickActions(false)}
        />
      )}

      {/* Quick Actions Popup */}
      {showQuickActions && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 md:hidden animate-slide-up">
          <div className="bg-white rounded-2xl shadow-2xl p-5 max-w-[380px] w-[90vw]">
            <div className="grid grid-cols-4 gap-4">
              {quickActions.map((action, index) => (
                <button
                  key={index}
                  onClick={() => handleQuickAction(action.action)}
                  className="flex flex-col items-center gap-2.5 p-3 rounded-xl hover:bg-gradient-to-br hover:from-yellow-50 hover:to-yellow-100/50 active:scale-95 transition-all touch-feedback group"
                >
                  <div className="w-14 h-14 rounded-full bg-gradient-to-br from-slate-100 to-slate-50 group-hover:from-yellow-100 group-hover:to-yellow-50 flex items-center justify-center transition-all shadow-md">
                    <action.icon className="w-6 h-6 text-slate-600 group-hover:text-yellow-700 transition-colors" />
                  </div>
                  <span className="text-xs text-slate-700 group-hover:text-yellow-800 text-center font-medium leading-tight transition-colors">
                    {action.label}
                  </span>
                </button>
              ))}
            </div>
          </div>
          {/* Arrow pointer */}
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-white rotate-45 shadow-lg" />
        </div>
      )}

      {/* Bottom Navigation Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 md:hidden">
        <div className="bg-white/80 backdrop-blur-xl border-t border-slate-200/60 shadow-lg">
          <div className="flex items-center justify-around px-4 py-2 relative">
            {navItems.map((item, index) => {
              if (item.icon === null) {
                // Center + button
                return (
                  <button
                    key={index}
                    onClick={() => setShowQuickActions(!showQuickActions)}
                    className={cn(
                      "absolute left-1/2 -translate-x-1/2 -top-7 w-16 h-16 rounded-full bg-gradient-to-br from-yellow-500 to-yellow-600 shadow-xl flex items-center justify-center transition-all duration-300 active:scale-95 touch-feedback",
                      showQuickActions && "rotate-45"
                    )}
                  >
                    {showQuickActions ? (
                      <X className="w-7 h-7 text-white" />
                    ) : (
                      <Plus className="w-7 h-7 text-white" />
                    )}
                  </button>
                );
              }

              const isActive = location.pathname === item.path;
              const Icon = item.icon;

              return (
                <button
                  key={index}
                  onClick={() => item.path && navigate(item.path)}
                  className={cn(
                    "flex flex-col items-center gap-1 py-2 px-3 rounded-xl transition-all touch-feedback min-w-[60px]",
                    isActive
                      ? "text-yellow-600"
                      : "text-slate-600 hover:text-slate-900 active:scale-95"
                  )}
                >
                  <Icon
                    className={cn(
                      "w-6 h-6 transition-all",
                      isActive && "scale-110"
                    )}
                  />
                  <span
                    className={cn(
                      "text-[10px] font-medium transition-all",
                      isActive && "font-semibold"
                    )}
                  >
                    {item.label}
                  </span>
                  {isActive && (
                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-yellow-600" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Spacer to prevent content from being hidden behind nav */}
      <div className="h-20 md:hidden" />
    </>
  );
};

export default MobileBottomNav;
