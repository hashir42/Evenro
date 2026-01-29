import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar as CalendarIcon, MapPin, User } from "lucide-react";
import { format } from "date-fns";
import { BookingDetailDialog } from "@/components/BookingDetailDialog";
import { DragDropContext, Droppable, Draggable, DropResult } from "react-beautiful-dnd";
import { toast } from "sonner";

const Calendar = () => {
  const { user } = useAuth();
  const [bookings, setBookings] = useState<any[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [bookedDates, setBookedDates] = useState<{date: Date, status: string}[]>([]);
  const [mobileDateSheetOpen, setMobileDateSheetOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<any>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [paymentsByBooking, setPaymentsByBooking] = useState<Record<string, { paid: number; refunds: number }>>({});

  useEffect(() => {
    if (user) {
      fetchBookings();
      fetchPaymentsByBooking();
    }
  }, [user]);

  // Trigger re-render when payments change to update derived status
  useEffect(() => {
    if (bookings.length > 0 && Object.keys(paymentsByBooking).length > 0) {
      updateBookingStatuses();
    }
  }, [paymentsByBooking, bookings]);

  // Open the selected date bookings as a bottom sheet on mobile
  useEffect(() => {
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    if (!isMobile) {
      if (mobileDateSheetOpen) setMobileDateSheetOpen(false);
      return;
    }
    if (!selectedDate) return;
    const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
    const hasBookings = bookings.some((b) => b.event_date && sameDay(new Date(b.event_date), selectedDate));
    setMobileDateSheetOpen(hasBookings);
  }, [selectedDate, bookings]);

  const fetchBookings = async () => {
    try {
      const { data, error } = await supabase
        .from("bookings")
        .select(`
          *,
          clients(name, phone, email),
          packages(name, price),
          portfolio_items(title, price),
          entities(name)
        `)
        .eq("vendor_id", user!.id)
        .order("event_date", { ascending: true });

      if (error) {
        console.error("Error fetching bookings:", error);
        toast.error("Failed to fetch bookings");
        return;
      }

      // Process and validate booking data
      const processedData = (data || []).map(booking => ({
        ...booking,
        total_amount: Number(booking.total_amount) || 0,
        from_time: booking.from_time || '',
        to_time: booking.to_time || '',
        event_date: booking.event_date || new Date().toISOString().split('T')[0],
        clients: booking.clients || { name: 'Unknown' },
        packages: booking.packages || { name: 'Custom', price: 0 }
      }));

      setBookings(processedData);
    } catch (error) {
      console.error("Unexpected error in fetchBookings:", error);
      toast.error("An unexpected error occurred");
    }
  };

  const fetchPaymentsByBooking = async () => {
    try {
      const { data, error } = await supabase
        .from("payments")
        .select("booking_id, amount, payment_type, refund_amount")
        .eq("vendor_id", user!.id);

      if (error) {
        console.error('Error fetching payments:', error);
        toast.error('Failed to load payment information');
        return;
      }

      if (data) {
        const map: Record<string, { paid: number; refunds: number }> = {};
        
        // First pass: calculate total payments (excluding refunds)
        data.forEach((p: any) => {
          if (!p.booking_id || p.payment_type === 'refund') return;
          if (!map[p.booking_id]) map[p.booking_id] = { paid: 0, refunds: 0 };
          map[p.booking_id].paid += Number(p.amount || 0);
        });
        
        // Second pass: calculate refunds
        data.forEach((p: any) => {
          if (!p.booking_id || p.payment_type !== 'refund') return;
          if (!map[p.booking_id]) map[p.booking_id] = { paid: 0, refunds: 0 };
          map[p.booking_id].refunds += Number(p.refund_amount || p.amount || 0);
        });
        
        setPaymentsByBooking(map);
      }
    } catch (error) {
      console.error('Unexpected error in fetchPaymentsByBooking:', error);
      toast.error('An error occurred while loading payments');
    }
  };

  const getDerivedStatus = (booking: any) => {
    // If booking is cancelled, return cancelled
    if (booking.status === 'cancelled') return 'cancelled';
    
    // Check if event_date exists
    if (!booking.event_date) return 'confirmed';
    
    // Check if event date has passed
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const eventDate = new Date(booking.event_date);
    eventDate.setHours(0, 0, 0, 0);
    
    // If date has passed, it's completed
    if (eventDate < today) return 'completed';
    
    // If booking exists and date hasn't passed, it's confirmed
    return 'confirmed';
  };

  const updateBookingStatuses = () => {
    try {
      const datesWithStatus = bookings
        .filter((booking) => booking?.event_date)
        .map((booking) => {
          const eventDate = new Date(booking.event_date);
          // Skip invalid dates
          if (isNaN(eventDate.getTime())) return null;
          
          return {
            date: eventDate,
            status: getDerivedStatus(booking),
            bookingId: booking.id
          };
        })
        .filter(Boolean); // Remove any null entries from invalid dates

      setBookedDates(datesWithStatus);
    } catch (error) {
      console.error('Error updating booking statuses:', error);
    }
  };

  const getPaymentInfo = (booking: any) => {
    const defaultValues = {
      totalPaid: 0,
      pending: Number(booking?.total_amount) || 0,
      totalAmount: Number(booking?.total_amount) || 0,
      paymentProgress: 0
    };

    try {
      if (!booking || !paymentsByBooking) {
        return defaultValues;
      }

      const payments = paymentsByBooking[booking.id] || { paid: 0, refunds: 0 };
      
      // Calculate total payments (excluding refunds)
      const totalPayments = Number(payments.paid) || 0;
      
      // Calculate total refunds
      const totalRefunds = Number(payments.refunds) || 0;
      
      // Calculate net paid (payments - refunds, never negative)
      const netPaid = Math.max(0, totalPayments - totalRefunds);
      
      // Calculate total amount from booking
      const totalAmount = Number(booking.total_amount) || 0;
      
      // Calculate pending amount (never negative and never exceeds total amount)
      const pending = Math.max(0, Math.min(totalAmount, totalAmount - netPaid));
      
      return { 
        totalPaid: netPaid, 
        pending, 
        totalAmount,
        paymentProgress: totalAmount > 0 ? Math.min(100, Math.max(0, (netPaid / totalAmount) * 100)) : 0
      };
    } catch (error) {
      console.error('Error calculating payment info:', error);
      return defaultValues;
    }
  };


  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination) return;
    const { draggableId, destination } = result;
    const newDate = new Date(destination.droppableId);

    const { error } = await supabase
      .from("bookings")
      .update({ event_date: newDate.toISOString().split('T')[0] })
      .eq("id", draggableId);

    if (!error) {
      toast.success("Booking rescheduled");
      fetchBookings();
    } else {
      toast.error("Failed to reschedule");
    }
  };


  const fetchFullBookingDetails = async (bookingId: string) => {
    const { data, error } = await supabase
      .from("bookings")
      .select("*, clients(name), packages(name), portfolio_items(title, price), entities(name), from_time, to_time")
      .eq("id", bookingId)
      .single();

    if (!error && data) {
      setSelectedBooking(data);
      setDetailDialogOpen(true);
    }
  };

  const selectedDateBookings = bookings.filter((booking) => {
    if (!selectedDate || !booking.event_date) return false;
    const bookingDate = new Date(booking.event_date);
    return (
      bookingDate.getDate() === selectedDate.getDate() &&
      bookingDate.getMonth() === selectedDate.getMonth() &&
      bookingDate.getFullYear() === selectedDate.getFullYear()
    );
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "confirmed":
        return "bg-green-100 text-green-800 border-green-200";
      case "completed":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "cancelled":
        return "bg-gray-100 text-gray-800 border-gray-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="space-y-8 animate-fade-in">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
            Calendar
          </h1>
          <p className="text-muted-foreground text-lg">View your bookings in calendar format</p>
        </div>


        {/* Status Legend - Desktop only, spans both columns */}
        <Card className="hidden md:block glass card-hover rounded-xl md:rounded-2xl border-0 shadow-card">
          <CardHeader className="pb-3 md:pb-4 pt-4 md:pt-6 px-4 md:px-6">
            <CardTitle className="flex items-center gap-2 md:gap-3 text-sm md:text-lg font-semibold">
              <CalendarIcon className="h-4 w-4 md:h-5 md:w-5 text-primary" />
              Status Legend
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 md:px-6 pb-4 md:pb-6">
            <div className="grid grid-cols-3 gap-4">
              <div className="flex items-center gap-2 p-3 rounded-xl bg-green-50 border border-green-200">
                <div className="w-4 h-4 rounded bg-green-500 shrink-0"></div>
                <span className="text-sm font-medium truncate">Confirmed</span>
              </div>
              <div className="flex items-center gap-2 p-3 rounded-xl bg-blue-50 border border-blue-200">
                <div className="w-4 h-4 rounded bg-blue-500 shrink-0"></div>
                <span className="text-sm font-medium truncate">Completed</span>
              </div>
              <div className="flex items-center gap-2 p-3 rounded-xl bg-gray-50 border border-gray-200">
                <div className="w-4 h-4 rounded bg-gray-500 shrink-0"></div>
                <span className="text-sm font-medium truncate">Cancelled</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 md:gap-8 md:grid-cols-2">
          <div className="space-y-4">
            <Card className="glass card-hover rounded-xl md:rounded-2xl border-0 shadow-card">
            <CardHeader className="pb-3 md:pb-4 pt-4 md:pt-6 px-4 md:px-6">
              <CardTitle className="flex items-center gap-2 md:gap-3 text-sm md:text-lg font-semibold">
                <CalendarIcon className="h-4 w-4 md:h-5 md:w-5 text-primary" />
                Select Date
              </CardTitle>
            </CardHeader>
            <CardContent className="px-2 md:px-4 pb-3 md:pb-6 space-y-3">
              <div className="flex justify-center">
                <CalendarComponent
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  className="rounded-xl border border-border/50"
                  modifiers={{
                    confirmed: bookedDates.filter(d => d.status === 'confirmed').map(d => d.date),
                    completed: bookedDates.filter(d => d.status === 'completed').map(d => d.date),
                    cancelled: bookedDates.filter(d => d.status === 'cancelled').map(d => d.date)
                  }}
                  modifiersStyles={{
                    confirmed: {
                      backgroundColor: 'hsl(142.1, 76.2%, 36.3%, 0.15)',
                      color: 'hsl(142.1, 76.2%, 36.3%)',
                      border: '2px solid hsl(142.1, 76.2%, 36.3%, 0.3)',
                      fontWeight: '600',
                      borderRadius: '0.5rem'
                    },
                    completed: {
                      backgroundColor: 'hsl(221.2, 83.2%, 53.3%, 0.15)',
                      color: 'hsl(221.2, 83.2%, 53.3%)',
                      border: '2px solid hsl(221.2, 83.2%, 53.3%, 0.3)',
                      fontWeight: '600',
                      borderRadius: '0.5rem',
                      textDecoration: 'line-through'
                    },
                    cancelled: {
                      backgroundColor: 'hsl(0, 0%, 45.1%, 0.15)',
                      color: 'hsl(0, 0%, 45.1%)',
                      border: '2px solid hsl(0, 0%, 45.1%, 0.3)',
                      fontWeight: '600',
                      borderRadius: '0.5rem',
                      textDecoration: 'line-through'
                    }
                  }}
                />
              </div>
              
              {/* Legend badges inside Select Date - Mobile only */}
              <div className="flex md:hidden flex-wrap gap-1.5 justify-center px-2">
                <Badge className="bg-green-100 text-green-700 hover:bg-green-100 text-[10px] px-2 py-0.5">Confirmed</Badge>
                <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 text-[10px] px-2 py-0.5">Completed</Badge>
                <Badge className="bg-gray-100 text-gray-700 hover:bg-gray-100 text-[10px] px-2 py-0.5">Cancelled</Badge>
              </div>
            </CardContent>
          </Card>
          </div>

          <Card className="glass card-hover rounded-2xl border-0 shadow-card hidden md:block">
            <CardHeader className="pb-6 pt-8 px-8">
              <CardTitle className="text-xl font-semibold">
                {selectedDate ? format(selectedDate, "MMMM d, yyyy") : "Select a date"}
              </CardTitle>
            </CardHeader>
            <CardContent className="px-8 pb-8">
              {selectedDateBookings.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <CalendarIcon className="h-12 w-12 text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground mb-2">No bookings on this date</p>
                  <p className="text-sm text-muted-foreground/70">Select a different date to view bookings</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {selectedDateBookings.map((booking) => (
                    <Card
                      key={booking.id}
                      className="border border-border/50 rounded-xl hover:shadow-md transition-all duration-180"
                    >
                      <CardContent className="p-4 space-y-3">
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-lg text-foreground">{booking.event_name}</h3>
                            {(booking.from_time || booking.to_time) && (
                              <p className="text-sm text-muted-foreground mt-1">
                                Time: {booking.from_time || 'Start'} - {booking.to_time || 'End'}
                              </p>
                            )}
                          </div>
                          <Badge className={`${getStatusColor(getDerivedStatus(booking))} ml-3`}>
                            {getDerivedStatus(booking)}
                          </Badge>
                        </div>

                        {booking.clients?.name && (
                          <div className="flex items-center gap-2 text-sm">
                            <User className="h-4 w-4 text-muted-foreground" />
                            <span className="text-muted-foreground">{booking.clients.name}</span>
                          </div>
                        )}

                        {booking.location && (
                          <div className="flex items-center gap-2 text-sm">
                            <MapPin className="h-4 w-4 text-muted-foreground" />
                            <span className="text-muted-foreground">{booking.location}</span>
                          </div>
                        )}

                        {booking.packages?.name && (
                          <div className="pt-3 border-t border-border/50">
                            <p className="text-sm">
                              <span className="font-medium text-muted-foreground">Package:</span> {booking.packages.name}
                            </p>
                          </div>
                        )}

                        {booking.total_amount > 0 && (
                          <div className="pt-2 space-y-1">
                            <div className="text-xl font-bold text-primary">
                              ₹{Number(booking.total_amount).toLocaleString()}
                            </div>
                            <div className="flex gap-3 text-xs">
                              <div>
                                <span className="text-muted-foreground">Paid:</span>
                                <span className="font-medium ml-1 text-green-600">₹{getPaymentInfo(booking).totalPaid.toLocaleString()}</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Pending:</span>
                                <span className={`font-medium ml-1 ${getPaymentInfo(booking).pending > 0 ? 'text-red-600' : 'text-muted-foreground'}`}>₹{getPaymentInfo(booking).pending.toLocaleString()}</span>
                              </div>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>


        {/* Mobile bottom sheet for selected date bookings */}
        <Dialog open={mobileDateSheetOpen} onOpenChange={setMobileDateSheetOpen}>
          <DialogContent className="md:hidden w-full rounded-t-2xl pb-2">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold">{selectedDate ? format(selectedDate, "MMMM d, yyyy") : "Selected date"}</DialogTitle>
            </DialogHeader>
            {selectedDateBookings.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 text-center">
                <CalendarIcon className="h-10 w-10 text-muted-foreground mb-3" />
                <p className="text-muted-foreground text-sm">No bookings on this date</p>
              </div>
            ) : (
              <div className="space-y-3">
                {selectedDateBookings.map((booking) => (
                  <div
                    key={booking.id}
                    className="flex items-center justify-between p-4 rounded-xl border border-border/50 hover:bg-muted/30 transition-colors cursor-pointer"
                    onClick={() => {
                      setMobileDateSheetOpen(false);
                      fetchFullBookingDetails(booking.id);
                    }}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-foreground">{booking.event_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {booking.event_date ? format(new Date(booking.event_date), "MMM d, yyyy") : 'No date'}
                        {(booking.from_time || booking.to_time) && ` ${booking.from_time || 'Start'} - ${booking.to_time || 'End'}`} • {booking.clients?.name || "No client"}
                      </p>
                      {booking.total_amount > 0 && (
                        <div className="flex gap-2 text-[10px] mt-1">
                          <span className="text-green-600">Paid: ₹{getPaymentInfo(booking).totalPaid.toLocaleString()}</span>
                          <span className={getPaymentInfo(booking).pending > 0 ? 'text-red-600' : 'text-muted-foreground'}>Pending: ₹{getPaymentInfo(booking).pending.toLocaleString()}</span>
                        </div>
                      )}
                    </div>
                    <Badge className={getStatusColor(getDerivedStatus(booking))}>{getDerivedStatus(booking)}</Badge>
                  </div>
                ))}
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Upcoming bookings section */}
        <Card className="glass card-hover rounded-2xl border-0 shadow-card">
          <CardHeader className="pb-6 pt-8 px-8">
            <CardTitle className="flex items-center gap-3 text-xl font-semibold">
              <CalendarIcon className="h-6 w-6 text-primary" />
              Upcoming Bookings
            </CardTitle>
          </CardHeader>
          <CardContent className="px-8 pb-8">
            <div className="space-y-3">
              {bookings
                .filter((booking) => booking.event_date && new Date(booking.event_date) >= new Date())
                .map((booking) => (
                  <div
                    key={booking.id}
                    className="group flex items-center justify-between p-4 rounded-xl border border-border/50 hover:bg-muted/30 transition-all duration-180 cursor-pointer hover:shadow-md"
                    onClick={() => fetchFullBookingDetails(booking.id)}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground group-hover:text-primary transition-colors">
                        {booking.event_name}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {booking.event_date ? format(new Date(booking.event_date), "MMM d, yyyy") : 'No date'}
                        {(booking.from_time || booking.to_time) && ` ${booking.from_time || 'Start'} - ${booking.to_time || 'End'}`} •{" "}
                        {booking.clients?.name || "No client"}
                      </p>
                      {booking.total_amount > 0 && (
                        <div className="flex gap-3 text-xs mt-1">
                          <span className="text-green-600">Paid: ₹{getPaymentInfo(booking).totalPaid.toLocaleString()}</span>
                          <span className={getPaymentInfo(booking).pending > 0 ? 'text-red-600' : 'text-muted-foreground'}>Pending: ₹{getPaymentInfo(booking).pending.toLocaleString()}</span>
                        </div>
                      )}
                    </div>
                    <Badge className={`${getStatusColor(getDerivedStatus(booking))} ml-3`}>
                      {getDerivedStatus(booking)}
                    </Badge>
                  </div>
                ))}
              {bookings.filter((booking) => booking.event_date && new Date(booking.event_date) >= new Date()).length ===
                0 && (
                <div className="text-center py-8">
                  <CalendarIcon className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
                  <p className="text-muted-foreground">No upcoming bookings scheduled</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <BookingDetailDialog
          booking={selectedBooking}
          open={detailDialogOpen}
          onOpenChange={setDetailDialogOpen}
          onUpdate={fetchBookings}
        />
      </div>
    </DragDropContext>
  );
};

export default Calendar;