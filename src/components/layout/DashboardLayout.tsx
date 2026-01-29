import { useEffect, useState } from "react";
import { Outlet, useNavigate, useLocation, NavLink } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { SidebarProvider, Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { LayoutDashboard, Calendar, Users, Package, DollarSign, FileText, BarChart, Settings, LogOut, Building2, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import MobileBottomNav from "./MobileBottomNav";

const navigationItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Bookings", url: "/bookings", icon: Calendar },
  { title: "Calendar", url: "/calendar", icon: Calendar },
  { title: "Clients & CRM", url: "/clients", icon: Users },
  { title: "Packages", url: "/packages", icon: Package },
  { title: "Venues/Branches", url: "/entities", icon: Building2 },
  { title: "Payments", url: "/payments", icon: DollarSign },
  { title: "Invoices", url: "/invoices", icon: FileText },
  { title: "Accounts", url: "/accounts", icon: DollarSign },
  { title: "Documents", url: "/documents", icon: FolderOpen },
  { title: "Reports", url: "/reports", icon: BarChart },
  { title: "Settings", url: "/settings", icon: Settings },
];

const DashboardSidebar = () => {
  const { state, isMobile, setOpenMobile } = useSidebar();
  const location = useLocation();
  const { signOut } = useAuth();
  const [confirmSignOutOpen, setConfirmSignOutOpen] = useState(false);

  const isActive = (path: string) => {
    if (path === "/") return location.pathname === "/";
    return location.pathname.startsWith(path);
  };

  const handleNavClick = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  const isCollapsed = state === "collapsed";

  return (
    <Sidebar
      className={`hidden md:block bg-sidebar text-sidebar-foreground sidebar-gradient transition-all duration-300 ease-out ${isCollapsed ? "w-14" : "w-56 lg:w-60 xl:w-64"}`}
      collapsible="icon"
    >
      <SidebarContent className="border-r border-sidebar-border/20 overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent hover:scrollbar-thumb-white/30">
        <div className={`px-3 py-3 border-b border-sidebar-border/20 bg-gradient-to-br from-sidebar-accent/30 to-sidebar-accent/10 ${isCollapsed ? "hidden" : ""}`}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-gradient-to-br from-gold-500 to-gold-600 rounded-lg flex items-center justify-center shrink-0">
              <span className="text-white font-bold text-sm">B</span>
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="font-sans text-base font-bold tracking-tight text-white truncate">
                BuyEvenn
              </h2>
              <p className="text-[10px] font-medium text-white/70 truncate">Vendor Suite</p>
            </div>
          </div>
        </div>

        <SidebarGroup className="p-2">
          <SidebarGroupContent>
            <SidebarMenu className="space-y-0.5">
              {navigationItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      onClick={handleNavClick}
                      className={({ isActive }) =>
                        `flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-all duration-180 ease-out group ${
                          isActive
                            ? "bg-gold-500/20 text-white border border-gold-500/30 shadow-md"
                            : "text-white/80 hover:bg-white/5 hover:text-white"
                        }`
                      }
                    >
                      <item.icon className={`h-4 w-4 shrink-0 transition-colors duration-180 ${
                        isActive ? "text-gold-400" : "text-white/60 group-hover:text-gold-400"
                      }`} />
                      {!isCollapsed && (
                        <span className={`text-sm font-medium transition-all duration-180 truncate min-w-0 ${
                          isActive ? "text-white" : "text-white/80"
                        }`}>
                          {item.title}
                        </span>
                      )}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <div className="mt-auto p-2 border-t border-sidebar-border/20">
          <Button
            variant="ghost"
            className="w-full justify-start text-white/70 hover:bg-white/10 hover:text-white transition-all duration-180 ease-out group px-2.5 py-2 h-auto"
            onClick={() => setConfirmSignOutOpen(true)}
          >
            <LogOut className="h-4 w-4 shrink-0 mr-2.5 text-white/60 group-hover:text-white transition-colors duration-180" />
            {!isCollapsed && <span className="text-sm font-medium truncate">Sign Out</span>}
          </Button>
          <Dialog open={confirmSignOutOpen} onOpenChange={setConfirmSignOutOpen}>
            <DialogContent className="md:max-w-sm w-full md:w-auto rounded-t-2xl md:rounded-xl">
              <DialogHeader>
                <DialogTitle className="text-lg font-semibold">Confirm Sign Out</DialogTitle>
              </DialogHeader>
              <p className="text-sm text-muted-foreground">Are you sure you want to sign out?</p>
              <div className="flex justify-end gap-3 pt-4">
                <Button variant="outline" onClick={() => setConfirmSignOutOpen(false)} className="px-6">
                  Cancel
                </Button>
                <Button variant="destructive" onClick={signOut} className="px-6">
                  Sign Out
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </SidebarContent>
    </Sidebar>
  );
};

const DashboardLayout = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background mobile-vh-full">
        <DashboardSidebar />
        <main className="flex-1 overflow-auto pb-16 md:pb-0 hide-scrollbar">
          <header className="hidden md:flex h-14 md:h-16 border-b border-border/50 bg-card sticky top-0 z-30 shadow-sm safe-area-top">
            <div className="h-full flex items-center justify-between px-4 md:px-6 w-full">
              <div className="flex items-center gap-3 md:gap-4">
                <SidebarTrigger className="md:hidden -ml-2" />
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 md:w-8 md:h-8 bg-gradient-to-br from-gold-500 to-gold-600 rounded-lg flex items-center justify-center">
                    <span className="text-white font-bold text-xs md:text-sm">B</span>
                  </div>
                  <div>
                    <h3 className="text-sm md:text-lg font-semibold text-foreground leading-tight">BuyEvenn</h3>
                    <p className="text-[10px] md:text-xs text-muted-foreground hidden sm:block">Vendor Suite</p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 md:w-9 md:h-9 bg-gradient-to-br from-gold-500 to-gold-600 rounded-full flex items-center justify-center touch-feedback">
                  <span className="text-white font-bold text-xs md:text-sm">{user?.email?.charAt(0).toUpperCase()}</span>
                </div>
              </div>
            </div>
          </header>
          <div className="p-4 md:p-6 lg:p-8 animate-fade-in pt-4 md:pt-6 lg:pt-8">
            <Outlet />
          </div>
        </main>
        <MobileBottomNav />
      </div>
    </SidebarProvider>
  );
};

export default DashboardLayout;