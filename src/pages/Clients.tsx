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
import { Mail, Phone, Plus, Search, User, MessageCircle, X, Pencil, Trash2, Eye, MapPin, Calendar, ChevronLeft, ChevronRight, ChevronsUpDown, MessageSquare, CreditCard } from "lucide-react";
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
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [totalClients, setTotalClients] = useState(0);
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
  const [selectedBooking, setSelectedBooking] = useState<any>(null);
  const [bookingDetailOpen, setBookingDetailOpen] = useState(false);
  
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

  const fetchClients = async (page = 1) => {
    const from = (page - 1) * itemsPerPage;
    const to = from + itemsPerPage - 1;
    
    // Get total count
    const { count } = await supabase
      .from('clients')
      .select('*', { count: 'exact', head: true })
      .eq('vendor_id', user!.id);
      
    setTotalClients(count || 0);
    
    // Get paginated data
    const { data, error } = await supabase
      .from("clients")
      .select("*")
      .eq("vendor_id", user!.id)
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error) {
      toast.error("Failed to fetch clients");
      console.error(error);
    } else {
      setClients(data || []);
      setCurrentPage(page);
    }
  };
  
  const totalPages = Math.ceil(totalClients / itemsPerPage);
  
  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      fetchClients(newPage);
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

  const deleteClient = async (id: string) => {
    setClientToDelete(id);
    setDeleteDialogOpen(true);
  };

  const confirmDeleteClient = async () => {
    if (!clientToDelete) return;
    const { error } = await supabase.from("clients").delete().eq("id", clientToDelete);
    if (error) {
      toast.error("Failed to delete client");
    } else {
      toast.success("Client deleted");
      fetchClients();
    }
    setDeleteDialogOpen(false);
    setClientToDelete(null);
  };

  const openEditDialog = (client: any) => {
    setFormData({
      name: client.name,
      email: client.email || "",
      phone: client.phone || "",
      whatsappNumber: client.whatsappNumber || client.phone || "",
      useSameNumber: !client.whatsappNumber || client.whatsappNumber === client.phone,
      notes: client.notes || "",
      stage: client.stage || "client",
      fullAddress: client.full_address || "",
      city: client.city || "",
      pincode: client.pincode || "",
      landmark: client.landmark || "",
      googleMapsLink: client.google_maps_link || ""
    });
    setEditingClient(client);
    setIsOpen(true);
  };

  const openClientDetail = async (client: any) => {
    setSelectedClient(client);
    setActiveTab("details");
    setClientDetailOpen(true);
    setIsLoading(true);
    
    try {
      // Fetch all client data
      await Promise.all([
        fetchCommunicationLogs(client.id),
        fetchClientData(client.id)
      ]);
    } catch (error) {
      console.error("Error fetching client details:", error);
      toast.error("Failed to load client details");
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch client data including bookings and payments
  const PaymentCard = ({ payment }: { payment: Payment }) => (
    <Card key={payment.id} className="border-border/40 hover:bg-muted/50 transition-colors">
      <CardContent className="p-4">
        <div className="flex justify-between items-start">
          <div>
            <h4 className="font-medium">
              {payment.booking?.event_name ? 
                `Payment for ${payment.booking.event_name}` : 'Payment'}
            </h4>
            <div className="text-sm text-muted-foreground mt-1">
              <p>Transaction ID: {payment.transaction_id || 'N/A'}</p>
              <p>Method: {payment.payment_method || 'N/A'}</p>
              <p>Status: 
                <span className={`ml-1 px-2 py-0.5 rounded-full text-xs ${
                  payment.status === 'completed' ? 'bg-green-100 text-green-800' :
                  payment.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                  payment.status === 'failed' ? 'bg-red-100 text-red-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {payment.status || 'unknown'}
                </span>
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="font-medium">₹{payment.amount?.toLocaleString() || '0'}</p>
            <p className="text-xs text-muted-foreground">
              {format(parseISO(payment.payment_date || payment.created_at), 'MMM d, yyyy')}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const fetchClientData = async (clientId: string) => {
    try {
      setIsLoading(true);
      const [bookingsData, paymentsData] = await Promise.all([
        fetchClientBookings(clientId),
        fetchClientPayments(clientId)
      ]);
      setBookings(bookingsData);
      setPayments(paymentsData);
      
      // Get payment summary
      const summary = await getPaymentSummary(clientId);
      setPaymentSummary(summary);
    } catch (error) {
      console.error('Error fetching client data:', error);
      toast.error('Failed to load client data');
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
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
    setEditingClient(null);
    setShowConfirmDialog(false);
  };

  const getStageColor = (stage: string) => {
    switch (stage) {
      case "lead": return "bg-blue-100 text-blue-800";
      case "prospect": return "bg-yellow-100 text-yellow-800";
      case "client": return "bg-green-100 text-green-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const filteredClients = clients
    .filter(c => c.stage === "client")
    .filter(c => {
      if (!searchTerm.trim()) return true;
      const term = searchTerm.toLowerCase();
      return (
        (c.name && c.name.toLowerCase().includes(term)) ||
        (c.email && c.email.toLowerCase().includes(term)) ||
        (c.phone && c.phone.toLowerCase().includes(term)) ||
        (c.city && c.city.toLowerCase().includes(term))
      );
    });

  return (
    <div className="space-y-4 md:space-y-8 animate-fade-in">
      <div className="text-center space-y-1 md:space-y-2">
        <h1 className="text-2xl md:text-4xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
          Clients & CRM
        </h1>
        <p className="text-muted-foreground text-sm md:text-lg">Manage leads, prospects, and clients</p>
      </div>

      {/* Search, Filter and Add Button */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 md:gap-4">

        {/* Search bar */}
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search clients..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-9 md:h-10 rounded-lg"
          />
        </div>

        <Dialog open={isOpen} onOpenChange={(open) => {
          setIsOpen(open);
          if (!open) {
            setEditingClient(null);
            resetForm();
          }
        }}>
          <DialogTrigger asChild>
            <Button className="btn-primary touch-feedback w-full sm:w-auto h-9 md:h-10 text-xs md:text-sm px-3 md:px-4">
              <Plus className="mr-1 md:mr-2 h-3.5 w-3.5 md:h-4 md:w-4" />
              <span className="hidden sm:inline">Add Client</span>
              <span className="sm:hidden">Add</span>
            </Button>
          </DialogTrigger>
          <DialogContent className="md:max-w-2xl w-full md:w-auto rounded-t-2xl md:rounded-xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-lg md:text-xl font-semibold">
                {editingClient ? "Edit Client" : "Add New Client"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                {/* Left Column - Basic Info */}
                <div className="space-y-5">
                  <div className="space-y-1.5">
                    <Label htmlFor="name" className="text-sm font-medium text-foreground/80">Name *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                      placeholder="Client name"
                      className="h-10 rounded-lg border-input focus-visible:ring-2 focus-visible:ring-offset-2"
                    />
                  </div>
                  
                  <div className="space-y-1.5">
                    <Label htmlFor="email" className="text-sm font-medium text-foreground/80">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="email@example.com"
                      className="h-10 rounded-lg border-input focus-visible:ring-2 focus-visible:ring-offset-2"
                    />
                  </div>
                  
                  <div className="space-y-1.5">
                    <Label htmlFor="phone" className="text-sm font-medium text-foreground/80">Phone Number *</Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={formData.phone}
                      onChange={handlePhoneChange}
                      placeholder="9876543210"
                      className="h-10 rounded-lg border-input focus-visible:ring-2 focus-visible:ring-offset-2"
                      required
                      pattern="[0-9]{10}"
                      title="Please enter a 10-digit phone number"
                    />
                  </div>
                  
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="whatsappNumber" className="text-sm font-medium text-foreground/80">
                        WhatsApp Number *
                      </Label>
                      <div className="flex items-center space-x-2">
                        <Checkbox 
                          id="useSameNumber"
                          checked={formData.useSameNumber}
                          onCheckedChange={toggleUseSameNumber}
                          className="h-4 w-4 rounded border-input"
                        />
                        <Label htmlFor="useSameNumber" className="text-xs text-muted-foreground cursor-pointer">
                          Same as phone
                        </Label>
                      </div>
                    </div>
                    <Input
                      id="whatsappNumber"
                      type="tel"
                      value={formData.whatsappNumber}
                      onChange={handleWhatsAppChange}
                      placeholder="9876543210"
                      className={`h-10 rounded-lg border-input focus-visible:ring-2 focus-visible:ring-offset-2 ${
                        formData.useSameNumber ? 'bg-muted/50' : ''
                      }`}
                      required
                      pattern="[0-9]{10}"
                      title="Please enter a 10-digit phone number"
                      disabled={formData.useSameNumber}
                    />
                  </div>
                  
                  <div className="space-y-1.5">
                    <Label htmlFor="stage" className="text-sm font-medium text-foreground/80">
                      Stage
                    </Label>
                    <Select
                      value={formData.stage}
                      onValueChange={(value) => setFormData({ ...formData, stage: value })}
                    >
                      <SelectTrigger className="h-10 w-full rounded-lg border-input focus:ring-2 focus:ring-offset-2">
                        <SelectValue placeholder="Select stage" />
                      </SelectTrigger>
                      <SelectContent className="rounded-lg border-input shadow-lg">
                        <SelectItem value="lead" className="py-2">Lead</SelectItem>
                        <SelectItem value="prospect" className="py-2">Prospect</SelectItem>
                        <SelectItem value="client" className="py-2">Client</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {/* Right Column - Address & Notes */}
                <div className="space-y-5">
                  <div className="space-y-1.5">
                    <Label htmlFor="fullAddress" className="text-sm font-medium text-foreground/80">Full Address</Label>
                    <Textarea
                      id="fullAddress"
                      value={formData.fullAddress}
                      onChange={(e) => setFormData({ ...formData, fullAddress: e.target.value })}
                      rows={2}
                      placeholder="Full address with street, area, etc."
                      className="min-h-[80px] rounded-lg border-input focus-visible:ring-2 focus-visible:ring-offset-2"
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="city" className="text-sm font-medium text-foreground/80">City</Label>
                      <Input
                        id="city"
                        value={formData.city}
                        onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                        placeholder="City"
                        className="h-10 rounded-lg border-input focus-visible:ring-2 focus-visible:ring-offset-2"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="pincode" className="text-sm font-medium text-foreground/80">Pincode</Label>
                      <Input
                        id="pincode"
                        value={formData.pincode}
                        onChange={(e) => setFormData({ ...formData, pincode: e.target.value })}
                        placeholder="Pincode"
                        className="h-10 rounded-lg border-input focus-visible:ring-2 focus-visible:ring-offset-2"
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-1.5">
                    <Label htmlFor="landmark" className="text-sm font-medium text-foreground/80">Landmark</Label>
                    <Input
                      id="landmark"
                      value={formData.landmark}
                      onChange={(e) => setFormData({ ...formData, landmark: e.target.value })}
                      placeholder="Nearby landmark"
                      className="h-10 rounded-lg border-input focus-visible:ring-2 focus-visible:ring-offset-2"
                    />
                  </div>
                  
                  <div className="space-y-1.5">
                    <Label htmlFor="googleMapsLink" className="text-sm font-medium text-foreground/80">
                      Google Maps Link
                    </Label>
                    <Input
                      id="googleMapsLink"
                      type="url"
                      value={formData.googleMapsLink}
                      onChange={(e) => setFormData({ ...formData, googleMapsLink: e.target.value })}
                      placeholder="https://maps.app.goo.gl/..."
                      className="h-10 rounded-lg border-input focus-visible:ring-2 focus-visible:ring-offset-2"
                    />
                    <p className="text-xs text-muted-foreground mt-1.5">Paste the Google Maps share link for this location</p>
                  </div>
                  
                  <div className="space-y-1.5">
                    <Label htmlFor="notes" className="text-sm font-medium text-foreground/80">Notes</Label>
                    <Textarea
                      id="notes"
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      rows={3}
                      placeholder="Additional notes..."
                      className="min-h-[100px] rounded-lg border-input focus-visible:ring-2 focus-visible:ring-offset-2"
                    />
                  </div>
                </div>
              </div>
                <div className="flex justify-end gap-3 pt-2 border-t border-border mt-4 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsOpen(false);
                      resetForm();
                    }}
                    className="h-10 rounded-lg px-4 font-medium"
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    className="h-10 rounded-lg px-6 font-medium bg-primary hover:bg-primary/90"
                  >
                    {editingClient ? "Update Client" : "Add Client"}
                  </Button>
                </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Client Cards */}
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4 lg:gap-6">
        {filteredClients.length === 0 ? (
          <Card className="col-span-full glass card-hover rounded-xl md:rounded-2xl border-0 shadow-card">
            <CardContent className="flex flex-col items-center justify-center py-8 md:py-12">
              <User className="h-10 w-10 md:h-12 md:w-12 text-muted-foreground/50 mb-3 md:mb-4" />
              <p className="text-muted-foreground text-base md:text-lg mb-2">No clients yet</p>
              <p className="text-xs md:text-sm text-muted-foreground/70">Add your first client to get started</p>
            </CardContent>
          </Card>
        ) : (
          filteredClients.map((client) => (
            <Card
              key={client.id}
              className="group glass card-hover rounded-xl md:rounded-2xl border-0 shadow-card flex flex-col"
            >
              <CardHeader className="pb-2 md:pb-3 pt-4 md:pt-6 px-4 md:px-6">
                <CardTitle className="flex items-center justify-between gap-2">
                  <span className="text-base md:text-lg font-semibold text-foreground truncate">
                    {client.name}
                  </span>
                  <Badge className={getStageColor(client.stage || "lead")}>
                    {client.stage || "lead"}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="px-6 pb-6 flex flex-col flex-1">
                <div className="space-y-3 flex-1">
                  <div className="flex items-center text-sm text-muted-foreground">
                    <Mail className="mr-2 h-4 w-4" />
                    {client.email}
                  </div>
                  {client.phone && (
                    <div className="flex items-center text-sm text-muted-foreground">
                      <Phone className="mr-2 h-4 w-4" />
                      {client.phone}
                    </div>
                  )}
                  {(client.full_address || client.city) && (
                    <div className="text-sm text-muted-foreground space-y-1">
                      {client.full_address && (
                        <p className="line-clamp-1">{client.full_address}</p>
                      )}
                      <div className="flex items-center gap-2 text-xs">
                        {client.city && <span>{client.city}</span>}
                        {client.pincode && <span>• {client.pincode}</span>}
                      </div>
                    </div>
                  )}
                  {client.notes && (
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {client.notes}
                    </p>
                  )}
                  {client.created_at && (
                    <div className="text-xs text-muted-foreground/70 mt-1">
                      Added on {format(new Date(client.created_at), 'MMM d, yyyy')}
                    </div>
                  )}
                </div>
                {/* Action Buttons */}
                <div className="flex justify-between items-center pt-3 border-t border-gray-100 mt-3">
                  <div className="flex gap-2">
                    {client.email && (
                      <Button
                        variant="outline"
                        size="sm"
                        asChild
                        className="h-8 w-8 p-0"
                      >
                        <a 
                          href={`mailto:${client.email}`}
                          onClick={(e) => e.stopPropagation()}
                          title="Send Email"
                        >
                          <Mail className="h-4 w-4" />
                        </a>
                      </Button>
                    )}
                    {client.phone && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          asChild
                          className="h-8 w-8 p-0"
                        >
                          <a 
                            href={`tel:${client.phone.replace(/\D/g, '')}`}
                            onClick={(e) => e.stopPropagation()}
                            title="Make a call"
                          >
                            <Phone className="h-4 w-4" />
                          </a>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          asChild
                          className="h-8 w-8 p-0"
                        >
                          <a 
                            href={`https://wa.me/91${client.phone.replace(/\D/g, '')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            title="Message on WhatsApp"
                          >
                            <MessageCircle className="h-4 w-4" />
                          </a>
                        </Button>
                      </>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        openClientDetail(client);
                      }}
                      title="View details"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        openEditDialog(client);
                      }}
                      title="Edit client"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteClient(client.id);
                      }}
                      className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200 hover:border-red-300"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                {/* Edit/Delete Buttons */}
                <div className="flex gap-2 pt-3 mt-auto">
                </div>
              </CardContent>
            </Card>
          ))
        )}
        </div>
        
        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex flex-col sm:flex-row justify-between items-center gap-3 sm:gap-4 mt-6 px-2">
            <div className="text-xs sm:text-sm text-muted-foreground whitespace-nowrap">
              <span className="hidden sm:inline">Showing </span>
              <span className="font-medium">
                {(currentPage - 1) * itemsPerPage + 1}-{
                  Math.min(currentPage * itemsPerPage, totalClients)
                }
              </span>
              <span className="hidden sm:inline"> of <span className="font-medium">{totalClients}</span> clients</span>
            </div>
            
            <div className="flex items-center gap-1 sm:gap-2 w-full sm:w-auto justify-between sm:justify-normal">
              <div className="flex items-center gap-1 sm:gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(1)}
                  disabled={currentPage === 1}
                  className="h-8 w-8 sm:h-9 sm:w-9 p-0"
                  title="First page"
                >
                  <ChevronsUpDown className="h-4 w-4 -rotate-90" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="h-8 w-8 sm:h-9 sm:w-9 p-0"
                  title="Previous page"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
              </div>
              
              <div className="hidden sm:flex items-center gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }
                  
                  return (
                    <Button
                      key={pageNum}
                      variant={currentPage === pageNum ? "default" : "outline"}
                      size="sm"
                      className="h-9 w-9 p-0 min-w-9"
                      onClick={() => handlePageChange(pageNum)}
                    >
                      {pageNum}
                    </Button>
                  );
                })}
              </div>
              
              <div className="flex items-center gap-1 sm:gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="h-8 w-8 sm:h-9 sm:w-9 p-0"
                  title="Next page"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(totalPages)}
                  disabled={currentPage === totalPages}
                  className="h-8 w-8 sm:h-9 sm:w-9 p-0"
                  title="Last page"
                >
                  <ChevronsUpDown className="h-4 w-4 rotate-90" />
                </Button>
              </div>
            </div>
            
            {/* Mobile page info */}
            <div className="text-xs text-muted-foreground sm:hidden w-full text-center">
              Page {currentPage} of {totalPages}
            </div>
          </div>
        )}
      </div>

      {/* Client Detail Dialog with CRM Features */}
      {selectedClient && (
        <Dialog open={clientDetailOpen} onOpenChange={setClientDetailOpen}>
          <DialogContent className="sm:max-w-4xl max-h-[95vh] overflow-y-auto p-0 w-[calc(100%-1rem)] sm:w-full rounded-lg">
            <DialogHeader className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b p-2 sm:p-3 flex-shrink-0">
              <div className="flex flex-col space-y-1">
                <div className="flex justify-between items-start gap-1">
                  <DialogTitle className="text-lg sm:text-xl font-semibold tracking-tight break-words max-w-full">
                    {selectedClient.name}
                  </DialogTitle>
                  <div className="flex items-center gap-0.5 sm:gap-1.5 flex-shrink-0">
                    {selectedClient.email && (
                      <Button variant="ghost" size="icon" className="h-7 w-7 sm:h-8 sm:w-8">
                        <a
                          href={`mailto:${selectedClient.email}`}
                          title="Send Email"
                          className="flex items-center justify-center"
                        >
                          <Mail className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                        </a>
                      </Button>
                    )}
                    {selectedClient.phone && (
                      <>
                        <Button variant="ghost" size="icon" className="h-7 w-7 sm:h-8 sm:w-8">
                          <a
                            href={`tel:${selectedClient.phone.replace(/\D/g, '')}`}
                            title="Call"
                            className="flex items-center justify-center"
                          >
                            <Phone className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                          </a>
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 sm:h-8 sm:w-8">
                          <a
                            href={`https://wa.me/91${(selectedClient.whatsapp_number || selectedClient.phone).replace(/\D/g, '')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="WhatsApp"
                            className="flex items-center justify-center"
                          >
                            <MessageCircle className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                          </a>
                        </Button>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="inline-flex items-center">
                    <Calendar className="h-3 w-3 mr-1 opacity-70" />
                    {format(new Date(selectedClient.created_at), 'MMM d, yyyy')}
                  </span>
                  <span className="h-0.5 w-0.5 rounded-full bg-muted-foreground/40"></span>
                  <span className="inline-flex items-center">
                    <User className="h-3 w-3 mr-1 opacity-70" />
                    <span className="capitalize">{selectedClient.stage || 'client'}</span>
                  </span>
                </div>
              </div>
            </DialogHeader>
            
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full -mt-1">
              <TabsList className="grid w-full grid-cols-3 h-8 sm:h-9 text-[10px] sm:text-xs rounded-none">
                <TabsTrigger value="details" className="flex items-center gap-0.5 sm:gap-1.5 px-1 sm:px-2">
                  <User className="h-2.5 w-2.5 sm:h-3.5 sm:w-3.5 flex-shrink-0" />
                  <span className="truncate">Details</span>
                </TabsTrigger>
                <TabsTrigger value="bookings" className="flex items-center gap-0.5 sm:gap-1.5 px-1 sm:px-2">
                  <Calendar className="h-2.5 w-2.5 sm:h-3.5 sm:w-3.5 flex-shrink-0" />
                  <span>Bookings</span>
                  {bookings.length > 0 && (
                    <span className="inline-flex items-center justify-center h-3.5 w-3.5 sm:h-4 sm:w-4 text-[9px] sm:text-[10px] font-medium rounded-full bg-primary/10 text-primary ml-auto">
                      {bookings.length}
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="payments" className="flex items-center gap-0.5 sm:gap-1.5 px-1 sm:px-2">
                  <CreditCard className="h-2.5 w-2.5 sm:h-3.5 sm:w-3.5 flex-shrink-0" />
                  <span>Payments</span>
                  {payments.length > 0 && (
                    <span className="inline-flex items-center justify-center h-3.5 w-3.5 sm:h-4 sm:w-4 text-[9px] sm:text-[10px] font-medium rounded-full bg-primary/10 text-primary ml-auto">
                      {payments.length}
                    </span>
                  )}
                </TabsTrigger>
              </TabsList>
              
              <div className="p-3 sm:p-4">
                {isLoading ? (
                  <div className="flex justify-center items-center h-40">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                ) : (
                  <>
                    <TabsContent value="details" className="space-y-6">
                      {/* Contact Information Card */}
                      <Card className="border-border/40 overflow-hidden">
                        <CardHeader className="bg-muted/30 px-4 sm:px-6 py-3 sm:py-4 border-b">
                          <CardTitle className="text-base sm:text-lg">Contact Information</CardTitle>
                        </CardHeader>
                        <CardContent className="p-3 sm:p-6 space-y-3 sm:space-y-4">
                          {/* Email */}
                          {selectedClient.email && (
                            <div className="flex items-start gap-3 p-2 sm:p-3 -mx-2 rounded-lg hover:bg-muted/50 transition-colors">
                              <div className="p-1.5 sm:p-2 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 flex-shrink-0">
                                <Mail className="h-4 w-4 sm:h-5 sm:w-5" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs sm:text-sm font-medium text-muted-foreground">Email</p>
                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mt-1 gap-2">
                                  <p className="text-xs sm:text-sm truncate">{selectedClient.email}</p>
                                  <a
                                    href={`mailto:${selectedClient.email}`}
                                    className="text-xs sm:text-sm text-primary hover:underline flex items-center justify-center sm:justify-start px-2 sm:px-3 py-1 sm:py-1.5 rounded-md hover:bg-accent transition-colors whitespace-nowrap"
                                    title="Send Email"
                                  >
                                    <Mail className="h-3 w-3 sm:h-4 sm:w-4 mr-1" /> 
                                    <span>Email</span>
                                  </a>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Phone */}
                          {selectedClient.phone && (
                            <div className="flex items-start gap-3 p-2 sm:p-3 -mx-2 rounded-lg hover:bg-muted/50 transition-colors">
                              <div className="p-1.5 sm:p-2 rounded-lg bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 flex-shrink-0">
                                <Phone className="h-4 w-4 sm:h-5 sm:w-5" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs sm:text-sm font-medium text-muted-foreground">Phone</p>
                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mt-1 gap-2">
                                  <p className="text-xs sm:text-sm truncate">{selectedClient.phone}</p>
                                  <div className="flex gap-2 flex-wrap">
                                    <a
                                      href={`tel:${selectedClient.phone.replace(/\D/g, '')}`}
                                      className="text-xs sm:text-sm text-primary hover:underline flex items-center justify-center px-2 sm:px-3 py-1 sm:py-1.5 rounded-md border hover:bg-accent transition-colors whitespace-nowrap"
                                      title="Make a call"
                                    >
                                      <Phone className="h-3 w-3 sm:h-4 sm:w-4 mr-1" /> 
                                      <span>Call</span>
                                    </a>
                                    <a
                                      href={`https://wa.me/91${selectedClient.phone.replace(/\D/g, '')}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-xs sm:text-sm text-primary hover:underline flex items-center justify-center px-2 sm:px-3 py-1 sm:py-1.5 rounded-md border hover:bg-accent transition-colors whitespace-nowrap"
                                      title="Message on WhatsApp"
                                    >
                                      <MessageCircle className="h-3 w-3 sm:h-4 sm:w-4 mr-1" /> 
                                      <span>WhatsApp</span>
                                    </a>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* WhatsApp (if different from phone) */}
                          {selectedClient.whatsapp_number && selectedClient.whatsapp_number !== selectedClient.phone && (
                            <div className="flex items-start gap-3 p-2 sm:p-3 -mx-2 rounded-lg hover:bg-muted/50 transition-colors">
                              <div className="p-1.5 sm:p-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 flex-shrink-0">
                                <MessageCircle className="h-4 w-4 sm:h-5 sm:w-5" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs sm:text-sm font-medium text-muted-foreground">WhatsApp</p>
                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mt-1 gap-2">
                                  <p className="text-xs sm:text-sm truncate">{selectedClient.whatsapp_number}</p>
                                  <a
                                    href={`https://wa.me/91${selectedClient.whatsapp_number.replace(/\D/g, '')}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs sm:text-sm text-primary hover:underline flex items-center justify-center px-2 sm:px-3 py-1 sm:py-1.5 rounded-md border hover:bg-accent transition-colors whitespace-nowrap"
                                    title="Message on WhatsApp"
                                  >
                                    <MessageCircle className="h-4 w-4 mr-1.5" /> Message
                                  </a>
                                </div>
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>

                      {/* Address Card */}
                      <Card className="border-border/40 overflow-hidden">
                        <CardHeader className="bg-muted/30 px-6 py-4 border-b">
                          <CardTitle className="text-lg">Address</CardTitle>
                        </CardHeader>
                        <CardContent>
                          {selectedClient.full_address || selectedClient.city || selectedClient.pincode ? (
                            <div className="space-y-3">
                              <div className="flex items-start gap-4">
                                <div className="p-2 rounded-lg bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400">
                                  <MapPin className="h-5 w-5" />
                                </div>
                                <div className="flex-1">
                                  {selectedClient.full_address && (
                                    <p className="text-sm">{selectedClient.full_address}</p>
                                  )}
                                  <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                                    {selectedClient.city && <span>{selectedClient.city}</span>}
                                    {selectedClient.pincode && <span>• {selectedClient.pincode}</span>}
                                  </div>
                                  {selectedClient.landmark && (
                                    <p className="text-sm text-muted-foreground mt-1">
                                      <span className="font-medium">Landmark:</span> {selectedClient.landmark}
                                    </p>
                                  )}
                                  {selectedClient.google_maps_link && (
                                    <a
                                      href={selectedClient.google_maps_link}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center text-sm text-primary hover:underline mt-2"
                                    >
                                      <MapPin className="h-4 w-4 mr-1.5" />
                                      View on Map
                                    </a>
                                  )}
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center text-muted-foreground">
                              <MapPin className="h-4 w-4 mr-2 text-muted-foreground" />
                              <p className="text-sm">No address provided</p>
                            </div>
                          )}
                        </CardContent>
                      </Card>

                      {/* Additional Information */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Client Stage */}
                        <Card className="border-border/40 overflow-hidden">
                          <CardHeader className="bg-muted/30 px-6 py-4 border-b">
                            <CardTitle className="text-lg">Client Stage</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="flex items-center gap-3">
                              <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400">
                                <User className="h-5 w-5" />
                              </div>
                              <div>
                                <p className="text-sm font-medium text-muted-foreground">Current Stage</p>
                                <p className="text-sm capitalize">{selectedClient.stage || 'Not specified'}</p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>

                        {/* Client Since */}
                        <Card className="border-border/40 overflow-hidden">
                          <CardHeader className="bg-muted/30 px-6 py-4 border-b">
                            <CardTitle className="text-lg">Member Since</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="flex items-center gap-3">
                              <div className="p-2 rounded-lg bg-cyan-50 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400">
                                <Calendar className="h-5 w-5" />
                              </div>
                              <div>
                                <p className="text-sm font-medium text-muted-foreground">Client Since</p>
                                <p className="text-sm">
                                  {format(new Date(selectedClient.created_at), 'MMM d, yyyy')}
                                </p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </div>

                      {/* Notes */}
                      {selectedClient.notes && (
                        <Card className="border-border/40 overflow-hidden">
                          <CardHeader className="bg-muted/30 px-6 py-4 border-b">
                            <CardTitle className="text-lg">Notes</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="p-4 bg-muted/30 rounded-lg">
                              <p className="text-sm whitespace-pre-line">
                                {selectedClient.notes}
                              </p>
                            </div>
                          </CardContent>
                        </Card>
                      )}
                    </TabsContent>
                    
                    {/* Bookings Tab */}
                    <TabsContent value="bookings" className="space-y-4">
                      <div className="mb-4">
                        <h3 className="text-lg font-medium">Client Bookings</h3>
                        <p className="text-sm text-muted-foreground">
                          View all bookings for this client
                        </p>
                      </div>

                      {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-12 space-y-4">
                          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
                          <p className="text-muted-foreground">Loading bookings...</p>
                        </div>
                      ) : bookings.length > 0 ? (
                        <>
                          <div className="grid gap-4">
                            {bookings.map((booking) => (
                              <Card key={booking.id} className="border-border/40 hover:shadow-md transition-shadow">
                                <CardContent className="p-4">
                                  <div className="flex flex-col sm:flex-row justify-between gap-4">
                                    <div className="flex-1">
                                      <h4 className="font-medium text-base">
                                        {booking.event_name || 'Untitled Event'}
                                      </h4>
                                      
                                      <div className="mt-2 space-y-1.5 text-sm">
                                        <div className="flex items-center text-muted-foreground">
                                          <Calendar className="h-4 w-4 mr-2 opacity-70" />
                                          {booking.event_date ? (
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
                                            setSelectedBooking(booking);
                                            setBookingDetailOpen(true);
                                          }}
                                        >
                                          <Eye className="h-4 w-4 mr-2" />
                                          View Details
                                        </Button>
                                      </div>
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                            ))}
                          </div>
                          
                        </>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed rounded-lg">
                          <Calendar className="h-12 w-12 text-muted-foreground mb-3" />
                          <h4 className="text-lg font-medium text-muted-foreground">No bookings found</h4>
                          <p className="text-sm text-muted-foreground mt-1">
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
                                      <div className="text-right">
                                        <div className="text-lg font-bold text-yellow-600">
                                          ₹{booking.pendingAmount?.toLocaleString() || '0'}
                                        </div>
                                        <p className="text-xs text-yellow-600">Pending</p>
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
