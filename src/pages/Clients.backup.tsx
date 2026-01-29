import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Mail, Phone, Plus, Search, User, MessageCircle, X, Pencil, Trash2, Eye, MapPin, Calendar, ChevronLeft, ChevronRight, MessageSquare, CreditCard } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { fetchClientBookings } from "@/services/bookingService";
import { fetchClientPayments, getPaymentSummary, Payment, BookingPaymentSummary } from "@/services/paymentService";
import { BookingDetailDialog } from "@/components/BookingDetailDialog";

const Clients = () => {
  const { user } = useAuth();
  const [clients, setClients] = useState<any[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<any | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [clientToDelete, setClientToDelete] = useState<string | null>(null);
  const [selectedClient, setSelectedClient] = useState<any>(null);
  const [clientDetailOpen, setClientDetailOpen] = useState(false);
  const [communicationLogs, setCommunicationLogs] = useState<any[]>([]);
  const [reminders, setReminders] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("details");
  const [bookings, setBookings] = useState<any[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [paymentSummary, setPaymentSummary] = useState<{
    totalReceived: number;
    totalPending: number;
    bookingSummaries: BookingPaymentSummary[];
    recentPayments: Payment[];
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<any>(null);
  const [bookingDetailOpen, setBookingDetailOpen] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [isAdvancePayment, setIsAdvancePayment] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    booking_id: "",
    amount: 0,
    payment_date: new Date().toISOString().split("T")[0],
    payment_method: "cash",
    payment_type: "full",
    notes: "",
  });

  // CRM Dialog States
  const [newLogDialogOpen, setNewLogDialogOpen] = useState(false);
  const [newReminderDialogOpen, setNewReminderDialogOpen] = useState(false);
  const [logForm, setLogForm] = useState({ type: "call", notes: "" });
  const [reminderForm, setReminderForm] = useState({ title: "", description: "", dueDate: "" });

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    whatsappNumber: "",
    useSameNumber: true,
    notes: "",
    stage: "client",
    fullAddress: "",
    city: "",
    pincode: "",
    landmark: "",
    googleMapsLink: ""
  });

  useEffect(() => {
    if (user) {
      fetchClients();
      fetchAllReminders();
    }
  }, [user]);

  const fetchClients = async () => {
    const { data, error } = await supabase
      .from("clients")
      .select("*")
      .eq("vendor_id", user!.id)
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Failed to fetch clients");
    } else {
      setClients(data || []);
    }
  };

  const fetchCommunicationLogs = async (clientId: string) => {
    const { data } = await supabase
      .from("communication_logs")
      .select("*")
      .eq("client_id", clientId)
      .order("date", { ascending: false });
    if (data) setCommunicationLogs(data);
  };

  const fetchClientData = async (clientId: string) => {
    try {
      setIsLoading(true);

      // Fetch client details
      const { data: clientData } = await supabase
        .from("clients")
        .select("*")
        .eq("id", clientId)
        .single();

      if (clientData) {
        setSelectedClient(clientData);

        // Fetch client bookings
        const bookings = await fetchClientBookings(clientId);
        setBookings(bookings);

        // Fetch client payments
        const payments = await fetchClientPayments(clientId);
        setPayments(payments);

        // Calculate payment summary
        const summary = await getPaymentSummary(bookings, payments);
        setPaymentSummary(summary);
      }

      // Fetch communication logs
      await fetchCommunicationLogs(clientId);
    } catch (error) {
      console.error('Error fetching client data:', error);
      toast.error('Failed to load client data');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAllReminders = async () => {
    const { data } = await supabase
      .from("reminders")
      .select("*, clients(name)")
      .eq("user_id", user!.id)
      .eq("is_completed", false)
      .order("due_date", { ascending: true });
    if (data) setReminders(data);
  };

  const addCommunicationLog = async () => {
    if (!selectedClient) return;
    const { error } = await supabase.from("communication_logs").insert({
      client_id: selectedClient.id,
      type: logForm.type,
      notes: logForm.notes,
      user_id: user!.id,
    });
    if (!error) {
      toast.success("Log added");
      fetchCommunicationLogs(selectedClient.id);
      setNewLogDialogOpen(false);
      setLogForm({ type: "call", notes: "" });
    } else {
      toast.error("Failed to add log");
    }
  };

  const addReminder = async () => {
    if (!selectedClient) return;
    const { error } = await supabase.from("reminders").insert({
      client_id: selectedClient.id,
      title: reminderForm.title,
      description: reminderForm.description,
      due_date: new Date(reminderForm.dueDate).toISOString(),
      user_id: user!.id,
    });
    if (!error) {
      toast.success("Reminder set");
      fetchAllReminders();
      setNewReminderDialogOpen(false);
      setReminderForm({ title: "", description: "", dueDate: "" });
    } else {
      toast.error("Failed to set reminder");
    }
  };

  const updateClientStage = async (clientId: string, stage: string) => {
    const { error } = await supabase
      .from("clients")
      .update({ stage })
      .eq("id", clientId);
    if (!error) {
      toast.success("Stage updated");
      fetchClients();
    } else {
      toast.error("Failed to update stage");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    // Show confirmation dialog for new clients
    if (!editingClient) {
      setShowConfirmDialog(true);
      return;
    }

    // If editing or after confirmation, proceed with save
    await saveClient();
  };

  const saveClient = async () => {
    setShowConfirmDialog(false);
    if (!user) return;

    // Validate phone number (10 digits for Indian numbers)
    if (!/^\d{10}$/.test(formData.phone.replace(/\D/g, ''))) {
      toast.error("Please enter a valid 10-digit phone number");
      return;
    }

    // Prepare the data to be saved with correct field names
    const { useSameNumber, ...formDataWithoutFlag } = formData;

    const clientData: any = {
      name: formDataWithoutFlag.name,
      email: formDataWithoutFlag.email,
      phone: formDataWithoutFlag.phone,
      whatsapp_number: useSameNumber ? formDataWithoutFlag.phone : formDataWithoutFlag.whatsappNumber,
      notes: formDataWithoutFlag.notes,
      stage: formDataWithoutFlag.stage,
      vendor_id: user.id,
      // Add address fields
      full_address: formDataWithoutFlag.fullAddress,
      city: formDataWithoutFlag.city,
      pincode: formDataWithoutFlag.pincode,
      landmark: formDataWithoutFlag.landmark,
      google_maps_link: formDataWithoutFlag.googleMapsLink
    };

    // Log the data being saved for debugging
    console.log('Client data with address:', clientData);

    console.log('Saving client data:', clientData);

    try {
      if (editingClient) {
        const { error } = await supabase
          .from("clients")
          .update(clientData)
          .eq("id", editingClient.id);

        if (error) {
          throw error;
        }

        toast.success("Client updated successfully");
      } else {
        try {
          const clientToSave = {
            name: clientData.name,
            email: clientData.email || null,
            phone: clientData.phone,
            whatsapp_number: clientData.whatsapp_number || clientData.phone,
            notes: clientData.notes || null,
            stage: 'client', // Default stage
            vendor_id: user.id,
            // Add address fields
            full_address: clientData.full_address || null,
            city: clientData.city || null,
            pincode: clientData.pincode || null,
            landmark: clientData.landmark || null,
            google_maps_link: clientData.google_maps_link || null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };

          console.log('Client to save with address:', clientToSave);

          console.log('Client to save:', clientToSave);

          console.log('Sending request to Supabase...');
          const { data, error } = await supabase
            .from('clients')
            .insert([{
              name: clientToSave.name,
              email: clientToSave.email,
              phone: clientToSave.phone,
              whatsapp_number: clientToSave.whatsapp_number,
              notes: clientToSave.notes,
              stage: clientToSave.stage,
              vendor_id: clientToSave.vendor_id,
              // Add address fields
              full_address: clientToSave.full_address,
              city: clientToSave.city,
              pincode: clientToSave.pincode,
              landmark: clientToSave.landmark,
              google_maps_link: clientToSave.google_maps_link,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            }])
            .select()
            .single();

          console.log('Supabase response:', { data, error });

          if (error) {
            console.error('Supabase error details:', error);
            // Check for specific error types
            if (error.code === '23505') { // Unique violation
              if (error.message.includes('email')) {
                throw new Error('A client with this email already exists');
              } else if (error.message.includes('phone')) {
                throw new Error('A client with this phone number already exists');
              }
            }
            throw error;
          }

          if (!data) {
            throw new Error('No data returned from server');
          }

          console.log('Client created successfully:', data);
          toast.success("Client added successfully");
        } catch (error: any) {
          console.error('Error in client creation:', error);
          throw new Error(`Failed to create client: ${error.message}`);
        }
      }

      fetchClients();
      setIsOpen(false);
      resetForm();
    } catch (error: any) {
      console.error("Error saving client:", error);
      const errorMessage = error.message || 'An unknown error occurred';
      console.error('Error details:', error);

      // More specific error messages
      if (errorMessage.includes('already exists')) {
        toast.error(errorMessage);
      } else if (error.code === '23505') { // Unique constraint violation
        if (error.message.includes('email')) {
          toast.error('A client with this email already exists');
        } else if (error.message.includes('phone')) {
          toast.error('A client with this phone number already exists');
        } else {
          toast.error('This client already exists');
        }
      } else {
        toast.error(`Error saving client: ${errorMessage}`);
      }
    }
  };

  // Handle phone number changes
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Only allow numbers and limit to 10 digits
    const value = e.target.value.replace(/\D/g, '').slice(0, 10);
    setFormData(prev => ({
      ...prev,
      phone: value,
      // Update whatsappNumber if useSameNumber is true
      whatsappNumber: prev.useSameNumber ? value : prev.whatsappNumber
    }));
  };

  // Handle whatsapp number changes
  const handleWhatsAppChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Only allow numbers and limit to 10 digits
    const value = e.target.value.replace(/\D/g, '').slice(0, 10);
    setFormData(prev => ({
      ...prev,
      whatsappNumber: value,
      // If user starts typing a different number, uncheck useSameNumber
      useSameNumber: value === prev.phone
    }));
  };

  // Toggle use same number for WhatsApp
  const toggleUseSameNumber = (checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      useSameNumber: checked,
      whatsappNumber: checked ? prev.phone : prev.whatsappNumber
    }));
  };

  // Handle payment submission
  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClient || !selectedBooking) return;

    try {
      setIsSubmittingPayment(true);
      
      // Prepare payment data
      const paymentData = {
        client_id: selectedClient.id,
        booking_id: paymentForm.booking_id || null,
        amount: paymentForm.amount,
        payment_date: paymentForm.payment_date,
        payment_method: paymentForm.payment_method,
        payment_type: paymentForm.payment_type,
        notes: paymentForm.notes,
        status: 'completed' as const,
        vendor_id: user?.id,
        transaction_id: `TXN-${Date.now()}`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      // Insert payment into database
      const { error } = await supabase
        .from('payments')
        .insert(paymentData);

      if (error) throw error;

      // Show success message
      toast.success('Payment recorded successfully');

      // Close dialog and refresh data
      setPaymentDialogOpen(false);
      
      // Refresh client data to update the UI
      if (selectedClient) {
        await fetchClientData(selectedClient.id);
      }
      
      // Reset form
      setPaymentForm({
        booking_id: "",
        amount: 0,
        payment_date: new Date().toISOString().split("T")[0],
        payment_method: "cash",
        payment_type: "full",
        notes: "",
      });
      setIsAdvancePayment(false);
      
    } catch (error) {
      console.error('Error saving payment:', error);
      toast.error('Failed to save payment. Please try again.');
    } finally {
      setIsSubmittingPayment(false);
    }
  };
      // ... (rest of the code remains the same)
                                            <span>
                                              {format(parseISO(booking.event_date), 'EEEE, MMM d, yyyy')}
                                              {booking.event_time && ` • ${booking.event_time}`}
                                            </span>
                                          ) : 'No date specified'}
                                        </div>
                                        
                                        {booking.location && (
                                          <div className="flex items-start text-muted-foreground">
                                            <MapPin className="h-4 w-4 mr-2 mt-0.5 flex-shrink-0 opacity-70" />
                                            <span>{booking.location}</span>
                                          </div>
                                        )}
                                        
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 mt-2">
                                          {booking.package?.name && (
                                            <div className="flex items-center">
                                              <span className="text-muted-foreground mr-2">Package:</span>
                                              <span>{booking.package.name}</span>
                                            </div>
                                          )}
                                          
                                          {booking.portfolio_item?.title && (
                                            <div className="flex items-center">
                                              <span className="text-muted-foreground mr-2">Portfolio:</span>
                                              <span>{booking.portfolio_item.title}</span>
                                            </div>
                                          )}
                                          
                                          <div className="flex items-center">
                                            <span className="text-muted-foreground mr-2">Created:</span>
                                            <span>{format(parseISO(booking.created_at), 'MMM d, yyyy')}</span>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                    
                                    <div className="flex flex-col items-end justify-between gap-4 sm:pl-4 sm:border-l border-border/40">
                                      <div className="text-right">
                                        <p className="text-2xl font-bold text-primary">
                                          ₹{booking.total_amount?.toLocaleString('en-IN') || '0'}
                                        </p>
                                        {booking.advance_amount && (
                                          <p className="text-sm text-muted-foreground">
                                            ₹{booking.advance_amount.toLocaleString('en-IN')} paid
                                          </p>
                                        )}
                                      </div>
                                      
                                      <div className="w-full sm:w-auto">
                                        <Button 
                                          variant="default" 
                                          size="sm" 
                                          className="w-full"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handlePayBooking(booking);
                                          }}
                            {searchTerm ? 'Try adjusting your search' : 'This client doesn\'t have any bookings yet'}
                          </p>
                          {searchTerm && (
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="mt-3"
                              onClick={() => setSearchTerm('')}
                            >
                              Clear search
                            </Button>
                          )}
                        </div>
                      )}
                    </TabsContent>
                    
                    {/* Payments Tab */}
                    <TabsContent value="payments" className="space-y-6">
                      {/* Payment Summary Cards */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Card className="border-green-200 bg-green-50">
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-green-800">Total Received</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="text-2xl font-bold text-green-600">
                              ₹{paymentSummary?.totalReceived?.toLocaleString() || '0'}
                            </div>
                            <p className="text-xs text-green-600 mt-1">
                              {paymentSummary?.recentPayments?.length || 0} completed payment{paymentSummary?.recentPayments?.length !== 1 ? 's' : ''}
                            </p>
                          </CardContent>
                        </Card>
                        
                        <Card className="border-yellow-200 bg-yellow-50">
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-yellow-800">Total Pending</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="text-2xl font-bold text-yellow-600">
                              ₹{paymentSummary?.totalPending?.toLocaleString() || '0'}
                            </div>
                            <p className="text-xs text-yellow-600 mt-1">
                              Across {paymentSummary?.bookingSummaries?.filter(b => b.pendingAmount > 0).length || 0} booking{paymentSummary?.bookingSummaries?.filter(b => b.pendingAmount > 0).length !== 1 ? 's' : ''}
                            </p>
                          </CardContent>
                        </Card>
                      </div>

                      {/* Bookings with Pending Payments */}
                      {paymentSummary?.bookingSummaries?.filter(b => b.pendingAmount > 0).length > 0 && (
                        <div className="space-y-4">
                          <h4 className="font-medium text-yellow-700">Pending by Booking</h4>
                          <div className="grid gap-4">
                            {paymentSummary.bookingSummaries
                              .filter(booking => booking.pendingAmount > 0)
                              .map(booking => (
                                <Card key={booking.bookingId} className="border-l-4 border-yellow-400">
                                  <CardContent className="p-4">
                                    <div className="flex justify-between items-start">
                                      <div>
                                        <h4 className="font-medium">{booking.eventName}</h4>
                                        <div className="text-sm text-muted-foreground mt-1">
                                          <p>Total Amount: ₹{booking.totalAmount?.toLocaleString() || '0'}</p>
                                          <p>Paid: ₹{booking.totalPaid?.toLocaleString() || '0'}</p>
                                        </div>
                                      </div>
                                      <div className="text-right flex flex-col items-end">
                                        <div className="text-lg font-bold text-yellow-600">
                                          ₹{booking.pendingAmount?.toLocaleString() || '0'}
                                        </div>
                                        <p className="text-xs text-yellow-600 mb-2">Pending</p>
                                        <Button 
                                          size="sm" 
                                          className="bg-green-600 hover:bg-green-700 text-white whitespace-nowrap"
                                          onClick={() => handlePayBooking(booking)}
                                        >
                                          Pay Now
                                        </Button>
                                      </div>
                                    </div>
                                  </CardContent>
                                </Card>
                              ))}
                          </div>
                        </div>
                      )}

                      {/* Recent Payments Section */}
                      <div className="space-y-3">
                        <h4 className="font-medium text-green-700">
                          Recent Payment History
                        </h4>
                        {paymentSummary?.recentPayments && paymentSummary.recentPayments.length > 0 ? (
                          paymentSummary.recentPayments.map((payment) => (
                            <PaymentCard key={payment.id} payment={payment} />
                          ))
                        ) : (
                          <div className="text-center py-8 text-muted-foreground">
                            <p>No payment history found</p>
                          </div>
                        )}
                      </div>
                    </TabsContent>
                  </>
                )}
              </div>
            </Tabs>
          </DialogContent>
        </Dialog>
      )}

      {/* Booking Detail Dialog */}
      {selectedBooking && (
        <BookingDetailDialog
          booking={selectedBooking}
          open={bookingDetailOpen}
          onOpenChange={setBookingDetailOpen}
          onUpdate={() => {
            // Refresh bookings when the booking is updated
            if (selectedClient) {
              fetchClientData(selectedClient.id);
            }
          }}
        />
      )}

      {/* Payment Dialog */}
      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent className="w-[95vw] max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg md:text-xl font-semibold">
              Record Payment for {selectedBooking?.eventName}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handlePaymentSubmit} className="space-y-6 p-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-6">
              <div className="space-y-2">
                <Label htmlFor="amount" className="text-sm font-medium">Amount (₹) *</Label>
                <Input
                  className="h-10 text-sm"
                  id="amount"
                  type="number"
                  step="0.01"
                  value={paymentForm.amount || ""}
                  onChange={(e) => setPaymentForm({ ...paymentForm, amount: parseFloat(e.target.value) || 0 })}
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
                  value={paymentForm.payment_date}
                  onChange={(e) => setPaymentForm({ ...paymentForm, payment_date: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="payment_method" className="text-sm font-medium">Payment Method *</Label>
                <Select 
                  value={paymentForm.payment_method} 
                  onValueChange={(value) => setPaymentForm({ ...paymentForm, payment_method: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="card">Card</SelectItem>
                    <SelectItem value="upi">UPI</SelectItem>
                    <SelectItem value="razorpay">Razorpay</SelectItem>
                    <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="payment_type" className="text-sm font-medium">Payment Type *</Label>
                <Select 
                  value={paymentForm.payment_type} 
                  onValueChange={(value) => setPaymentForm({ ...paymentForm, payment_type: value })}
                  disabled={true}
                >
                  <SelectTrigger className="bg-muted">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="full">Full Payment</SelectItem>
                    <SelectItem value="partial">Partial Payment</SelectItem>
                    <SelectItem value="advance">Advance Payment</SelectItem>
                    <SelectItem value="overpaid">Overpaid</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Auto-selected based on amount and advance payment</p>
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
                  value={paymentForm.notes}
                  onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                  placeholder="Additional notes about this payment..."
                  className="min-h-[100px]"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setPaymentDialogOpen(false)}
                className="px-6"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                className="px-6"
                disabled={isSubmittingPayment}
              >
                {isSubmittingPayment ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Processing...
                  </>
                ) : (
                  'Record Payment'
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="md:max-w-sm">
          <DialogHeader>
            <DialogTitle>Confirm Delete</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete this client? This action cannot be undone.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={confirmDeleteClient}>Delete</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Client Confirmation Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="md:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm Client Details</DialogTitle>
            <DialogDescription>
              Please review the client details before saving:
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <p><span className="font-medium">Name:</span> {formData.name}</p>
              {formData.email && <p><span className="font-medium">Email:</span> {formData.email}</p>}
              <p><span className="font-medium">Phone:</span> {formData.phone}</p>
              {formData.city && <p><span className="font-medium">City:</span> {formData.city}</p>}
              {formData.pincode && <p><span className="font-medium">Pincode:</span> {formData.pincode}</p>}
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowConfirmDialog(false)}
            >
              Cancel
            </Button>
            <Button 
              type="button" 
              onClick={saveClient}
            >
              Confirm & Save
            </Button>
          </DialogFooter>
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

export default Clients;
