import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, LineChart, Line, ComposedChart } from "recharts";
import { Calendar, Users, DollarSign, Package, TrendingUp, TrendingDown, Activity, CalendarCheck, CalendarPlus, CheckCircle } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, subMonths, startOfMonth, endOfMonth, startOfYear, endOfYear, eachMonthOfInterval, getYear, parseISO, isWithinInterval } from "date-fns";

const COLORS = ["#2563eb", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];

// Custom hook to handle reports data fetching and filtering
const useReportsData = ({ user, viewMode, selectedYear, selectedMonth, selectedEntityIds }: { 
  user: any; 
  viewMode: 'monthly' | 'yearly'; 
  selectedYear: number; 
  selectedMonth: number;
  selectedEntityIds: string[];
}) => {
  const [stats, setStats] = useState({
    totalBookings: 0,
    totalClients: 0,
    totalRevenue: 0,
    totalExpenses: 0,
    monthlyRevenue: [] as any[],
    monthlyExpenses: [] as any[],
    bookingsByMonth: [] as any[],
    bookingsByStatus: [] as any[],
    revenuePerPackage: [] as any[],
    upcomingBookings: 0,
    completedBookings: 0,
    revenueGrowth: 0,
    clientsByMonth: [] as any[],
  });

  const [entities, setEntities] = useState<any[]>([]);

  // This function will be called to update the stats
  const updateStats = useCallback((newStats: Partial<typeof stats>) => {
    setStats(prev => ({
      ...prev,
      ...newStats,
      isLoading: false
    }));
  }, []);

  const fetchReportsData = useCallback(async () => {
    if (!user) return;
    
    // Set loading state
    setStats(prev => ({
      ...prev,
      isLoading: true
    }));

    // Calculate date range based on view mode
    let startDate: Date, endDate: Date;
    
    if (viewMode === 'monthly') {
      startDate = new Date(selectedYear, selectedMonth - 1, 1);
      endDate = new Date(selectedYear, selectedMonth, 0);
    } else {
      // Yearly view
      startDate = new Date(selectedYear, 0, 1);
      endDate = new Date(selectedYear, 11, 31);
    }

    // Format dates for Supabase query
    const startDateStr = startDate.toISOString();
    const endDateStr = endDate.toISOString();

    try {
      // Base query for bookings with entity filter if any entities are selected
      let bookingsQuery = supabase
        .from("bookings")
        .select("*, packages(name), entities!inner(*)")
        .eq("vendor_id", user.id);

      // Apply entity filter if any entities are selected
      if (selectedEntityIds.length > 0) {
        bookingsQuery = bookingsQuery.in('entity_id', selectedEntityIds);
      }

      // Apply date range filter
      bookingsQuery = bookingsQuery.or(
        `and(created_at.gte.${startDateStr},created_at.lte.${endDateStr}),` +
        `and(event_date.gte.${startDateStr},event_date.lte.${endDateStr})`
      );

      // Get all clients for the vendor (matching the Clients page behavior)
      console.log('Fetching total clients with params:', {
        vendor_id: user.id,
        selectedEntityIds,
        viewMode,
        selectedYear,
        selectedMonth
      });

      // Total clients query with date range filtering
      let totalClientsQuery = supabase
        .from("clients")
        .select("*", { count: "exact" })
        .eq("vendor_id", user.id)
        .gte("created_at", startDateStr)
        .lte("created_at", endDateStr)
        .order("created_at", { ascending: false });
      
      console.log('Total clients query date range:', {
        start: startDateStr,
        end: endDateStr,
        viewMode,
        selectedYear,
        selectedMonth
      });

      // Get clients for date range (for other potential use)
      let clientsQuery = supabase
        .from("clients")
        .select("*", { count: "exact" })
        .eq("vendor_id", user.id)
        .gte("created_at", startDateStr)
        .lte("created_at", endDateStr)
        .order("created_at", { ascending: false });

      // Base query for payments with entity filter if any entities are selected
      let paymentsQuery = supabase
        .from("payments")
        .select("amount, payment_date, payment_type, bookings!inner(packages(name), entity_id)")
        .eq("vendor_id", user.id);

      // Apply entity filter for payments if any entities are selected
      if (selectedEntityIds.length > 0) {
        paymentsQuery = paymentsQuery.in('bookings.entity_id', selectedEntityIds);
      }
      paymentsQuery = paymentsQuery
        .gte("payment_date", startDateStr)
        .lte("payment_date", endDateStr);

      // Base query for expenses with entity filter if any entities are selected
      let expensesQuery = supabase
        .from("expenses")
        .select("amount, date, entity_id")
        .eq("vendor_id", user.id);

      // Apply entity filter for expenses if any entities are selected
      if (selectedEntityIds.length > 0) {
        expensesQuery = expensesQuery.in('entity_id', selectedEntityIds);
      }
      expensesQuery = expensesQuery
        .gte("date", startDateStr)
        .lte("date", endDateStr);

      // Execute queries in parallel
      console.log('Executing all queries...');
      const [
        bookingsRes, 
        clientsRes, 
        paymentsRes, 
        expensesRes, 
        totalClientsRes
      ] = await Promise.all([
        bookingsQuery,
        clientsQuery,
        paymentsQuery,
        expensesQuery,
        totalClientsQuery
      ]);

      // Log the raw responses
      console.log('Raw totalClientsRes:', {
        data: totalClientsRes?.data,
        count: totalClientsRes?.count,
        error: totalClientsRes?.error,
        status: totalClientsRes?.status,
        statusText: totalClientsRes?.statusText
      });

      const bookings = bookingsRes.data || [];
      const payments = paymentsRes.data || [];
      const expenses = expensesRes.data || [];
      
      // Debug logging
      console.log('Total clients response:', totalClientsRes);
      console.log('Total clients count:', totalClientsRes.count);
      console.log('Total clients data length:', totalClientsRes.data?.length);
      
      // Debug: Log bookings and their statuses
      console.log('All bookings:', bookings);
      console.log('Booking statuses:', bookings.map(b => b.status));
      console.log('Completed bookings:', bookings.filter(b => b.status && b.status.toLowerCase().includes('complete')));

      // Process data...
      const totalRevenue = payments
        .filter(p => p.payment_type !== 'refund')
        .reduce((sum, p) => sum + Number(p.amount || 0), 0);

      const totalExpenses = expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
      const netProfit = totalRevenue - totalExpenses;

      // Helper function to get derived status (same as in Bookings.tsx)
      const getDerivedStatus = (booking: any) => {
        // If booking is cancelled, return cancelled
        if (booking.status === 'cancelled') return 'cancelled';
        
        // Check if event_date exists
        if (!booking.event_date) return 'confirmed';
        
        const now = new Date();
        const eventDate = new Date(booking.event_date);
        
        // If event date is in the future, it's confirmed
        if (eventDate > now) return 'confirmed';
        
        // If there's no end time, consider it completed if the date has passed
        if (!booking.to_time) {
          return 'completed';
        }
        
        // Create a date object for the end time of the event
        const [hours, minutes] = booking.to_time.split(':').map(Number);
        const endTime = new Date(eventDate);
        endTime.setHours(hours, minutes, 0, 0);
        
        // If current time is after the end time, it's completed
        if (now >= endTime) return 'completed';
        
        // If we're on the event date but before the end time, it's still confirmed
        return 'confirmed';
      };

      // Group bookings by status
      const statusCounts = {
        confirmed: 0,
        completed: 0,
        cancelled: 0
      };

      // Count bookings by their derived status
      bookings.forEach(booking => {
        const status = getDerivedStatus(booking);
        statusCounts[status] = (statusCounts[status] || 0) + 1;
      });

      // Convert to array for the chart
      const bookingsByStatus = [
        { name: 'Confirmed', value: statusCounts.confirmed },
        { name: 'Completed', value: statusCounts.completed },
        { name: 'Cancelled', value: statusCounts.cancelled }
      ].filter(item => item.value > 0); // Only include statuses with count > 0

      // Group revenue by package
      const revenueByPackage: Record<string, number> = {};
      
      // First, create a map of booking IDs to their package names
      const bookingPackageMap = new Map();
      bookings.forEach(booking => {
        if (booking.package_id && booking.packages?.name) {
          bookingPackageMap.set(booking.id, booking.packages.name);
        }
      });
      
      // Process payments and group by package
      payments
        .filter(p => p.payment_type !== 'refund' && p.booking_id)
        .forEach(payment => {
          // Try to get package name from the bookingPackageMap first
          let packageName = bookingPackageMap.get(payment.booking_id);
          
          // If not found in map, try to get from payment data
          if (!packageName) {
            packageName = payment.bookings?.packages?.name || 'Other';
          }
          
          // If still no package name, use booking ID as fallback
          if (!packageName) {
            packageName = `Booking #${payment.booking_id}`;
          }
          
          revenueByPackage[packageName] = (revenueByPackage[packageName] || 0) + Number(payment.amount || 0);
        });

      // Convert to array and sort by value (descending)
      const revenuePerPackage = Object.entries(revenueByPackage)
        .map(([name, value]) => ({
          name,
          value,
          amount: value // Add amount as an alias for the tooltip
        }))
        .sort((a, b) => b.value - a.value);

      // Calculate monthly data
      const months = eachMonthOfInterval({
        start: startDate,
        end: endDate,
      });

      const monthlyData = months.map(month => {
        const monthKey = format(month, 'MMM yyyy');
        const monthStart = startOfMonth(month);
        const monthEnd = endOfMonth(month);
        
        // Get payments for this month
        const monthlyPayments = payments.filter(p => {
          const paymentDate = new Date(p.payment_date);
          return isWithinInterval(paymentDate, { start: monthStart, end: monthEnd });
        });

        // Get expenses for this month
        const monthlyExpenses = expenses.filter(e => {
          const expenseDate = new Date(e.date);
          return isWithinInterval(expenseDate, { start: monthStart, end: monthEnd });
        });

        // Get bookings for this month (by event date)
        const monthlyBookings = bookings.filter(b => {
          const eventDate = new Date(b.event_date);
          return isWithinInterval(eventDate, { start: monthStart, end: monthEnd });
        });

        const revenue = monthlyPayments
          .filter(p => p.payment_type !== 'refund')
          .reduce((sum, p) => sum + Number(p.amount || 0), 0);

        const expensesTotal = monthlyExpenses
          .reduce((sum, e) => sum + Number(e.amount || 0), 0);

        return {
          month: monthKey,
          revenue,
          expenses: expensesTotal,
          profit: revenue - expensesTotal,
          count: monthlyBookings.length,
        };
      });

      // Update state with processed data
      // Prepare data for charts
      const bookingsByMonth = monthlyData.map(month => ({
        month: month.month,
        count: month.count
      }));

      // Prepare monthly revenue and expenses data
      const monthlyRevenue = monthlyData.map(month => ({
        month: month.month,
        revenue: month.revenue
      }));

      // Prepare income vs expense data
      const incomeVsExpense = monthlyData.map(month => ({
        month: month.month,
        Income: month.revenue,
        Expenses: month.expenses,
        Profit: month.profit
      }));

      // Calculate total clients - ensure we have a valid count
      let totalClients = 0;
      
      console.log('Processing total clients response...');
      console.log('Response has error?', !!totalClientsRes.error);
      console.log('Response data length:', totalClientsRes.data?.length);
      console.log('Response count:', totalClientsRes.count);
      if (totalClientsRes.error) {
        console.error('Error fetching total clients:', totalClientsRes.error);
        // If there was an error with the count, try to use data length if available
        if (totalClientsRes.data) {
          totalClients = totalClientsRes.data.length;
        }
      } else {
        // Use count if available, otherwise use data length
        totalClients = totalClientsRes.count ?? totalClientsRes.data?.length ?? 0;
      }
      console.log('Using count from response:', totalClients);

      console.log('Final total clients count:', totalClients);

      // Update stats with the new data
      updateStats({
        totalBookings: bookings.length,
        totalClients,
        totalRevenue,
        totalExpenses,
        monthlyRevenue,
        monthlyExpenses: incomeVsExpense,
        bookingsByMonth,
        bookingsByStatus,
        revenuePerPackage,
        upcomingBookings: bookings.filter(b => new Date(b.event_date) > new Date()).length,
        // Count events that have already happened as completed
        completedBookings: bookings.filter(b => {
          const eventDate = new Date(b.event_date);
          return eventDate < new Date(); // Count past events as completed
        }).length,
        revenueGrowth: 0, // You can implement growth calculation if needed
        clientsByMonth: [] // You can implement this if needed
      });
    } catch (error) {
      console.error('Error fetching reports data:', error);
    }
  }, [user, viewMode, selectedYear, selectedMonth, selectedEntityIds, updateStats]);

  useEffect(() => {
    fetchReportsData();
  }, [fetchReportsData, selectedEntityIds]);

  return stats;
};

const Reports = () => {
  const { user } = useAuth();
  const [viewMode, setViewMode] = useState<"monthly" | "yearly">("monthly");
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [selectedEntityIds, setSelectedEntityIds] = useState<string[]>([]);
  const [entities, setEntities] = useState<any[]>([]);
  
  // Generate years for dropdown (last 5 years and next year)
  const availableYears = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 7 }, (_, i) => currentYear - 5 + i);
  }, []);

  // Get months for the selected year
  const months = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => ({
      value: i + 1,
      label: new Date(selectedYear, i, 1).toLocaleString('default', { month: 'long' })
    }));
  }, [selectedYear]);

  // Fetch entities for the dropdown
  const fetchEntities = useCallback(async () => {
    if (!user) return;
    
    const { data, error } = await supabase
      .from('entities')
      .select('*')
      .eq('vendor_id', user.id)
      .order('name');
      
    if (error) {
      console.error('Error fetching entities:', error);
      return;
    }
    
    const entitiesData = data || [];
    setEntities(entitiesData);
    
    // Select all entities by default if none are selected
    if (entitiesData.length > 0 && selectedEntityIds.length === 0) {
      setSelectedEntityIds(entitiesData.map((e: any) => e.id));
    }
  }, [user, selectedEntityIds.length]);

  useEffect(() => {
    fetchEntities();
  }, [fetchEntities]);

  // Get reports data using our custom hook
  const stats = useReportsData({
    user,
    viewMode,
    selectedYear,
    selectedMonth,
    selectedEntityIds
  });

  useEffect(() => {
    if (user) {
      fetchReportsData();
    }
  }, [user]);

  const fetchReportsData = async () => {
    const [bookingsRes, clientsRes, paymentsRes, expensesRes] = await Promise.all([
      supabase.from("bookings").select("*, packages(name)").eq("vendor_id", user!.id),
      supabase.from("clients").select("*", { count: "exact" }).eq("vendor_id", user!.id),
      supabase.from("payments").select("amount, payment_date, payment_type").eq("vendor_id", user!.id),
      supabase.from("expenses").select("amount").eq("vendor_id", user!.id),
    ]);

    const bookings = bookingsRes.data || [];
    const payments = paymentsRes.data || [];
    const expenses = expensesRes.data || [];

    // Total Revenue - exclude refunds (same logic as Accounts page)
    const totalRevenue = payments
      .filter(p => p.payment_type !== 'refund')
      .reduce((sum, p) => sum + Number(p.amount), 0);

    // Total Expenses (same logic as Accounts page)
    const totalExpenses = expenses.reduce((sum, e) => sum + Number(e.amount), 0);

    // Bookings by Status
    const statusCounts = bookings.reduce((acc: any, booking) => {
      acc[booking.status] = (acc[booking.status] || 0) + 1;
      return acc;
    }, {});

    const bookingsByStatus = Object.entries(statusCounts).map(([status, count]) => ({
      name: status.charAt(0).toUpperCase() + status.slice(1),
      value: count,
    }));

    // Monthly Revenue (last 6 months) - Dynamic
    const monthlyData: any = {};
    const now = new Date();
    
    // Initialize last 6 months with year-month keys
    for (let i = 5; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const displayMonth = date.toLocaleString("default", { month: "short", year: "numeric" });
      monthlyData[monthKey] = { display: displayMonth, revenue: 0 };
    }

    // Calculate 6 months ago date for filtering
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

    payments.forEach((payment) => {
      // Exclude refunds from monthly revenue
      if (payment.payment_type === 'refund') return;
      const date = new Date(payment.payment_date);
      
      // Only include payments from last 6 months
      if (date >= sixMonthsAgo) {
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        if (monthKey in monthlyData) {
          monthlyData[monthKey].revenue += Number(payment.amount);
        }
      }
    });

    const monthlyRevenue = Object.entries(monthlyData).map(([key, data]: [string, any]) => ({
      month: data.display,
      revenue: data.revenue,
    }));

    // Bookings by Month (last 6 months) - Dynamic
    const bookingsMonthlyMap: any = {};
    
    // Initialize last 6 months with year-month keys
    for (let i = 5; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const displayMonth = date.toLocaleString("default", { month: "short", year: "numeric" });
      bookingsMonthlyMap[monthKey] = { display: displayMonth, count: 0 };
    }
    
    bookings.forEach((b) => {
      const d = new Date(b.event_date);
      
      // Only include bookings from last 6 months
      if (d >= sixMonthsAgo) {
        const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        if (monthKey in bookingsMonthlyMap) {
          bookingsMonthlyMap[monthKey].count += 1;
        }
      }
    });
    
    const bookingsByMonth = Object.entries(bookingsMonthlyMap).map(([key, data]: [string, any]) => ({ 
      month: data.display, 
      count: data.count 
    }));

    // Revenue per Package (sum booking total_amount by package)
    const revenuePerPackageMap: any = {};
    bookings.forEach((booking) => {
      const pkgName = booking.packages?.name || "Unassigned";
      const amt = Number((booking as any).total_amount || 0);
      revenuePerPackageMap[pkgName] = (revenuePerPackageMap[pkgName] || 0) + amt;
    });
    const revenuePerPackage = Object.entries(revenuePerPackageMap)
      .map(([name, amount]) => ({ name, amount }))
      .sort((a: any, b: any) => b.amount - a.amount)
      .slice(0, 8);

    // Upcoming and completed bookings
    const today = new Date();
    const upcomingBookings = bookings.filter((b) => new Date(b.event_date) >= today && b.status !== "cancelled").length;
    const completedBookings = bookings.filter((b) => b.status === "completed").length;

    // Revenue growth (compare last month vs this month) - exclude refunds
    const thisMonth = payments.filter((p) => {
      if (p.payment_type === 'refund') return false;
      const date = new Date(p.payment_date);
      return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
    }).reduce((sum, p) => sum + Number(p.amount), 0);

    const lastMonth = payments.filter((p) => {
      if (p.payment_type === 'refund') return false;
      const date = new Date(p.payment_date);
      const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1);
      return date.getMonth() === lastMonthDate.getMonth() && date.getFullYear() === lastMonthDate.getFullYear();
    }).reduce((sum, p) => sum + Number(p.amount), 0);

    const revenueGrowth = lastMonth > 0 ? ((thisMonth - lastMonth) / lastMonth) * 100 : 0;

    setStats({
      totalBookings: bookings.length,
      totalClients: clientsRes.count || 0,
      totalRevenue,
      totalExpenses,
      monthlyRevenue,
      bookingsByMonth,
      bookingsByStatus,
      revenuePerPackage,
      upcomingBookings,
      completedBookings,
      revenueGrowth,
      clientsByMonth: [],
    });
  };

  // Exports
  const exportToCSV = () => {
    const datasets = [
      { name: "MonthlyRevenue", rows: stats.monthlyRevenue, headers: ["month", "revenue"] },
      { name: "BookingsByMonth", rows: stats.bookingsByMonth, headers: ["month", "count"] },
      { name: "RevenuePerPackage", rows: stats.revenuePerPackage, headers: ["name", "amount"] },
      { name: "TopPackages", rows: stats.topPackages, headers: ["name", "bookings"] },
    ];

    const zipParts: string[] = [];
    datasets.forEach(({ name, rows, headers }) => {
      const headerLine = headers.join(",");
      const bodyLines = rows.map((r: any) => headers.map((h) => JSON.stringify(r[h] ?? "")).join(","));
      const csv = [headerLine, ...bodyLines].join("\n");
      // Separate files using a section marker so user can copy out; or trigger multiple downloads
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${name}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    });
  };

  // Helper function to format currency values with Indian numbering system
  const formatCurrency = (num: number | string): string => {
    const number = typeof num === 'string' ? parseFloat(num) || 0 : num;
    return 'Rs. ' + number.toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
      useGrouping: true
    });
  };

  // Helper function to format numbers with Indian numbering system
  const formatNumber = (num: number | string): string => {
    const number = typeof num === 'string' ? parseFloat(num) || 0 : num;
    return number.toLocaleString('en-IN', {
      maximumFractionDigits: 0,
      useGrouping: true
    });
  };

  const exportToPDF = async () => {
    // Initialize PDF with proper font handling
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });
    
    // Set default font that supports Unicode
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 15;
    let y = 20;
    
    // Add header with proper font
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42); // slate-900
    
    // Draw title
    doc.text('Business Analytics Report', margin, y);
    
    // Add generation date
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139); // slate-500
    
    // Format date without using toLocaleDateString which might cause issues in PDF
    const now = new Date();
    const formattedDate = `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    
    doc.text(`Generated on: ${formattedDate}`, pageWidth - margin, y, { 
      align: 'right'
    });
    
    y += 15;
    
    // Add summary section
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text('Summary', margin, y);
    y += 8;
    
    // Summary metrics with proper number formatting
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const summaryData = [
      { 
        label: 'Total Bookings', 
        value: formatNumber(stats.totalBookings)
      },
      { 
        label: 'Total Clients', 
        value: formatNumber(stats.totalClients)
      },
      { 
        label: 'Total Revenue', 
        value: formatCurrency(stats.totalRevenue)
      },
      { 
        label: 'Total Expenses', 
        value: formatCurrency(stats.totalExpenses)
      },
      { 
        label: 'Upcoming Bookings', 
        value: formatNumber(stats.upcomingBookings)
      },
      { 
        label: 'Completed Bookings', 
        value: formatNumber(stats.completedBookings)
      }
    ];
    
    // Draw summary boxes
    const boxWidth = (pageWidth - (margin * 3)) / 2;
    let x = margin;
    let rowY = y;
    
    summaryData.forEach((item, index) => {
      if (index > 0 && index % 2 === 0) {
        x = margin;
        rowY += 15;
      } else if (index > 0) {
        x = margin + boxWidth + margin;
      }
      
      // Draw box
      doc.setDrawColor(226, 232, 240); // slate-200
      doc.setFillColor(248, 250, 252); // slate-50
      doc.roundedRect(x, rowY, boxWidth, 15, 2, 2, 'FD');
      
      // Add text
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 41, 59); // slate-800
      doc.text(item.label, x + 10, rowY + 5.5);
      
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42); // slate-900
      const textWidth = doc.getTextWidth(item.value);
      doc.text(item.value, x + boxWidth - 10 - textWidth, rowY + 5.5);
    });
    
    y = rowY + 25;
    
    // Add page footer
    const addPageFooter = () => {
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(100, 116, 139); // slate-500
        doc.text(
          `Page ${i} of ${pageCount}`,
          pageWidth / 2,
          doc.internal.pageSize.getHeight() - 10,
          { align: 'center' }
        );
      }
    };
    
    // Add Monthly Revenue table
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text('Monthly Revenue', margin, y, { encoding: 'UTF-8' });
    y += 10;
    
    // Format monthly revenue data with proper number formatting
    const formattedMonthlyRevenue = stats.monthlyRevenue.map(r => {
      const amount = Number(r.revenue) || 0;
      return {
        month: r.month,
        revenue: amount.toLocaleString('en-IN', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
          useGrouping: true
        })
      };
    });
    
    autoTable(doc, {
      startY: y,
      head: [['Month', 'Revenue (Rs.)']],
      body: formattedMonthlyRevenue.map(r => [r.month, `Rs. ${r.revenue}`]),
      didParseCell: (data) => {
        // Right-align and format numbers in the second column
        if (data.column.index === 1) {
          data.cell.styles.halign = 'right';
          // Add thousand separators if not already present
          if (typeof data.cell.raw === 'number') {
            data.cell.text = data.cell.raw.toLocaleString('en-IN');
          }
        }
      },
      headStyles: {
        fillColor: [15, 23, 42], // slate-900
        textColor: 255,
        fontStyle: 'bold',
        fontSize: 9,
        font: 'helvetica',
        fontStyle: 'bold',
        textColor: [255, 255, 255],
        halign: 'left',
        valign: 'middle',
        cellPadding: 3,
        lineWidth: 0.5,
        lineColor: [15, 23, 42],
        fillColor: [15, 23, 42]
      },
      bodyStyles: {
        textColor: [30, 41, 59], // slate-800
        fontSize: 9,
        cellPadding: 3,
        font: 'helvetica',
        lineWidth: 0.5,
        lineColor: [226, 232, 240],
        valign: 'middle'
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252] // slate-50
      },
      margin: { top: y, right: margin, bottom: 20, left: margin },
      tableWidth: 'auto',
      theme: 'grid',
      styles: {
        lineColor: [226, 232, 240], // slate-200
        lineWidth: 0.5,
        font: 'helvetica',
        fontSize: 9,
        cellPadding: 3,
        overflow: 'linebreak',
        halign: 'left',
        valign: 'middle'
      },
      headStyles: {
        fillColor: [15, 23, 42],
        textColor: 255,
        fontStyle: 'bold',
        fontSize: 9,
        font: 'helvetica',
        fontStyle: 'bold',
        textColor: [255, 255, 255],
        halign: 'left',
        valign: 'middle',
        cellPadding: 3,
        lineWidth: 0.5,
        lineColor: [15, 23, 42],
        fillColor: [15, 23, 42]
      },
      columnStyles: {
        0: { cellWidth: 'auto', halign: 'left' },
        1: { cellWidth: 'auto', halign: 'right' }
      }
    });
    
    // Add Bookings by Month table on a new page if needed
    const afterFirstTable = (doc as any).lastAutoTable.finalY + 10;
    if (afterFirstTable > doc.internal.pageSize.getHeight() - 50) {
      doc.addPage();
      y = 20;
    } else {
      y = afterFirstTable;
    }
    
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Bookings by Month', margin, y);
    y += 10;
    
    // Format bookings by month data
    const formattedBookingsByMonth = stats.bookingsByMonth.map(r => ({
      month: r.month,
      count: (Number(r.count) || 0).toLocaleString('en-IN', {
        maximumFractionDigits: 0,
        useGrouping: true
      })
    }));
    
    autoTable(doc, {
      startY: y,
      head: [['Month', 'Number of Bookings']],
      body: formattedBookingsByMonth.map(r => [r.month, r.count]),
      didParseCell: (data) => {
        // Right-align and format numbers in the second column
        if (data.column.index === 1) {
          data.cell.styles.halign = 'right';
        }
      },
      headStyles: {
        fillColor: [15, 23, 42],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 9,
        font: 'helvetica',
        halign: 'left',
        valign: 'middle',
        cellPadding: 3,
        lineWidth: 0.5,
        lineColor: [15, 23, 42]
      },
      bodyStyles: {
        textColor: [30, 41, 59],
        fontSize: 9,
        cellPadding: 3,
        font: 'helvetica',
        lineWidth: 0.5,
        valign: 'middle'
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252]
      },
      margin: { top: y, right: margin, bottom: 20, left: margin },
      tableWidth: 'auto',
      theme: 'grid',
      styles: {
        lineColor: [226, 232, 240],
        lineWidth: 0.5,
        font: 'helvetica',
        fontSize: 9,
        cellPadding: 3,
        overflow: 'linebreak',
        halign: 'left',
        valign: 'middle'
      },
      columnStyles: {
        0: { cellWidth: 'auto', halign: 'left' },
        1: { cellWidth: 'auto', halign: 'right' }
      }
    });
    
    // Add Bookings by Status table on a new page if needed
    const afterSecondTable = (doc as any).lastAutoTable.finalY + 10;
    if (afterSecondTable > doc.internal.pageSize.getHeight() - 50) {
      doc.addPage();
      y = 20;
    } else {
      y = afterSecondTable;
    }
    
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Bookings by Status', margin, y);
    y += 10;
    
    // Format bookings by status data
    const formattedBookingsByStatus = stats.bookingsByStatus.map(s => ({
      status: s.name,
      count: s.value.toLocaleString('en-IN', {
        maximumFractionDigits: 0,
        useGrouping: true
      })
    }));
    
    autoTable(doc, {
      startY: y,
      head: [['Status', 'Number of Bookings']],
      body: formattedBookingsByStatus.map(s => [s.status, s.count]),
      didParseCell: (data) => {
        // Right-align the count column
        if (data.column.index === 1) {
          data.cell.styles.halign = 'right';
        }
      },
      headStyles: {
        fillColor: [15, 23, 42],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 9,
        font: 'helvetica',
        halign: 'left',
        valign: 'middle',
        cellPadding: 3,
        lineWidth: 0.5,
        lineColor: [15, 23, 42]
      },
      bodyStyles: {
        textColor: [30, 41, 59],
        fontSize: 9,
        cellPadding: 3,
        font: 'helvetica',
        lineWidth: 0.5,
        valign: 'middle'
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252]
      },
      margin: { top: y, right: margin, bottom: 20, left: margin },
      tableWidth: 'auto',
      theme: 'grid',
      styles: {
        lineColor: [226, 232, 240],
        lineWidth: 0.5,
        font: 'helvetica',
        fontSize: 9,
        cellPadding: 3,
        overflow: 'linebreak',
        halign: 'left',
        valign: 'middle'
      },
      columnStyles: {
        0: { cellWidth: 'auto', halign: 'left' },
        1: { cellWidth: 'auto', halign: 'right' }
      }
    });
    
    // Add Income vs Expenses table on a new page if needed
    const afterThirdTable = (doc as any).lastAutoTable.finalY + 10;
    if (afterThirdTable > doc.internal.pageSize.getHeight() - 50) {
      doc.addPage();
      y = 20;
    } else {
      y = afterThirdTable;
    }
    
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Income vs Expenses', margin, y);
    y += 10;
    
    // Format income vs expenses data
    const formattedIncomeVsExpenses = 'monthlyExpenses' in stats ? 
      (stats.monthlyExpenses as any[]).map(item => ({
        month: item.month,
        income: item.Income ? Number(item.Income).toLocaleString('en-IN', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
          useGrouping: true
        }) : '0.00',
        expenses: item.Expenses ? Number(item.Expenses).toLocaleString('en-IN', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
          useGrouping: true
        }) : '0.00',
        profit: item.Profit ? Number(item.Profit).toLocaleString('en-IN', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
          useGrouping: true
        }) : '0.00'
      })) : [];
    
    autoTable(doc, {
      startY: y,
      head: [['Month', 'Income (Rs.)', 'Expenses (Rs.)', 'Profit (Rs.)']],
      body: formattedIncomeVsExpenses.map(item => [
        item.month, 
        `Rs. ${item.income}`, 
        `Rs. ${item.expenses}`, 
        `Rs. ${item.profit}`
      ]),
      didParseCell: (data) => {
        // Right-align the numeric columns
        if ([1, 2, 3].includes(data.column.index)) {
          data.cell.styles.halign = 'right';
        }
      },
      headStyles: {
        fillColor: [15, 23, 42],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8,
        font: 'helvetica',
        halign: 'left',
        valign: 'middle',
        cellPadding: 3,
        lineWidth: 0.5,
        lineColor: [15, 23, 42]
      },
      bodyStyles: {
        textColor: [30, 41, 59],
        fontSize: 8,
        cellPadding: 3,
        font: 'helvetica',
        lineWidth: 0.5,
        valign: 'middle'
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252]
      },
      margin: { top: y, right: margin, bottom: 20, left: margin },
      tableWidth: 'auto',
      theme: 'grid',
      styles: {
        lineColor: [226, 232, 240],
        lineWidth: 0.5,
        font: 'helvetica',
        fontSize: 8,
        cellPadding: 3,
        overflow: 'linebreak',
        halign: 'left',
        valign: 'middle'
      },
      columnStyles: {
        0: { cellWidth: 'auto', halign: 'left' },
        1: { cellWidth: 'auto', halign: 'right' }
      }
    });
    
    // Add footer to all pages
    addPageFooter();
    
    // Save the PDF
    doc.save(`business-report-${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const statCards = [
    {
      title: "Total Bookings",
      value: stats.totalBookings.toLocaleString('en-IN'),
      icon: Calendar,
      color: "text-blue-600",
      bgColor: "bg-blue-100",
    },
    {
      title: "Total Clients",
      value: stats.totalClients.toLocaleString('en-IN'),
      icon: Users,
      color: "text-green-600",
      bgColor: "bg-green-100",
    },
    {
      title: "Total Revenue",
      value: `₹${stats.totalRevenue.toLocaleString('en-IN')}`,
      icon: DollarSign,
      color: "text-yellow-600",
      bgColor: "bg-yellow-100",
    },
    {
      title: "Total Expenses",
      value: `₹${stats.totalExpenses.toLocaleString('en-IN')}`,
      icon: TrendingDown,
      color: "text-red-600",
      bgColor: "bg-red-100",
    },
    {
      title: "Upcoming Events",
      value: stats.upcomingBookings.toLocaleString('en-IN'),
      icon: CalendarPlus,
      color: "text-purple-600",
      bgColor: "bg-purple-100",
    },
    {
      title: "Completed Events",
      value: stats.completedBookings.toLocaleString('en-IN'),
      icon: CheckCircle,
      color: "text-teal-600",
      bgColor: "bg-teal-100",
    },
  ];

  const handleEntityChange = (entityId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent dropdown from closing
    setSelectedEntityIds(prev => 
      prev.includes(entityId)
        ? prev.filter(id => id !== entityId)
        : [...prev, entityId]
    );
  };

  const handleSelectAll = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent dropdown from closing
    if (selectedEntityIds.length === entities.length) {
      setSelectedEntityIds([]);
    } else {
      setSelectedEntityIds(entities.map(e => e.id));
    }
  };

  const handleCheckboxChange = (entityId: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    setSelectedEntityIds(prev => 
      e.target.checked
        ? [...prev, entityId]
        : prev.filter(id => id !== entityId)
    );
  };

  return (
    <div className="space-y-4 md:space-y-8 animate-fade-in">

      <div className="flex flex-col gap-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl md:text-4xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
              Reports & Analytics
            </h1>
            <p className="text-muted-foreground text-sm md:text-base">
              {viewMode === 'monthly' 
                ? `Viewing data for ${months[selectedMonth - 1]?.label} ${selectedYear}`
                : `Viewing yearly data for ${selectedYear}`}
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
            <div className="flex gap-2">
              <Select 
                value={viewMode} 
                onValueChange={(value: 'monthly' | 'yearly') => setViewMode(value)}
              >
                <SelectTrigger className="w-[120px]">
                  <SelectValue placeholder="View by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="yearly">Yearly</SelectItem>
                </SelectContent>
              </Select>
              
              <Select 
                value={selectedYear.toString()}
                onValueChange={(value) => setSelectedYear(parseInt(value))}
              >
                <SelectTrigger className="w-[100px]">
                  <SelectValue placeholder="Year" />
                </SelectTrigger>
                <SelectContent>
                  {availableYears.map(year => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              {viewMode === 'monthly' && (
                <Select 
                  value={selectedMonth.toString()}
                  onValueChange={(value) => setSelectedMonth(parseInt(value))}
                >
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Month" />
                  </SelectTrigger>
                  <SelectContent>
                    {months.map(month => (
                      <SelectItem key={month.value} value={month.value.toString()}>
                        {month.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
        </div>
        
        {/* Filter Section */}
        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-1">Filter Reports</h3>
              <p className="text-xs text-gray-500">Select venues/branches to filter the report data</p>
            </div>
            <div className="relative w-full sm:w-auto">
              <Select>
                <SelectTrigger className="w-full sm:w-[280px] text-left bg-white hover:bg-gray-50 border-gray-300 focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all duration-200">
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-2">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                      </svg>
                      <span className="truncate font-medium text-gray-800">
                        {selectedEntityIds.length === 0 || selectedEntityIds.length === entities.length
                          ? 'All Venues/Branches'
                          : selectedEntityIds.length === 1
                          ? entities.find(e => e.id === selectedEntityIds[0])?.name || '1 selected'
                          : `${selectedEntityIds.length} selected`}
                      </span>
                    </div>
                    <svg className="-mr-1 ml-2 h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                      <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </div>
                </SelectTrigger>
                <SelectContent className="w-[280px] p-2 shadow-lg rounded-lg border border-gray-200 bg-white">
                  <div className="space-y-1">
                    {/* Search box */}
                    <div className="px-2 pt-1 pb-2">
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <svg className="h-4 w-4 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <input
                          type="text"
                          className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary sm:text-sm"
                          placeholder="Search venues..."
                        />
                      </div>
                    </div>
                    
                    {/* Select All */}
                    <div 
                      className="flex items-center px-3 py-2 rounded-md hover:bg-gray-50 cursor-pointer transition-colors duration-150"
                      onClick={handleSelectAll}
                    >
                      <div className="flex items-center h-5">
                        <input
                          type="checkbox"
                          id="select-all"
                          checked={selectedEntityIds.length === entities.length && entities.length > 0}
                          onChange={() => {}}
                          className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                        />
                      </div>
                      <label 
                        htmlFor="select-all" 
                        className="ml-3 text-sm font-medium text-gray-700 cursor-pointer select-none"
                      >
                        Select All
                      </label>
                    </div>
                    
                    <div className="border-t border-gray-200 my-1"></div>
                    
                    {/* Entities list */}
                    <div className="max-h-[280px] overflow-y-auto">
                      {entities.map((entity) => (
                        <div 
                          key={entity.id} 
                          className="flex items-center px-3 py-2 rounded-md hover:bg-gray-50 cursor-pointer transition-colors duration-150"
                          onClick={(e) => handleEntityChange(entity.id, e)}
                        >
                          <div className="flex items-center h-5">
                            <input
                              type="checkbox"
                              id={`entity-${entity.id}`}
                              checked={selectedEntityIds.includes(entity.id)}
                              onChange={() => {}}
                              className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                            />
                          </div>
                          <label 
                            htmlFor={`entity-${entity.id}`}
                            className="ml-3 text-sm text-gray-700 cursor-pointer select-none"
                          >
                            {entity.name}
                          </label>
                        </div>
                      ))}
                      {entities.length === 0 && (
                        <div className="px-3 py-2 text-sm text-gray-500 text-center">
                          No venues found
                        </div>
                      )}
                    </div>
                    
                    {/* Selected count */}
                    {selectedEntityIds.length > 0 && (
                      <div className="px-3 py-2 text-xs text-gray-500 border-t border-gray-200 bg-gray-50 rounded-b-md">
                        {selectedEntityIds.length} {selectedEntityIds.length === 1 ? 'venue' : 'venues'} selected
                      </div>
                    )}
                  </div>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Export Section */}
        <div className="flex items-center justify-between bg-gray-50 p-3 rounded-lg border border-gray-200">
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-1">Export Reports</h3>
            <p className="text-xs text-gray-500">Download reports in your preferred format</p>
          </div>
          <div className="flex gap-3">
            <Button 
              onClick={exportToCSV} 
              variant="outline"
              size="sm"
              className="px-3 md:px-4 py-1.5 h-auto text-xs md:text-sm"
            >
              Export CSV
            </Button>
            <Button 
              onClick={exportToPDF} 
              variant="outline"
              size="sm"
              className="bg-blue-600 hover:bg-blue-700 text-white px-3 md:px-4 py-1.5 h-auto text-xs md:text-sm"
            >
              Export PDF
            </Button>
          </div>
        </div>
      </div>

      <div className="w-full">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 gap-3 sm:gap-4">
          {statCards.map((stat) => (
            <Card key={stat.title} className="h-full flex flex-col items-center justify-center p-4 sm:p-5 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-200 ease-in-out bg-white dark:bg-gray-800">
              <div className={`${stat.bgColor} p-2.5 sm:p-3 rounded-full mb-3 sm:mb-4`}>
                <stat.icon className={`h-5 w-5 sm:h-6 sm:w-6 ${stat.color}`} />
              </div>
              <CardHeader className="p-0">
                <CardTitle className="text-xs sm:text-sm font-medium text-center text-gray-500 dark:text-gray-400">
                  {stat.title}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 mt-1">
                <div className="text-lg sm:text-xl font-bold text-center text-gray-900 dark:text-white">
                  {stat.value}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="glass card-hover rounded-lg md:rounded-xl border-0 shadow-card">
          <CardHeader className="pb-4 md:pb-6 pt-4 md:pt-8 px-4 md:px-8">
            <CardTitle className="flex items-center gap-2 md:gap-3 text-base md:text-xl font-semibold">
              <TrendingUp className="h-5 w-5 md:h-6 md:w-6 text-primary" />
              <span className="truncate">Monthly Revenue</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 md:px-8 pb-4 md:pb-8">
            {stats.monthlyRevenue.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={stats.monthlyRevenue}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="month" stroke="#64748b" />
                  <YAxis stroke="#64748b" />
                  <Tooltip
                    formatter={(value: any) => `₹${Number(value).toLocaleString()}`}
                    labelStyle={{ color: "#000" }}
                    contentStyle={{
                      backgroundColor: "#fff",
                      border: "1px solid #e2e8f0",
                      borderRadius: "8px",
                      boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1)"
                    }}
                  />
                  <Bar dataKey="revenue" fill="#2563eb" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                <div className="text-center">
                  <TrendingUp className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No revenue data available</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="glass card-hover rounded-lg md:rounded-xl border-0 shadow-card">
          <CardHeader className="pb-4 md:pb-6 pt-4 md:pt-8 px-4 md:px-8">
            <CardTitle className="text-base md:text-xl font-semibold">Bookings by Status</CardTitle>
          </CardHeader>
          <CardContent className="px-2 md:px-4 pb-4 md:pb-8 w-full overflow-hidden">
            {stats.bookingsByStatus.length > 0 ? (
              <div className="w-full h-[300px] flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={stats.bookingsByStatus}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, value }) => `${name}: ${value}`}
                      outerRadius="80%"
                      innerRadius="40%"
                      paddingAngle={2}
                      dataKey="value"
                      className="text-xs md:text-sm"
                    >
                      {stats.bookingsByStatus.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={COLORS[index % COLORS.length]}
                          stroke="#fff"
                          strokeWidth={1}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: any, name: any, props: any) => [
                        `${name}: ${value}`,
                        `Count: ${props.payload.count}`
                      ]}
                      contentStyle={{
                        backgroundColor: 'rgba(255, 255, 255, 0.9)',
                        border: '1px solid #e2e8f0',
                        borderRadius: '0.5rem',
                        padding: '0.5rem',
                        fontSize: '0.875rem',
                      }}
                    />
                    <Legend 
                      layout="horizontal"
                      verticalAlign="bottom"
                      align="center"
                      wrapperStyle={{
                        paddingTop: '1rem',
                        fontSize: '0.75rem',
                        overflow: 'visible',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                <div className="text-center">
                  <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No booking status data</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="glass card-hover rounded-lg md:rounded-xl border-0 shadow-card">
          <CardHeader className="pb-4 md:pb-6 pt-4 md:pt-8 px-4 md:px-8">
            <CardTitle className="text-base md:text-xl font-semibold">Bookings by Month</CardTitle>
          </CardHeader>
          <CardContent className="px-4 md:px-8 pb-4 md:pb-8">
            {stats.bookingsByMonth.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={stats.bookingsByMonth}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="month" stroke="#64748b" />
                  <YAxis stroke="#64748b" />
                  <Tooltip
                    labelStyle={{ color: "#000" }}
                    contentStyle={{ backgroundColor: "#fff", border: "1px solid #e2e8f0", borderRadius: 8 }}
                  />
                  <Line type="monotone" dataKey="count" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                <div className="text-center">
                  <Calendar className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No booking trend data</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="glass card-hover rounded-lg md:rounded-xl border-0 shadow-card">
          <CardHeader className="pb-4 md:pb-6 pt-4 md:pt-8 px-4 md:px-8">
            <CardTitle className="text-base md:text-xl font-semibold">Income vs Expenses</CardTitle>
          </CardHeader>
          <CardContent className="px-4 md:px-8 pb-4 md:pb-8">
            {stats.monthlyExpenses.length > 0 ? (
              <ResponsiveContainer width="100%" height={400}>
                <ComposedChart
                  data={stats.monthlyExpenses}
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="month" 
                    stroke="#64748b"
                    tick={{ fontSize: 12 }}
                  />
                  <YAxis 
                    yAxisId="left"
                    orientation="left"
                    stroke="#2563eb"
                    tickFormatter={(value) => `₹${value.toLocaleString()}`}
                  />
                  <YAxis 
                    yAxisId="right"
                    orientation="right"
                    stroke="#ef4444"
                    tickFormatter={(value) => `₹${value.toLocaleString()}`}
                  />
                  <Tooltip
                    formatter={(value: any, name: string) => [`₹${Number(value).toLocaleString()}`, name]}
                    labelFormatter={(label) => `Month: ${label}`}
                    labelStyle={{ color: "#000", fontWeight: 'bold' }}
                    contentStyle={{ 
                      backgroundColor: "#fff", 
                      border: "1px solid #e2e8f0", 
                      borderRadius: 8,
                      padding: '10px'
                    }}
                  />
                  <Legend />
                  <Bar 
                    yAxisId="left"
                    dataKey="Income" 
                    name="Income"
                    fill="#2563eb" 
                    radius={[4, 4, 0, 0]}
                    animationDuration={1500}
                  />
                  <Bar 
                    yAxisId="right"
                    dataKey="Expenses" 
                    name="Expenses"
                    fill="#ef4444" 
                    radius={[4, 4, 0, 0]}
                    animationDuration={1500}
                  />
                  <Line 
                    yAxisId="left"
                    type="monotone"
                    dataKey="Profit"
                    name="Profit"
                    stroke="#10b981"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                <div className="text-center">
                  <DollarSign className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No financial data available</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Reports;
