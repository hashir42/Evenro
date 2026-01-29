import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, Users, DollarSign, Package, TrendingUp, Clock, Activity, Wallet } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { BookingDetailDialog } from "@/components/BookingDetailDialog";
import { getDerivedBookingStatus } from "@/lib/utils";

const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [currentBookingsCount, setCurrentBookingsCount] = useState(0);
  const [currentClientsCount, setCurrentClientsCount] = useState(0);
  const [stats, setStats] = useState({
    totalBookings: 0,
    totalClients: 0,
    totalRevenue: 0,
    totalExpenses: 0,
    netProfit: 0,
    recentBookings: [],
  });
  const [trends, setTrends] = useState({
    bookingsTrend: 0,
    clientsTrend: 0,
    revenueTrend: 0,
    profitTrend: 0,
  });
  const [bookingPayments, setBookingPayments] = useState<Record<string, { paid: number; pending: number; total?: number }>>({});
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<any>(null);

  useEffect(() => {
    if (!user) return;

    const fetchStats = async () => {
      // Get current month and previous month date ranges
      const now = new Date();
      const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();
      const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
      const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59).toISOString();

      // Fetch all required data in parallel
      const [
        bookingsRes,
        clientsRes,
        recentRes,
        currentMonthBookings,
        prevMonthBookings,
        currentMonthClients,
        prevMonthClients,
        // Fetch payments and expenses for the current month from accounts
        currentMonthPaymentsData,
        currentMonthExpensesData,
        // Previous month data for trends
        prevMonthPaymentsData,
        prevMonthExpensesData
      ] = await Promise.all([
        // Bookings data
        supabase.from("bookings").select("*", { count: "exact" }).eq("vendor_id", user.id),
        supabase.from("clients").select("*", { count: "exact" }).eq("vendor_id", user.id),
        // Recent bookings
        supabase
          .from("bookings")
          .select("*, clients(name)")
          .eq("vendor_id", user.id)
          .order("created_at", { ascending: false })
          .limit(5),
        // Current month bookings count
        supabase.from("bookings").select("*", { count: "exact" }).eq("vendor_id", user.id).gte("created_at", currentMonthStart).lte("created_at", currentMonthEnd),
        // Previous month bookings count
        supabase.from("bookings").select("*", { count: "exact" }).eq("vendor_id", user.id).gte("created_at", prevMonthStart).lte("created_at", prevMonthEnd),
        // Current month clients count
        supabase.from("clients").select("*", { count: "exact" }).eq("vendor_id", user.id).gte("created_at", currentMonthStart).lte("created_at", currentMonthEnd),
        // Previous month clients count
        supabase.from("clients").select("*", { count: "exact" }).eq("vendor_id", user.id).gte("created_at", prevMonthStart).lte("created_at", prevMonthEnd),
        // Current month payments (from accounts)
        supabase.from("payments").select("amount, payment_type").eq("vendor_id", user.id).gte("payment_date", currentMonthStart).lte("payment_date", currentMonthEnd),
        // Current month expenses (from accounts)
        supabase.from("expenses").select("amount").eq("vendor_id", user.id).gte("date", currentMonthStart).lte("date", currentMonthEnd),
        // Previous month payments (for trends)
        supabase.from("payments").select("amount, payment_type").eq("vendor_id", user.id).gte("payment_date", prevMonthStart).lte("payment_date", prevMonthEnd),
        // Previous month expenses (for trends)
        supabase.from("expenses").select("amount").eq("vendor_id", user.id).gte("date", prevMonthStart).lte("date", prevMonthEnd),
      ]);

      // Calculate revenue (only non-refund payments)
      const currentRevenue = currentMonthPaymentsData.data
        ?.filter((p: any) => p.payment_type !== 'refund')
        .reduce((sum: number, payment: any) => sum + Number(payment.amount || 0), 0) || 0;
      
      const prevRevenue = prevMonthPaymentsData.data
        ?.filter((p: any) => p.payment_type !== 'refund')
        .reduce((sum: number, payment: any) => sum + Number(payment.amount || 0), 0) || 0;

      // Calculate expenses
      const currentExpenses = currentMonthExpensesData.data?.reduce((sum: number, expense: any) => sum + Number(expense.amount || 0), 0) || 0;
      const prevExpenses = prevMonthExpensesData.data?.reduce((sum: number, expense: any) => sum + Number(expense.amount || 0), 0) || 0;
      
      // Calculate net profit
      const netProfit = currentRevenue - currentExpenses;
      const prevProfit = prevRevenue - prevExpenses;
      
      // Calculate monthly trends
      const bookingsCount = currentMonthBookings.count || 0;
      const prevBookingsCount = prevMonthBookings.count || 0;
      const bookingsTrend = prevBookingsCount > 0 ? ((bookingsCount - prevBookingsCount) / prevBookingsCount) * 100 : 0;

      const clientsCount = currentMonthClients.count || 0;
      const prevClientsCount = prevMonthClients.count || 0;
      const clientsTrend = prevClientsCount > 0 ? ((clientsCount - prevClientsCount) / prevClientsCount) * 100 : 0;
      
      const revenueTrend = prevRevenue > 0 ? ((currentRevenue - prevRevenue) / prevRevenue) * 100 : 0;
      const profitTrend = prevProfit !== 0 ? ((netProfit - prevProfit) / Math.abs(prevProfit)) * 100 : 0;

      // Update the state with current month's data
      setCurrentBookingsCount(bookingsCount);
      setCurrentClientsCount(clientsCount);
      
      setStats({
        totalBookings: bookingsCount,       // Current month's bookings
        totalClients: clientsCount,         // Current month's new clients
        totalRevenue: currentRevenue,       // Current month's revenue
        totalExpenses: currentExpenses,     // Current month's expenses
        netProfit: netProfit,               // Current month's net profit
        recentBookings: recentRes.data || [],
      });

      setTrends({
        bookingsTrend,
        clientsTrend,
        revenueTrend,
        profitTrend,
      });

      // Fetch payment data for each recent booking
      if (recentRes.data && recentRes.data.length > 0) {
        const bookingIds = recentRes.data.map((b: any) => b.id);
        // Get all payments and refunds for these bookings
        const { data: allPayments } = await (supabase as any)
          .from("payments")
          .select("booking_id, amount, payment_type, refund_amount")
          .in("booking_id", bookingIds);

        // Calculate total paid and pending for each booking
        const paymentsMap: Record<string, { paid: number; pending: number }> = {};
        
        if (allPayments) {
          bookingIds.forEach((id: string) => {
            const booking = recentRes.data.find((b: any) => b.id === id);
            const bookingPayments = allPayments.filter((p: any) => p.booking_id === id);
            
            // Calculate total payments (excluding refunds)
            const totalPayments = bookingPayments
              .filter((p: any) => p.payment_type !== 'refund')
              .reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0);
              
            // Calculate total refunds (only refund type payments)
            const totalRefunds = bookingPayments
              .filter((p: any) => p.payment_type === 'refund')
              .reduce((sum: number, p: any) => sum + Number(p.refund_amount || p.amount || 0), 0);
            
            // Calculate net paid (payments - refunds, never negative)
            const netPaid = Math.max(0, totalPayments - totalRefunds);
            
            // Calculate pending amount (never negative and never exceeds total amount)
            const totalAmount = Number(booking?.total_amount || 0);
            const pending = Math.max(0, Math.min(totalAmount, totalAmount - netPaid));
            
            paymentsMap[id] = { 
              paid: netPaid, 
              pending: pending,
              total: totalAmount
            };
          });
        } else {
          // If no payments exist, set all to 0
          bookingIds.forEach((id: string) => {
            const booking = recentRes.data.find((b: any) => b.id === id);
            const totalAmount = Number(booking?.total_amount || 0);
            paymentsMap[id] = { 
              paid: 0, 
              pending: totalAmount,
              total: totalAmount
            };
          });
        }
        setBookingPayments(paymentsMap);
      }
    };

    fetchStats();
  }, [user]);

  const fetchFullBookingDetails = async (bookingId: string) => {
    const { data, error } = await supabase
      .from("bookings")
      .select("*, clients(name), packages(name), portfolio_items(title, price), entities(name)")
      .eq("id", bookingId)
      .single();

    if (!error && data) {
      setSelectedBooking(data);
      setDetailDialogOpen(true);
    }
  };

  const handleQuickAction = (action: string) => {
    switch (action) {
      case "new-booking":
        navigate("/bookings");
        break;
      case "add-client":
        navigate("/clients");
        break;
      case "create-package":
        navigate("/packages");
        break;
      case "record-payment":
        navigate("/payments");
        break;
      default:
        break;
    }
  };

  // Get current month and year for display
  const currentDate = new Date();
  const currentMonth = currentDate.toLocaleString('default', { month: 'long' });
  const currentYear = currentDate.getFullYear();

  const statCards = [
    {
      title: `Bookings (${currentMonth})`,
      value: stats.totalBookings,
      icon: Calendar,
      color: "bg-gradient-to-br from-blue-500 to-blue-600",
      trend: `${trends.bookingsTrend > 0 ? '+' : ''}${trends.bookingsTrend.toFixed(1)}%`,
      trendUp: trends.bookingsTrend > 0,
      description: `Bookings in ${currentMonth} ${currentYear}`
    },
    {
      title: `New Clients (${currentMonth})`,
      value: stats.totalClients,
      icon: Users,
      color: "bg-gradient-to-br from-green-500 to-green-600",
      trend: `${trends.clientsTrend > 0 ? '+' : ''}${trends.clientsTrend.toFixed(1)}%`,
      trendUp: trends.clientsTrend > 0,
      description: `New clients in ${currentMonth} ${currentYear}`
    },
    {
      title: `Revenue (${currentMonth})`,
      value: `₹${stats.totalRevenue.toLocaleString()}`,
      icon: DollarSign,
      color: "bg-gradient-to-br from-gold-500 to-gold-600",
      trend: `${trends.revenueTrend > 0 ? '+' : ''}${trends.revenueTrend.toFixed(1)}%`,
      trendUp: trends.revenueTrend > 0,
      description: `Total revenue for ${currentMonth} ${currentYear}`
    },
    {
      title: `Net Profit (${currentMonth})`,
      value: `₹${stats.netProfit.toLocaleString()}`,
      icon: Wallet,
      color: "bg-gradient-to-br from-purple-500 to-purple-600",
      trend: `${trends.profitTrend > 0 ? '+' : ''}${trends.profitTrend.toFixed(1)}%`,
      trendUp: trends.profitTrend > 0,
      description: `Net profit for ${currentMonth} ${currentYear}`
    },
  ];

  return (
    <div className="space-y-4 md:space-y-8 animate-fade-in">
      {/* Welcome Header */}
      <div className="text-center space-y-1 md:space-y-2">
        <h1 className="text-2xl md:text-4xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
          Welcome Back
        </h1>
        <p className="text-muted-foreground text-sm md:text-lg">
          {currentMonth} {currentYear} Business Overview
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
        {statCards.map((stat, index) => (
          <Card
            key={stat.title}
            className="group glass card-hover rounded-2xl border-0 shadow-card overflow-hidden"
            style={{ animationDelay: `${index * 100}ms` }}
          >
            <CardContent className="p-3 md:p-6">
              <div className="flex items-center justify-between mb-2 md:mb-4">
                <div className={`w-8 h-8 md:w-12 md:h-12 ${stat.color} rounded-lg md:rounded-xl flex items-center justify-center shadow-lg`}>
                  <stat.icon className="h-4 w-4 md:h-6 md:w-6 text-white" />
                </div>
                <div className={`text-[10px] md:text-xs px-1.5 md:px-2 py-0.5 md:py-1 rounded-full font-medium ${
                  stat.trendUp ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                }`}>
                  {stat.trend}
                </div>
              </div>
              <div className="space-y-0.5 md:space-y-2">
                <p className="text-[11px] md:text-sm font-medium text-muted-foreground truncate">{stat.title}</p>
                <p className="text-base md:text-2xl font-bold text-foreground truncate">{stat.value}</p>
                <p className="text-[10px] text-muted-foreground/70 truncate hidden md:block">{stat.description}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-8">
        {/* Recent Bookings */}
        <Card className="glass card-hover rounded-xl md:rounded-2xl border-0 shadow-card">
          <CardHeader className="pb-3 md:pb-4 px-4 md:px-6">
            <CardTitle className="flex items-center gap-2 md:gap-3 text-base md:text-xl font-semibold">
              <Activity className="h-4 w-4 md:h-5 md:w-5 text-primary" />
              Recent Bookings
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 md:px-6">
            {stats.recentBookings.length === 0 ? (
              <div className="text-center py-6 md:py-8">
                <Clock className="h-10 w-10 md:h-12 md:w-12 text-muted-foreground/50 mx-auto mb-3 md:mb-4" />
                <p className="text-sm md:text-base text-muted-foreground">No bookings yet</p>
                <p className="text-xs md:text-sm text-muted-foreground/70">Your recent bookings will appear here</p>
              </div>
            ) : (
              <div className="space-y-2 md:space-y-3">
                {stats.recentBookings.map((booking: any) => {
                  const paymentInfo = bookingPayments[booking.id] || { paid: 0, pending: 0 };
                  const derivedStatus = getDerivedBookingStatus(booking, paymentInfo.paid);
                  
                  return (
                    <div
                      key={booking.id}
                      className="group flex items-center justify-between p-3 md:p-4 rounded-lg md:rounded-xl border border-border/50 hover:bg-accent/50 transition-all duration-180 cursor-pointer hover:shadow-md touch-feedback active:scale-[0.98]"
                      onClick={() => fetchFullBookingDetails(booking.id)}
                    >
                      <div className="flex-1 min-w-0 pr-2">
                        <p className="text-sm md:text-base font-medium text-foreground truncate group-hover:text-primary transition-colors">
                          {booking.event_name}
                        </p>
                        <p className="text-xs md:text-sm text-muted-foreground truncate">
                          {booking.clients?.name || "No client"} • {new Date(booking.event_date).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                          {booking.from_time && booking.to_time ? (
                            ` • ${booking.from_time} - ${booking.to_time}`
                          ) : booking.from_time ? (
                            ` • ${booking.from_time}`
                          ) : null}
                        </p>
                        {booking.total_amount > 0 && (
                          <div className="flex gap-2 md:gap-3 text-[10px] md:text-xs mt-1">
                            <div className="flex items-center gap-1">
                              <span className="text-green-600 font-medium">₹{paymentInfo.paid.toLocaleString()}</span>
                              <span className="text-muted-foreground">/</span>
                              <span className="font-medium">₹{paymentInfo.total?.toLocaleString() || '0'}</span>
                            </div>
                            <span className={paymentInfo.pending > 0 ? 'text-red-600' : 'text-green-600'}>
                              {paymentInfo.pending > 0 ? `Pending: ₹${paymentInfo.pending.toLocaleString()}` : 'Fully Paid'}
                            </span>
                          </div>
                        )}
                      </div>
                      <span
                        className={`px-2 md:px-3 py-0.5 md:py-1 rounded-full text-[10px] md:text-xs font-medium transition-all duration-180 whitespace-nowrap ${
                          derivedStatus === "confirmed"
                            ? "bg-green-100 text-green-800 group-hover:bg-green-200"
                            : derivedStatus === "completed"
                            ? "bg-blue-100 text-blue-800 group-hover:bg-blue-200"
                            : derivedStatus === "cancelled"
                            ? "bg-red-100 text-red-800 group-hover:bg-red-200"
                            : "bg-gray-100 text-gray-800 group-hover:bg-gray-200"
                        }`}
                      >
                        {derivedStatus}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card className="glass card-hover rounded-xl md:rounded-2xl border-0 shadow-card">
          <CardHeader className="pb-3 md:pb-4 px-4 md:px-6">
            <CardTitle className="flex items-center gap-2 md:gap-3 text-base md:text-xl font-semibold">
              <TrendingUp className="h-4 w-4 md:h-5 md:w-5 text-primary" />
              Quick Actions
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 md:px-6">
            <div className="grid grid-cols-2 gap-3 md:gap-4">
              <button
                onClick={() => handleQuickAction("new-booking")}
                className="group flex flex-col items-center gap-2 md:gap-3 p-3 md:p-4 rounded-lg md:rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 hover:from-primary/20 hover:to-primary/10 transition-all duration-180 hover:scale-105 touch-feedback active:scale-95"
              >
                <div className="w-9 h-9 md:w-10 md:h-10 bg-primary rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform duration-180">
                  <Calendar className="h-4 w-4 md:h-5 md:w-5 text-primary-foreground" />
                </div>
                <span className="text-xs md:text-sm font-medium text-center">New Booking</span>
              </button>
              <button
                onClick={() => handleQuickAction("add-client")}
                className="group flex flex-col items-center gap-2 md:gap-3 p-3 md:p-4 rounded-lg md:rounded-xl bg-gradient-to-br from-aqua-500/10 to-aqua-500/5 hover:from-aqua-500/20 hover:to-aqua-500/10 transition-all duration-180 hover:scale-105 touch-feedback active:scale-95"
              >
                <div className="w-9 h-9 md:w-10 md:h-10 bg-aqua-500 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform duration-180">
                  <Users className="h-4 w-4 md:h-5 md:w-5 text-white" />
                </div>
                <span className="text-xs md:text-sm font-medium text-center">Add Client</span>
              </button>
              <button
                onClick={() => handleQuickAction("create-package")}
                className="group flex flex-col items-center gap-2 md:gap-3 p-3 md:p-4 rounded-lg md:rounded-xl bg-gradient-to-br from-gold-500/10 to-gold-500/5 hover:from-gold-500/20 hover:to-gold-500/10 transition-all duration-180 hover:scale-105 touch-feedback active:scale-95"
              >
                <div className="w-9 h-9 md:w-10 md:h-10 bg-gold-500 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform duration-180">
                  <Package className="h-4 w-4 md:h-5 md:w-5 text-white" />
                </div>
                <span className="text-xs md:text-sm font-medium text-center">Create Package</span>
              </button>
              <button
                onClick={() => handleQuickAction("record-payment")}
                className="group flex flex-col items-center gap-2 md:gap-3 p-3 md:p-4 rounded-lg md:rounded-xl bg-gradient-to-br from-amber-500/10 to-amber-500/5 hover:from-amber-500/20 hover:to-amber-500/10 transition-all duration-180 hover:scale-105 touch-feedback active:scale-95"
              >
                <div className="w-9 h-9 md:w-10 md:h-10 bg-amber-500 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform duration-180">
                  <DollarSign className="h-4 w-4 md:h-5 md:w-5 text-white" />
                </div>
                <span className="text-xs md:text-sm font-medium text-center">Record Payment</span>
              </button>
            </div>
          </CardContent>
        </Card>
      </div>

      <BookingDetailDialog
        booking={selectedBooking}
        open={detailDialogOpen}
        onOpenChange={setDetailDialogOpen}
        onUpdate={() => {
          const fetchStats = async () => {
            // Get current month and previous month date ranges
            const now = new Date();
            const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
            const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();
            const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
            const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59).toISOString();

            const [
              bookingsRes,
              clientsRes,
              paymentsRes,
              expensesRes,
              recentRes,
              currentMonthBookings,
              prevMonthBookings,
              currentMonthClients,
              prevMonthClients,
              currentMonthPayments,
              prevMonthPayments,
              currentMonthExpenses,
              prevMonthExpenses,
            ] = await Promise.all([
              supabase.from("bookings").select("*", { count: "exact" }).eq("vendor_id", user!.id),
              supabase.from("clients").select("*", { count: "exact" }).eq("vendor_id", user!.id),
              supabase.from("payments").select("amount").eq("vendor_id", user!.id),
              (supabase as any).from("expenses").select("amount").eq("vendor_id", user!.id),
              supabase
                .from("bookings")
                .select("*, clients(name)")
                .eq("vendor_id", user!.id)
                .order("created_at", { ascending: false })
                .limit(5),
              // Current month data
              supabase.from("bookings").select("*", { count: "exact" }).eq("vendor_id", user!.id).gte("created_at", currentMonthStart).lte("created_at", currentMonthEnd),
              // Previous month data
              supabase.from("bookings").select("*", { count: "exact" }).eq("vendor_id", user!.id).gte("created_at", prevMonthStart).lte("created_at", prevMonthEnd),
              supabase.from("clients").select("*", { count: "exact" }).eq("vendor_id", user!.id).gte("created_at", currentMonthStart).lte("created_at", currentMonthEnd),
              supabase.from("clients").select("*", { count: "exact" }).eq("vendor_id", user!.id).gte("created_at", prevMonthStart).lte("created_at", prevMonthEnd),
              supabase.from("payments").select("amount").eq("vendor_id", user!.id).gte("payment_date", currentMonthStart).lte("payment_date", currentMonthEnd),
              supabase.from("payments").select("amount").eq("vendor_id", user!.id).gte("payment_date", prevMonthStart).lte("payment_date", prevMonthEnd),
              (supabase as any).from("expenses").select("amount").eq("vendor_id", user!.id).gte("date", currentMonthStart).lte("date", currentMonthEnd),
              (supabase as any).from("expenses").select("amount").eq("vendor_id", user!.id).gte("date", prevMonthStart).lte("date", prevMonthEnd),
            ]);

            const totalRevenue = paymentsRes.data?.reduce((sum, payment) => sum + Number(payment.amount), 0) || 0;
            const totalExpenses = expensesRes.data?.reduce((sum, expense) => sum + Number(expense.amount), 0) || 0;
            const netProfit = totalRevenue - totalExpenses;

            // Calculate monthly trends
            const currentBookingsCount = currentMonthBookings.count || 0;
            const prevBookingsCount = prevMonthBookings.count || 0;
            const bookingsTrend = prevBookingsCount > 0 ? ((currentBookingsCount - prevBookingsCount) / prevBookingsCount) * 100 : 0;

            const currentClientsCount = currentMonthClients.count || 0;
            const prevClientsCount = prevMonthClients.count || 0;
            const clientsTrend = prevClientsCount > 0 ? ((currentClientsCount - prevClientsCount) / prevClientsCount) * 100 : 0;

            const currentRevenue = currentMonthPayments.data?.reduce((sum, payment) => sum + Number(payment.amount), 0) || 0;
            const prevRevenue = prevMonthPayments.data?.reduce((sum, payment) => sum + Number(payment.amount), 0) || 0;
            const revenueTrend = prevRevenue > 0 ? ((currentRevenue - prevRevenue) / prevRevenue) * 100 : 0;

            const currentExpenses = currentMonthExpenses.data?.reduce((sum, expense) => sum + Number(expense.amount), 0) || 0;
            const prevExpenses = prevMonthExpenses.data?.reduce((sum, expense) => sum + Number(expense.amount), 0) || 0;
            const currentProfit = currentRevenue - currentExpenses;
            const prevProfit = prevRevenue - prevExpenses;
            const profitTrend = prevProfit !== 0 ? ((currentProfit - prevProfit) / Math.abs(prevProfit)) * 100 : 0;

            setStats({
              totalBookings: bookingsRes.count || 0,
              totalClients: clientsRes.count || 0,
              totalRevenue,
              totalExpenses,
              netProfit,
              recentBookings: recentRes.data || [],
            });

            setTrends({
              bookingsTrend,
              clientsTrend,
              revenueTrend,
              profitTrend,
            });

            // Fetch payment data for each recent booking
            if (recentRes.data && recentRes.data.length > 0) {
              const bookingIds = recentRes.data.map((b: any) => b.id);
              // Note: payment_type and refund_amount exist in DB but types need regeneration
              const { data: allPayments } = await (supabase as any)
                .from("payments")
                .select("booking_id, amount, payment_type, refund_amount")
                .in("booking_id", bookingIds);

              // Calculate total paid and pending for each booking
              const paymentsMap: Record<string, { paid: number; pending: number }> = {};
              if (allPayments) {
                bookingIds.forEach((id: string) => {
                  const booking = recentRes.data.find((b: any) => b.id === id);
                  const bookingPayments = allPayments.filter((p) => p.booking_id === id);
                  const totalPaid = bookingPayments
                    .filter((p) => p.payment_type !== 'refund')
                    .reduce((sum, p) => sum + Number(p.amount || 0), 0) -
                    bookingPayments
                    .filter((p) => p.payment_type === 'refund')
                    .reduce((sum, p) => sum + Number(p.refund_amount || 0), 0);
                  const totalAmount = Number(booking?.total_amount || 0);
                  const pending = Math.max(0, totalAmount - totalPaid);
                  paymentsMap[id] = { paid: totalPaid, pending };
                });
              }
              setBookingPayments(paymentsMap);
            }
          };
          fetchStats();
        }}
      />
    </div>
  );
};

export default Dashboard;