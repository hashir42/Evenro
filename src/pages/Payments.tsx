import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, DollarSign, Trash2, Calendar, CreditCard, RefreshCw, TrendingUp, AlertCircle, CheckCircle, Clock, ChevronsUpDown, Check } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { toast } from "sonner";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

// Note: Install these packages
// npm install razorpay @stripe/stripe-js

const Payments = () => {
  const { user } = useAuth();
  const [payments, setPayments] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [paymentsByBooking, setPaymentsByBooking] = useState<Record<string, { paid: number; refunds: number }>>({});
  const [isOpen, setIsOpen] = useState(false);
  const [isRefundOpen, setIsRefundOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<any>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [paymentToDelete, setPaymentToDelete] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState({
    from: '',
    to: new Date().toISOString().split('T')[0]
  });
  
  const [formData, setFormData] = useState({
    booking_id: "",
    amount: 0,
    payment_date: new Date().toISOString().split("T")[0],
    payment_method: "cash",
    payment_type: "full",
    notes: "",
  });
  const [searchQuery, setSearchQuery] = useState("");

  const [isAdvancePayment, setIsAdvancePayment] = useState(false);

  const [refundData, setRefundData] = useState({
    refund_amount: 0,
    notes: "",
  });

  const [stats, setStats] = useState({
    totalReceived: 0,
    pendingPayment: 0,
    totalRefunds: 0,
    pendingPaymentsCount: 0,
  });

  useEffect(() => {
    if (user) {
      fetchPayments();
      fetchBookings();
      fetchPaymentsByBooking();
      calculateStats();
    }
  }, [user]);

  // Add this effect to refetch payments when date range changes
  useEffect(() => {
    if (user) {
      fetchPayments();
    }
  }, [dateRange]);

  const fetchPayments = async () => {
    let query = supabase
      .from("payments")
      .select("*, bookings(event_name, clients(name))")
      .eq("vendor_id", user!.id)
      .order("payment_date", { ascending: false });

    // Apply date range filter if dates are provided
    if (dateRange.from) {
      query = query.gte('payment_date', dateRange.from);
    }
    if (dateRange.to) {
      // Add one day to include the entire end date
      const nextDay = new Date(dateRange.to);
      nextDay.setDate(nextDay.getDate() + 1);
      query = query.lt('payment_date', nextDay.toISOString().split('T')[0]);
    }

    const { data, error } = await query;

    if (error) {
      toast.error("Failed to fetch payments");
    } else {
      setPayments(data || []);
    }
  };

  const handleDateRangeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setDateRange(prev => {
      const newDateRange = {
        ...prev,
        [name]: value
      };
      return newDateRange;
    });
  };

  const resetDateRange = () => {
    setDateRange({
      from: '',
      to: new Date().toISOString().split('T')[0]
    });
  };

  // Format date for display
  const formatDateDisplay = (dateString: string) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };


  const fetchBookings = async () => {
    const { data } = await supabase
      .from("bookings")
      .select("*, clients(name)")
      .eq("vendor_id", user!.id)
      .neq("status", "cancelled")
      .order("event_date", { ascending: true });
    
    setBookings(data || []);
  };

  const fetchPaymentsByBooking = async () => {
    const { data, error } = await supabase
      .from("payments")
      .select("booking_id, amount, payment_type, refund_amount")
      .eq("vendor_id", user!.id);
    if (!error && data) {
      const map: Record<string, { paid: number; refunds: number }> = {};
      data.forEach((p: any) => {
        if (!p.booking_id) return;
        if (!map[p.booking_id]) map[p.booking_id] = { paid: 0, refunds: 0 };
        if (p.payment_type === 'refund') {
          map[p.booking_id].refunds += Number(p.refund_amount || 0);
        } else {
          map[p.booking_id].paid += Number(p.amount || 0);
        }
      });
      setPaymentsByBooking(map);
    }
  };

  const getPendingForBooking = (booking: any) => {
    const total = Number(booking.total_amount) || 0;
    const p = paymentsByBooking[booking.id] || { paid: 0, refunds: 0 };
    const paid = p.paid || 0;
    return Math.max(0, total - paid);
  };

  const calculateStats = async () => {
    const { data: paymentData } = await supabase
      .from("payments")
      .select("amount, payment_type, refund_amount, settlement_status, booking_id")
      .eq("vendor_id", user!.id);

    const { data: bookingsData } = await supabase
      .from("bookings")
      .select("id, total_amount")
      .eq("vendor_id", user!.id)
      .neq("status", "cancelled");

    if (paymentData && bookingsData) {
      const totalReceived = paymentData
        .filter(p => p.payment_type !== 'refund')
        .reduce((sum, p) => sum + Number(p.amount), 0);
      
      const totalRefunds = paymentData
        .reduce((sum, p) => sum + Number(p.refund_amount || 0), 0);

      // Calculate total booking amounts
      const totalBookingAmount = bookingsData
        .reduce((sum, b) => sum + Number(b.total_amount || 0), 0);

      // Pending = Total Booking Amount - Payments Received
      const pendingPayment = Math.max(0, totalBookingAmount - totalReceived);

      // Build payment map for counting
      const paymentMap: Record<string, number> = {};
      paymentData.forEach((p: any) => {
        if (!p.booking_id || p.payment_type === 'refund') return;
        if (!paymentMap[p.booking_id]) paymentMap[p.booking_id] = 0;
        paymentMap[p.booking_id] += Number(p.amount || 0);
      });

      // Count bookings with pending payments
      const pendingPaymentsCount = bookingsData.filter((b: any) => {
        const total = Number(b.total_amount) || 0;
        const paid = paymentMap[b.id] || 0;
        return total > paid;
      }).length;

      setStats({
        totalReceived,
        totalRefunds,
        pendingPayment,
        pendingPaymentsCount,
      });
    }
  };

  const handleRazorpayPayment = async () => {
    // Note: Add VITE_RAZORPAY_KEY_ID to your .env file
    const razorpayKeyId = import.meta.env.VITE_RAZORPAY_KEY_ID;
    
    if (!razorpayKeyId) {
      toast.error("Razorpay is not configured. Add VITE_RAZORPAY_KEY_ID to .env");
      return;
    }

    try {
      // Load Razorpay script
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      document.body.appendChild(script);

      script.onload = () => {
        const options = {
          key: razorpayKeyId,
          amount: formData.amount * 100, // Amount in paise
          currency: "INR",
          name: "BuyEvenn",
          description: "Payment for booking",
          handler: async (response: any) => {
            // Payment successful
            await savePayment({
              payment_method: 'razorpay',
              gateway_transaction_id: response.razorpay_payment_id,
              gateway_payment_id: response.razorpay_payment_id,
              settlement_status: 'pending',
            });
          },
          prefill: {
            name: user?.email,
            email: user?.email,
          },
          theme: {
            color: "#6366f1"
          }
        };

        const razorpay = new (window as any).Razorpay(options);
        razorpay.open();
      };
    } catch (error) {
      toast.error("Failed to initialize Razorpay");
    }
  };

  const savePayment = async (additionalData = {}) => {
    try {
      // Prevent overpayment if booking selected and total is set
      if (formData.booking_id) {
        const booking = bookings.find(b => b.id === formData.booking_id);
        if (booking && Number(booking.total_amount) > 0) {
          const pending = getPendingForBooking(booking);
          if (formData.amount > pending + 0.0001) {
            // Allow recording but flag as overpaid
            setFormData(prev => ({ ...prev, payment_type: "overpaid" }));
            toast(`Amount exceeds pending (₹${pending.toLocaleString()}). Marked as overpaid.`);
          }
        }
        if (booking && booking.status === 'cancelled') {
          toast.error('Cannot record payment for a cancelled booking');
          return;
        }
      }
      const { error } = await supabase.from("payments").insert({
        vendor_id: user!.id,
        booking_id: formData.booking_id || null,
        amount: formData.amount,
        payment_date: formData.payment_date,
        payment_method: formData.payment_method,
        payment_type: formData.payment_type,
        notes: formData.notes,
        ...additionalData,
      });

      if (error) throw error;

      toast.success("Payment recorded successfully");
      setIsOpen(false);
      fetchPayments();
      fetchPaymentsByBooking();
      calculateStats();
      resetForm();
    } catch (error) {
      console.error("Error saving payment:", error);
      toast.error("Failed to save payment");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.booking_id) {
      toast.error("Please select a booking");
      return;
    }
    if (formData.payment_method === 'razorpay') {
      handleRazorpayPayment();
    } else {
      await savePayment();
    }
  };

  const handleRefund = async () => {
    if (!selectedPayment) return;

    try {
      const { error } = await supabase
        .from("payments")
        .update({
          payment_type: 'refund',
          refund_amount: refundData.refund_amount,
          notes: `${selectedPayment.notes || ''}\nRefund: ${refundData.notes}`,
        })
        .eq("id", selectedPayment.id);

      if (error) throw error;

      toast.success("Refund processed successfully");
      setIsRefundOpen(false);
      setSelectedPayment(null);
      fetchPayments();
      calculateStats();
      setRefundData({ refund_amount: 0, notes: "" });
    } catch (error) {
      toast.error("Failed to process refund");
    }
  };

  const deletePayment = async (id: string) => {
    setPaymentToDelete(id);
    setDeleteDialogOpen(true);
  };

  const confirmDeletePayment = async () => {
    if (!paymentToDelete) return;

    const { error } = await supabase.from("payments").delete().eq("id", paymentToDelete);

    if (error) {
      toast.error("Failed to delete payment");
    } else {
      toast.success("Payment deleted");
      fetchPayments();
      calculateStats();
    }

    setDeleteDialogOpen(false);
    setPaymentToDelete(null);
  };

  const resetForm = () => {
    setFormData({
      booking_id: "",
      amount: 0,
      payment_date: new Date().toISOString().split("T")[0],
      payment_method: "cash",
      payment_type: "full",
      notes: "",
    });
    setSearchQuery("");
    setIsAdvancePayment(false);
  };

  // Auto-select payment type based on amount and advance checkbox
  useEffect(() => {
    if (isAdvancePayment) {
      setFormData(prev => ({ ...prev, payment_type: "advance" }));
    } else if (formData.booking_id && formData.amount > 0) {
      const booking = bookings.find(b => b.id === formData.booking_id);
      if (booking) {
        const pending = getPendingForBooking(booking);
        if (Math.abs(formData.amount - pending) < 0.01) {
          // Amount equals pending (with small tolerance for floating point)
          setFormData(prev => ({ ...prev, payment_type: "full" }));
        } else if (formData.amount < pending) {
          setFormData(prev => ({ ...prev, payment_type: "partial" }));
        } else if (formData.amount > pending) {
          // Amount exceeds pending, mark as overpaid
          setFormData(prev => ({ ...prev, payment_type: "overpaid" }));
        } else {
          // Amount equals pending
          setFormData(prev => ({ ...prev, payment_type: "full" }));
        }
      }
    }
  }, [formData.amount, formData.booking_id, isAdvancePayment, bookings]);

  const getPaymentMethodBadge = (method: string) => {
    const colors: any = {
      cash: "bg-green-100 text-green-800",
      card: "bg-blue-100 text-blue-800",
      upi: "bg-purple-100 text-purple-800",
      razorpay: "bg-indigo-100 text-indigo-800",
      stripe: "bg-violet-100 text-violet-800",
      bank_transfer: "bg-gray-100 text-gray-800",
    };
    return colors[method] || "bg-gray-100 text-gray-800";
  };

  const getPaymentTypeBadge = (type: string) => {
    const colors: any = {
      full: "bg-green-100 text-green-800",
      partial: "bg-yellow-100 text-yellow-800",
      advance: "bg-blue-100 text-blue-800",
      overpaid: "bg-purple-100 text-purple-800",
      refund: "bg-red-100 text-red-800",
    };
    return colors[type] || "bg-gray-100 text-gray-800";
  };

  const getSettlementStatusBadge = (status: string) => {
    const colors: any = {
      pending: "bg-yellow-100 text-yellow-800",
      processing: "bg-blue-100 text-blue-800",
      settled: "bg-green-100 text-green-800",
      failed: "bg-red-100 text-red-800",
    };
    return colors[status] || "bg-gray-100 text-gray-800";
  };

  return (
    <div className="space-y-4 md:space-y-8 animate-fade-in">
      <div className="text-center space-y-1 md:space-y-2">
        <h1 className="text-2xl md:text-4xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
          Payments & Settlement
        </h1>
        <p className="text-muted-foreground text-sm md:text-lg">Track payments, settlements, and refunds</p>
      </div>

      {/* Stats Dashboard */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 md:gap-4">
        {/* Total Received Card */}
        <Card className="glass card-hover rounded-xl border-0 shadow-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Total Received</p>
                <p className="text-lg font-bold text-green-600">₹{stats.totalReceived.toLocaleString()}</p>
              </div>
              <div className="p-2 rounded-lg bg-green-50 dark:bg-green-900/20">
                <TrendingUp className="h-5 w-5 text-green-600" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">All payments received to date</p>
          </CardContent>
        </Card>

        {/* Pending Payment Card */}
        <Card className="glass card-hover rounded-xl border-0 shadow-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Pending Payment</p>
                <p className="text-lg font-bold text-yellow-600">₹{stats.pendingPayment.toLocaleString()}</p>
              </div>
              <div className="p-2 rounded-lg bg-yellow-50 dark:bg-yellow-900/20">
                <Clock className="h-5 w-5 text-yellow-600" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">Total outstanding across all bookings</p>
          </CardContent>
        </Card>

        {/* Total Refunds Card */}
        <Card className="glass card-hover rounded-xl border-0 shadow-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Total Refunds</p>
                <p className="text-lg font-bold text-red-600">₹{stats.totalRefunds.toLocaleString()}</p>
              </div>
              <div className="p-2 rounded-lg bg-red-50 dark:bg-red-900/20">
                <RefreshCw className="h-5 w-5 text-red-600" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">Total amount refunded to clients</p>
          </CardContent>
        </Card>

        {/* Pending Payments Count Card */}
        <Card className="glass card-hover rounded-xl border-0 shadow-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Pending Payments</p>
                <p className="text-lg font-bold text-blue-600">{stats.pendingPaymentsCount}</p>
              </div>
              <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-900/20">
                <AlertCircle className="h-5 w-5 text-blue-600" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">Number of pending payment requests</p>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 md:gap-4">
        <Dialog open={isOpen} onOpenChange={(open) => {
          setIsOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button className="btn-primary touch-feedback w-full sm:w-auto h-9 md:h-10 text-xs md:text-sm px-3 md:px-4">
              <Plus className="mr-1 md:mr-2 h-3.5 w-3.5 md:h-4 md:w-4" />
              <span className="hidden sm:inline">Record Payment</span>
              <span className="sm:hidden">Record</span>
            </Button>
          </DialogTrigger>
          <DialogContent className="w-[95vw] max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-lg md:text-xl font-semibold">Record New Payment</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-6 p-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-6">
                <div className="space-y-2">
                  <Label htmlFor="booking_id" className="text-sm font-medium">Booking *</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        className="w-full justify-between h-10 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 shadow-sm transition-all duration-200 ease-in-out hover:border-primary-500 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/50 focus:outline-none"
                        type="button"
                      >
                        {formData.booking_id
                          ? `${bookings.find((b) => b.id === formData.booking_id)?.event_name || 'Booking'} - ${
                              bookings.find((b) => b.id === formData.booking_id)?.clients?.name || 'No client'
                            } (Pending: ₹${getPendingForBooking(bookings.find((b) => b.id === formData.booking_id))?.toLocaleString() || '0'})`
                          : "Select booking..."}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-full p-0 border border-gray-300 rounded-lg bg-white shadow-lg" align="start" sideOffset={4} style={{
                      '--tw-ring-color': 'rgba(99, 102, 241, 0.5)',
                      '--tw-ring-offset-shadow': '0 0 #0000',
                      '--tw-ring-shadow': '0 0 #0000',
                      '--tw-shadow': '0 1px 2px 0 rgb(0 0 0 / 0.05)',
                      '--tw-shadow-colored': '0 1px 2px 0 var(--tw-shadow-color)'
                    } as React.CSSProperties}>
                      <Command>
                        <CommandInput 
                          placeholder="Search bookings..."
                          value={searchQuery}
                          onValueChange={setSearchQuery}
                        />
                        <CommandList>
                          <CommandEmpty>No bookings found.</CommandEmpty>
                          <CommandGroup>
                            {bookings
                              .filter(booking => {
                                if (!searchQuery) return true;
                                const searchLower = searchQuery.toLowerCase();
                                return (
                                  booking.event_name?.toLowerCase().includes(searchLower) ||
                                  booking.clients?.name?.toLowerCase().includes(searchLower) ||
                                  booking.id.toLowerCase().includes(searchLower)
                                );
                              })
                              .filter((b) => getPendingForBooking(b) > 0)
                              .map((booking) => (
                                <CommandItem
                                  key={booking.id}
                                  value={booking.id}
                                  onSelect={() => {
                                    setFormData({
                                      ...formData,
                                      booking_id: booking.id,
                                      amount: getPendingForBooking(booking)
                                    });
                                  }}
                                  className="cursor-pointer"
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4 flex-shrink-0",
                                      formData.booking_id === booking.id ? "opacity-100" : "opacity-0"
                                    )}
                                  />
                                  <div className="flex-1 min-w-0">
                                    <div className="font-medium truncate">
                                      {booking.event_name || 'Unnamed Event'}
                                    </div>
                                    <div className="text-xs text-muted-foreground truncate">
                                      {booking.clients?.name || 'No client'} • Pending: ₹{getPendingForBooking(booking)?.toLocaleString() || '0'}
                                    </div>
                                  </div>
                                </CommandItem>
                              ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  {!formData.booking_id && (
                    <p className="text-xs text-red-500">Please select a booking</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="amount" className="text-sm font-medium">Amount (₹) *</Label>
                  <Input
                    className="h-10 text-sm"
                    id="amount"
                    type="number"
                    step="0.01"
                    value={formData.amount || ""}
                    onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
                    required
                    placeholder="0.00"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="payment_date" className="text-sm font-medium">Payment Date *</Label>
                  <Input
                    className="h-10 text-sm"
                    id="payment_date"
                    type="date"
                    value={formData.payment_date}
                    onChange={(e) => setFormData({ ...formData, payment_date: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="payment_method" className="text-sm font-medium">Payment Method *</Label>
                  <Select value={formData.payment_method} onValueChange={(value) => setFormData({ ...formData, payment_method: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="card">Card</SelectItem>
                      <SelectItem value="upi">UPI</SelectItem>
                      <SelectItem value="razorpay">Razorpay</SelectItem>
                      <SelectItem value="stripe">Stripe</SelectItem>
                      <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="payment_type" className="text-sm font-medium">Payment Type *</Label>
                  <Select 
                    value={formData.payment_type} 
                    onValueChange={(value) => setFormData({ ...formData, payment_type: value })}
                    disabled={true}
                  >
                    <SelectTrigger className="bg-muted">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="full">Full Payment</SelectItem>
                      <SelectItem value="partial">Partial Payment</SelectItem>
                      <SelectItem value="advance">Advance Payment</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">Auto-selected based on amount and advance payment checkbox</p>
                </div>

                <div className="space-y-2 md:col-span-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="advance_payment" 
                      checked={isAdvancePayment}
                      onCheckedChange={(checked) => setIsAdvancePayment(checked as boolean)}
                    />
                    <Label 
                      htmlFor="advance_payment" 
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                    >
                      This is an advance payment
                    </Label>
                  </div>
                  <p className="text-xs text-muted-foreground ml-6">Check this if you're receiving an advance payment before the booking is confirmed</p>
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="notes" className="text-sm font-medium">Notes</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={4}
                    className="min-h-[100px]"
                    placeholder="Additional notes..."
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 md:gap-4 pt-4 md:pt-6">
                <Button type="button" variant="outline" onClick={() => setIsOpen(false)} className="px-4 md:px-6 touch-feedback">Cancel</Button>
                <Button type="submit" className="px-4 md:px-6 touch-feedback">Record</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Date Filters */}
      <div className="space-y-3 mb-6">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">Filter Payments</h3>
          {(dateRange.from || dateRange.to !== new Date().toISOString().split('T')[0]) && (
            <button
              onClick={resetDateRange}
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
            >
              <span>Clear all</span>
              <span className="text-base">×</span>
            </button>
          )}
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-2xl">
          <div className="space-y-2 relative">
            <Label htmlFor="from-date">From Date</Label>
            <div className="relative">
              <Input
                id="from-date"
                type="date"
                name="from"
                value={dateRange.from}
                onChange={handleDateRangeChange}
                className="w-full pr-8"
              />
              {dateRange.from && (
                <button
                  onClick={() => setDateRange(prev => ({ ...prev, from: '' }))}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label="Clear from date"
                >
                  ×
                </button>
              )}
            </div>
          </div>
          
          <div className="space-y-2 relative">
            <Label htmlFor="to-date">To Date</Label>
            <div className="relative">
              <Input
                id="to-date"
                type="date"
                name="to"
                value={dateRange.to}
                onChange={handleDateRangeChange}
                max={new Date().toISOString().split('T')[0]}
                className="w-full pr-8"
              />
              {dateRange.to !== new Date().toISOString().split('T')[0] && (
                <button
                  onClick={() => setDateRange(prev => ({ ...prev, to: new Date().toISOString().split('T')[0] }))}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label="Reset to today"
                >
                  ×
                </button>
              )}
            </div>
          </div>
        </div>
        
        {(dateRange.from || dateRange.to !== new Date().toISOString().split('T')[0]) && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Showing payments</span>
            {dateRange.from && dateRange.to && dateRange.to !== new Date().toISOString().split('T')[0] ? (
              <>
                <span>from <span className="font-medium text-foreground">{new Date(dateRange.from).toLocaleDateString()}</span></span>
                <span>to <span className="font-medium text-foreground">{new Date(dateRange.to).toLocaleDateString()}</span></span>
              </>
            ) : dateRange.from ? (
              <span>after <span className="font-medium text-foreground">{new Date(dateRange.from).toLocaleDateString()}</span></span>
            ) : (
              <span>before <span className="font-medium text-foreground">{new Date(dateRange.to).toLocaleDateString()}</span></span>
            )}
          </div>
        )}
      </div>

      {/* Tabs for Payments and Pending */}
      <Tabs defaultValue="payments" className="space-y-4 md:space-y-6">
        <TabsList className="grid w-full grid-cols-2 max-w-md h-auto">
          <TabsTrigger value="payments" className="text-xs md:text-sm py-2 md:py-2.5">Payments</TabsTrigger>
          <TabsTrigger value="pending" className="text-xs md:text-sm py-2 md:py-2.5">Pending Payments</TabsTrigger>
        </TabsList>

        <TabsContent value="payments" className="space-y-4">
          {payments.length === 0 ? (
            <Card className="glass rounded-xl md:rounded-2xl border-0 shadow-card">
              <CardContent className="flex flex-col items-center justify-center py-8 md:py-12">
                <DollarSign className="h-10 w-10 md:h-12 md:w-12 text-muted-foreground/50 mb-3 md:mb-4" />
                <p className="text-muted-foreground text-base md:text-lg mb-2">No payments yet</p>
                <p className="text-xs md:text-sm text-muted-foreground/70">Record your first payment to get started</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {payments.map((payment) => (
                <Card key={payment.id} className="glass card-hover rounded-xl md:rounded-2xl border-0 shadow-card touch-feedback active:scale-[0.98]">
                  <CardContent className="p-4 md:p-6">
                    <div className="flex items-start justify-between">
                      <div className="space-y-3 flex-1">
                        <div className="flex items-center gap-2 md:gap-3 flex-wrap">
                          {payment.payment_type === 'advance' && (
                            <span className="text-xs md:text-sm font-semibold text-blue-600">Advance</span>
                          )}
                          <h3 className="text-lg md:text-2xl font-bold text-primary">₹{Number(payment.amount).toLocaleString()}</h3>
                          {payment.payment_type === 'advance' && (
                            <span className="text-xs md:text-sm text-muted-foreground">Received</span>
                          )}
                          <Badge className={`${getPaymentMethodBadge(payment.payment_method)} text-[10px] md:text-xs px-2 md:px-2.5 py-0.5`}>
                            <CreditCard className="h-2.5 w-2.5 md:h-3 md:w-3 mr-0.5 md:mr-1" />
                            {payment.payment_method?.toUpperCase()}
                          </Badge>
                          <Badge className={`${getPaymentTypeBadge(payment.payment_type)} text-[10px] md:text-xs px-2 md:px-2.5 py-0.5`}>
                            {payment.payment_type}
                          </Badge>
                        </div>

                        {payment.bookings && (
                          <div className="text-xs md:text-sm truncate">
                            <span className="font-medium">Booking:</span> {payment.bookings.event_name}
                            {payment.bookings.clients?.name && ` - ${payment.bookings.clients.name}`}
                          </div>
                        )}

                        <div className="flex items-center gap-2 md:gap-4 text-xs md:text-sm text-muted-foreground flex-wrap">
                          <div className="flex items-center">
                            <Calendar className="h-3 w-3 md:h-4 md:w-4 mr-1" />
                            {format(new Date(payment.payment_date), "MMM d, yyyy")}
                          </div>
                          {payment.gateway_transaction_id && (
                            <div className="text-xs">
                              TXN: {payment.gateway_transaction_id.substring(0, 12)}...
                            </div>
                          )}
                        </div>

                        {payment.notes && (
                          <p className="text-xs md:text-sm text-muted-foreground line-clamp-2">{payment.notes}</p>
                        )}

                        {payment.refund_amount > 0 && (
                          <div className="text-xs md:text-sm text-red-600 font-medium">
                            Refund: ₹{Number(payment.refund_amount).toLocaleString()}
                          </div>
                        )}
                      </div>

                      <div className="flex gap-1 md:gap-2 flex-col sm:flex-row">
                        {payment.payment_type !== 'refund' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedPayment(payment);
                              setRefundData({ refund_amount: Number(payment.amount), notes: "" });
                              setIsRefundOpen(true);
                            }}
                            className="h-8 md:h-9 touch-feedback"
                          >
                            <RefreshCw className="h-3 w-3 md:h-3.5 md:w-3.5" />
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => deletePayment(payment.id)}
                          className="h-8 md:h-9 touch-feedback"
                        >
                          <Trash2 className="h-3 w-3 md:h-3.5 md:w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="pending" className="space-y-4">
          {bookings.filter(b => getPendingForBooking(b) > 0).length === 0 ? (
            <Card className="glass rounded-xl md:rounded-2xl border-0 shadow-card">
              <CardContent className="flex flex-col items-center justify-center py-8 md:py-12">
                <CheckCircle className="h-10 w-10 md:h-12 md:w-12 text-muted-foreground/50 mb-3 md:mb-4" />
                <p className="text-muted-foreground text-base md:text-lg mb-2">No pending payments</p>
                <p className="text-xs md:text-sm text-muted-foreground/70">All bookings are fully paid</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {bookings
                .filter(b => getPendingForBooking(b) > 0)
                .map((booking) => {
                  const pending = getPendingForBooking(booking);
                  const paid = paymentsByBooking[booking.id]?.paid || 0;
                  const total = Number(booking.total_amount) || 0;
                  return (
                    <Card key={booking.id} className="glass card-hover rounded-xl md:rounded-2xl border-0 shadow-card touch-feedback active:scale-[0.98]">
                      <CardContent className="p-4 md:p-6">
                        <div className="flex items-start justify-between">
                          <div className="space-y-3 flex-1">
                            <div className="flex items-center gap-2 md:gap-3 flex-wrap">
                              <h3 className="text-lg md:text-xl font-bold text-yellow-600">₹{pending.toLocaleString()}</h3>
                              <Badge className="bg-yellow-100 text-yellow-800 text-[10px] md:text-xs px-2 md:px-2.5 py-0.5">
                                <Clock className="h-2.5 w-2.5 md:h-3 md:w-3 mr-0.5 md:mr-1" />
                                Pending
                              </Badge>
                            </div>

                            <div className="space-y-1">
                              <div className="text-sm md:text-base font-medium">{booking.event_name}</div>
                              {booking.clients?.name && (
                                <div className="text-xs md:text-sm text-muted-foreground">
                                  Client: {booking.clients.name}
                                </div>
                              )}
                            </div>

                            <div className="flex items-center gap-2 md:gap-4 text-xs md:text-sm text-muted-foreground flex-wrap">
                              <div className="flex items-center">
                                <Calendar className="h-3 w-3 md:h-4 md:w-4 mr-1" />
                                {format(new Date(booking.event_date), "MMM d, yyyy")}
                              </div>
                            </div>

                            <div className="flex gap-4 text-xs md:text-sm">
                              <div>
                                <span className="text-muted-foreground">Total:</span>
                                <span className="font-medium ml-1">₹{total.toLocaleString()}</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Paid:</span>
                                <span className="font-medium ml-1 text-green-600">₹{paid.toLocaleString()}</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Pending:</span>
                                <span className="font-medium ml-1 text-yellow-600">₹{pending.toLocaleString()}</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex gap-1 md:gap-2">
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => {
                                setFormData({
                                  ...formData,
                                  booking_id: booking.id,
                                  amount: pending,
                                });
                                setIsOpen(true);
                              }}
                              className="h-8 md:h-9 touch-feedback text-xs"
                            >
                              <Plus className="h-3 w-3 md:h-3.5 md:w-3.5 mr-1" />
                              Pay
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Refund Dialog */}
      <Dialog open={isRefundOpen} onOpenChange={setIsRefundOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Process Refund</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Refund Amount (₹)</Label>
              <div className="relative">
                <Input
                  type="number"
                  step="0.01"
                  value={refundData.refund_amount}
                  readOnly
                  className="bg-muted/50 cursor-not-allowed"
                />
                <div className="absolute inset-0 flex items-center justify-end pr-3 pointer-events-none">
                  <span className="text-sm text-muted-foreground">Fixed Amount</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Full amount of ₹{selectedPayment?.amount} will be refunded
              </p>
            </div>
            <div>
              <Label>Reason</Label>
              <Textarea
                value={refundData.notes}
                onChange={(e) => setRefundData({ ...refundData, notes: e.target.value })}
                placeholder="Reason for refund..."
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsRefundOpen(false)}>Cancel</Button>
              <Button onClick={handleRefund} variant="destructive">Process Refund</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="md:max-w-sm">
          <DialogHeader>
            <DialogTitle>Confirm Delete</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete this payment record? This action cannot be undone.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={confirmDeletePayment}>Delete</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Mobile FAB for quick add */}
      <div className="md:hidden fixed bottom-24 right-4 z-40">
        <Button
          size="icon"
          className="h-14 w-14 rounded-full shadow-lg bg-primary hover:bg-primary/90 transition-all duration-180 hover:scale-110"
          onClick={() => setIsOpen(true)}
        >
          <Plus className="h-7 w-7" />
        </Button>
      </div>
    </div>
  );
};

export default Payments;
