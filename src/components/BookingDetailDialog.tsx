import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar, MapPin, DollarSign, Package, User, Clock, CheckCircle, XCircle, AlertCircle, Building2 } from "lucide-react";
import { toast } from "sonner";


interface BookingDetailDialogProps {
  booking: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: () => void;
}

export function BookingDetailDialog({ booking, open, onOpenChange, onUpdate }: BookingDetailDialogProps) {
  const { user } = useAuth();
  const [payments, setPayments] = useState<any[]>([]);
  const [recordingPayment, setRecordingPayment] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [completeDialogOpen, setCompleteDialogOpen] = useState(false);
  const [isAdvancePayment, setIsAdvancePayment] = useState(false);
  const [paymentData, setPaymentData] = useState({
    amount: 0,
    payment_method: "cash",
    payment_date: new Date().toISOString().split("T")[0],
    payment_type: "full",
  });

  useEffect(() => {
    if (booking && open) {
      fetchPayments();
    }
  }, [booking, open]);

  const fetchPayments = async () => {
    if (!booking) return;
    
    const { data, error } = await supabase
      .from("payments")
      .select("*")
      .eq("booking_id", booking.id)
      .order("payment_date", { ascending: false });

    if (!error) {
      setPayments(data || []);
    }
  };

  // Calculate total payments and refunds separately
  const totalPayments = payments
    .filter(p => p.payment_type !== 'refund')
    .reduce((sum, p) => sum + Number(p.amount || 0), 0);
    
  const totalRefunds = payments
    .filter(p => p.payment_type === 'refund')
    .reduce((sum, p) => sum + Number(p.refund_amount || p.amount || 0), 0);

  const totalAmount = Number(booking?.total_amount || 0);
  
  // Calculate net paid (total payments - total refunds)
  const netPaid = Math.max(0, totalPayments - totalRefunds);
  
  // Calculate pending amount, ensuring it's never negative and never exceeds total amount
  const pendingAmount = Math.max(0, Math.min(totalAmount, totalAmount - netPaid));
  
  // Calculate payment progress (0-100%)
  const paymentProgress = totalAmount > 0 ? (netPaid / totalAmount) * 100 : 0;

  // Derive status: confirmed/completed/cancelled based on booking state, date, and time
  const derivedStatus = (() => {
    if (booking?.status === 'cancelled') return 'cancelled';
    
    // Check if event_date exists
    if (!booking?.event_date) return 'confirmed';
    
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
  })();

  const completeBooking = async () => {
    if (!booking) return;
    const { error } = await supabase
      .from('bookings')
      .update({ 
        status: 'completed',
        updated_at: new Date().toISOString()
      })
      .eq('id', booking.id);

    if (error) {
      console.error('Error completing booking:', error);
      toast.error('Failed to mark booking as completed');
      return;
    }

    toast.success('Booking marked as completed');
    onUpdate();
    setCompleteDialogOpen(false);
  };

  const confirmCancelBooking = async () => {
    if (!booking) return;
    const { error } = await supabase
      .from('bookings')
      .update({ 
        status: 'cancelled',
        updated_at: new Date().toISOString()
      })
      .eq('id', booking.id)
      .eq('vendor_id', user!.id);
    if (error) {
      toast.error('Failed to cancel booking');
    } else {
      toast.success('Booking cancelled');
      onUpdate();
      setCancelDialogOpen(false);
    }
  };

  // Auto-select payment type based on amount and advance checkbox
  useEffect(() => {
    if (isAdvancePayment) {
      setPaymentData(prev => ({ ...prev, payment_type: "advance" }));
    } else if (paymentData.amount > 0) {
      if (Math.abs(paymentData.amount - pendingAmount) < 0.01) {
        // Amount equals pending (with small tolerance for floating point)
        setPaymentData(prev => ({ ...prev, payment_type: "full" }));
      } else if (paymentData.amount < pendingAmount) {
        setPaymentData(prev => ({ ...prev, payment_type: "partial" }));
      } else if (paymentData.amount > pendingAmount) {
        // Amount exceeds pending
        setPaymentData(prev => ({ ...prev, payment_type: "overpaid" }));
      }
    }
  }, [paymentData.amount, isAdvancePayment, pendingAmount]);

  const recordPayment = async () => {
    if (!booking || paymentData.amount <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    setRecordingPayment(true);

    const { error } = await supabase.from("payments").insert({
      booking_id: booking.id,
      vendor_id: user!.id,
      amount: paymentData.amount,
      payment_method: paymentData.payment_method,
      payment_date: paymentData.payment_date,
      payment_type: paymentData.payment_type,
    });

    setRecordingPayment(false);

    if (error) {
      toast.error("Failed to record payment");
      return;
    }

    toast.success("Payment recorded successfully");
    fetchPayments();
    onUpdate();
    setPaymentData({
      amount: 0,
      payment_method: "cash",
      payment_date: new Date().toISOString().split("T")[0],
      payment_type: "full",
    });
    setIsAdvancePayment(false);
  };

  if (!booking) return null;

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "confirmed": return <CheckCircle className="h-4 w-4" />;
      case "completed": return <CheckCircle className="h-4 w-4" />;
      case "cancelled": return <XCircle className="h-4 w-4" />;
      default: return <AlertCircle className="h-4 w-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "confirmed": return "bg-green-100 text-green-800 border-green-200";
      case "completed": return "bg-blue-100 text-blue-800 border-blue-200";
      case "cancelled": return "bg-red-100 text-red-800 border-red-200";
      default: return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="md:max-w-3xl w-full md:w-auto rounded-t-2xl md:rounded-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader className="pb-3 md:pb-4">
          <DialogTitle className="text-lg md:text-2xl">Booking Details</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 md:space-y-6">
          {/* Header Info */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h3 className="text-base md:text-xl font-semibold truncate">{booking.event_name}</h3>
              {booking.entities?.name && (
                <div className="flex items-center text-xs md:text-sm text-primary font-medium mt-1">
                  <Building2 className="mr-1.5 h-3.5 w-3.5 flex-shrink-0" />
                  <span className="truncate">{booking.entities.name}</span>
                </div>
              )}
            </div>
            <Badge className={`${getStatusColor(derivedStatus)} flex items-center gap-1 text-xs md:text-sm shrink-0`}>
              {getStatusIcon(derivedStatus)}
              {derivedStatus}
            </Badge>
          </div>

          <Separator />

          {/* Event Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
            <div className="flex items-start gap-2 md:gap-3">
              <Calendar className="h-4 w-4 md:h-5 md:w-5 text-muted-foreground mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs md:text-sm font-medium">Date & Time</p>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium">Booked on: </span>
                    {new Date(booking.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </p>
                  <p className="text-xs md:text-sm text-muted-foreground">
                    <span className="font-medium">Event: </span>
                    {new Date(booking.event_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                    {booking.from_time && booking.to_time ? (
                      ` • ${booking.from_time} - ${booking.to_time}`
                    ) : booking.from_time ? (
                      ` • ${booking.from_time}`
                    ) : null}
                  </p>
                </div>
              </div>
            </div>

            {booking.location && (
              <div className="flex items-start gap-2 md:gap-3">
                <MapPin className="h-4 w-4 md:h-5 md:w-5 text-muted-foreground mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs md:text-sm font-medium">Location</p>
                  <p className="text-xs md:text-sm text-muted-foreground truncate">{booking.location}</p>
                </div>
              </div>
            )}

            <div className="flex items-start gap-2 md:gap-3">
              <User className="h-4 w-4 md:h-5 md:w-5 text-muted-foreground mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs md:text-sm font-medium">Client</p>
                <p className="text-xs md:text-sm text-muted-foreground truncate">{booking.clients?.name || "N/A"}</p>
              </div>
            </div>

            {booking.packages?.name && (
              <div className="flex items-start gap-2 md:gap-3">
                <Package className="h-4 w-4 md:h-5 md:w-5 text-muted-foreground mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs md:text-sm font-medium">Package</p>
                  <p className="text-xs md:text-sm text-muted-foreground truncate">{booking.packages.name}</p>
                </div>
              </div>
            )}

            {booking.portfolio_items?.title && (
              <div className="flex items-start gap-2 md:gap-3 md:col-span-2">
                <Package className="h-4 w-4 md:h-5 md:w-5 text-muted-foreground mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs md:text-sm font-medium">Portfolio Item</p>
                  <p className="text-xs md:text-sm text-muted-foreground">
                    {booking.portfolio_items.title}
                    {booking.portfolio_items.price > 0 && ` - ₹${Number(booking.portfolio_items.price).toLocaleString()}`}
                  </p>
                </div>
              </div>
            )}
          </div>

          <Separator />

          {/* Payment Summary */}
          <div className="space-y-3 md:space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm md:text-base font-semibold flex items-center gap-2">
                <DollarSign className="h-4 w-4 md:h-5 md:w-5" />
                Payment Summary
              </h4>
            </div>

            <div className="space-y-1.5 md:space-y-2">
              <div className="flex justify-between text-xs md:text-sm">
                <span>Total Amount</span>
                <span className="font-semibold">₹{totalAmount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-xs md:text-sm">
                <span className="text-green-600">Amount Paid</span>
                <span className="font-semibold text-green-600">₹{netPaid.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-xs md:text-sm">
                <span className={pendingAmount > 0 ? "text-red-600" : "text-muted-foreground"}>
                  Pending Amount
                </span>
                <span className={`font-semibold ${pendingAmount > 0 ? "text-red-600" : "text-muted-foreground"}`}>
                  ₹{pendingAmount.toLocaleString()}
                </span>
              </div>
              
              {/* Progress Bar */}
              {totalAmount > 0 && (
                <div className="pt-2">
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div
                      className="bg-green-600 h-2.5 rounded-full transition-all"
                      style={{ width: `${Math.min(paymentProgress, 100)}%` }}
                    ></div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 text-right">
                    {paymentProgress.toFixed(0)}% paid
                  </p>
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* Cancellation */}
          <div className="space-y-2 md:space-y-3">
            <Label className="text-xs md:text-sm">Actions</Label>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={() => setCancelDialogOpen(true)} 
                disabled={booking.status === 'cancelled'} 
                className="h-8 md:h-10 text-xs md:text-sm px-3 md:px-4 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200 hover:border-red-300"
              >
                Cancel Booking
              </Button>
            </div>
          </div>

          <Separator />

          {/* Cancel Confirmation Dialog */}
          <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
            <DialogContent className="md:max-w-sm w-full md:w-auto rounded-t-2xl md:rounded-xl">
              <DialogHeader>
                <DialogTitle className="text-lg font-semibold">Cancel Booking</DialogTitle>
              </DialogHeader>
              <p className="text-sm text-muted-foreground">
                Are you sure you want to cancel this booking? This action cannot be undone.
              </p>
              <div className="flex justify-end gap-3 pt-4">
                <Button variant="outline" onClick={() => setCancelDialogOpen(false)} className="px-6">
                  No, Keep It
                </Button>
                <Button variant="destructive" onClick={confirmCancelBooking} className="px-6">
                  Yes, Cancel
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Record New Payment */}
          <div className="space-y-2 md:space-y-3 bg-muted/50 p-3 md:p-4 rounded-lg">
            <h4 className="text-sm md:text-base font-semibold">Record New Payment</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-3">
              <div className="space-y-1.5 md:space-y-2">
                <Label className="text-xs md:text-sm">Amount (₹)</Label>
                <Input
                  type="number"
                  value={paymentData.amount || ""}
                  onChange={(e) => setPaymentData({ ...paymentData, amount: parseFloat(e.target.value) || 0 })}
                  placeholder="0"
                  min="0"
                  step="0.01"
                />
              </div>
              <div className="space-y-1.5 md:space-y-2">
                <Label className="text-xs md:text-sm">Payment Date</Label>
                <Input
                  type="date"
                  value={paymentData.payment_date}
                  onChange={(e) => setPaymentData({ ...paymentData, payment_date: e.target.value })}
                />
              </div>
              <div className="space-y-1.5 md:space-y-2 md:col-span-2">
                <Label className="text-xs md:text-sm">Payment Method</Label>
                <Select
                  value={paymentData.payment_method}
                  onValueChange={(value) => setPaymentData({ ...paymentData, payment_method: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                    <SelectItem value="upi">UPI</SelectItem>
                    <SelectItem value="card">Card</SelectItem>
                    <SelectItem value="cheque">Cheque</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 md:space-y-2 md:col-span-2">
                <Label className="text-xs md:text-sm">Payment Type</Label>
                <div className="flex items-center justify-between p-2 md:p-3 border rounded-lg bg-muted">
                  <span className="text-xs md:text-sm font-medium capitalize">{paymentData.payment_type}</span>
                  <span className="text-xs text-muted-foreground">Auto-selected</span>
                </div>
              </div>
              <div className="space-y-1.5 md:space-y-2 md:col-span-2">
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="advance_payment_dialog" 
                    checked={isAdvancePayment}
                    onCheckedChange={(checked) => setIsAdvancePayment(checked as boolean)}
                  />
                  <Label 
                    htmlFor="advance_payment_dialog" 
                    className="text-xs md:text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                  >
                    This is an advance payment
                  </Label>
                </div>
                <p className="text-xs text-muted-foreground ml-6">Check this if you're receiving an advance payment</p>
              </div>
            </div>
            <Button onClick={recordPayment} disabled={recordingPayment} className="w-full h-9 md:h-10 text-xs md:text-sm">
              {recordingPayment ? "Recording..." : "Record Payment"}
            </Button>
          </div>

          {/* Payment History */}
          {payments.length > 0 && (
            <>
              <Separator />
              <div className="space-y-2 md:space-y-3">
                <h4 className="text-sm md:text-base font-semibold flex items-center gap-2">
                  <Clock className="h-3.5 w-3.5 md:h-4 md:w-4" />
                  Payment History ({payments.length})
                </h4>
                <div className="space-y-1.5 md:space-y-2">
                  {payments.map((payment) => (
                    <div key={payment.id} className="flex items-center justify-between p-2 md:p-3 border rounded-lg">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 md:gap-2 flex-wrap">
                          {payment.payment_type === 'refund' ? (
                            <>
                              <span className="text-xs font-semibold text-red-600">Refund</span>
                              <p className="text-xs md:text-sm font-medium text-red-600">-₹{Number(payment.refund_amount || payment.amount).toLocaleString()}</p>
                            </>
                          ) : (
                            <>
                              {payment.payment_type === 'advance' && (
                                <span className="text-xs font-semibold text-blue-600">Advance</span>
                              )}
                              <p className="text-xs md:text-sm font-medium">₹{Number(payment.amount).toLocaleString()}</p>
                              {payment.payment_type === 'advance' && (
                                <span className="text-xs text-muted-foreground">Received</span>
                              )}
                            </>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {new Date(payment.payment_date).toLocaleDateString()} • {payment.payment_method.replace("_", " ")}
                          {payment.payment_type && ` • ${payment.payment_type}`}
                        </p>
                      </div>
                      <Badge 
                        variant="outline" 
                        className={`text-xs shrink-0 ${
                          payment.payment_type === 'refund' 
                            ? 'text-red-600 border-red-200' 
                            : 'text-green-600 border-green-200'
                        }`}
                      >
                        {payment.payment_type === 'refund' ? 'Refunded' : 'Paid'}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
