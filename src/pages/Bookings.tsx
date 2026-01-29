import { useEffect, useState, useMemo } from "react";
import { BookingDetailDialog } from "@/components/BookingDetailDialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import ClientForm from "@/components/ClientForm";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Plus, Calendar, MapPin, Pencil, Trash2, Eye, MessageCircle, Download, Upload, Building2, UserPlus, Check, ChevronLeft, ChevronRight, ChevronsUpDown, Search, X, MessageSquare, Clock as Clock4, X as XIcon } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format, parse } from "date-fns";
import QRCode from "qrcode";
import Papa from "papaparse";

// Helper function to format time in 12-hour format with AM/PM
const formatTime12Hour = (timeString: string) => {
  if (!timeString) return '';
  try {
    // Parse the time string (expected format: 'HH:MM')
    const [hours, minutes] = timeString.split(':').map(Number);
    const date = new Date();
    date.setHours(hours, minutes, 0);
    
    // Format as 12-hour time with AM/PM
    return format(date, 'h:mm a');
  } catch (error) {
    console.error('Error formatting time:', error);
    return timeString; // Return original if there's an error
  }
};


const Bookings = () => {
  const { user } = useAuth();
  const [bookings, setBookings] = useState<any[]>([]);
  const [filteredBookings, setFilteredBookings] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [clients, setClients] = useState<any[]>([]);
  const [packages, setPackages] = useState<any[]>([]);
  const [entities, setEntities] = useState<any[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [editingBooking, setEditingBooking] = useState<any>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<any>(null);
  const [conflictDialogOpen, setConflictDialogOpen] = useState(false);
  const [conflictingBookings, setConflictingBookings] = useState<any[]>([]);
  const [createConfirmOpen, setCreateConfirmOpen] = useState(false); 
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [bookingToDelete, setBookingToDelete] = useState<string | null>(null);
  const [isClientDialogOpen, setIsClientDialogOpen] = useState(false);
  const [isClientPopoverOpen, setIsClientPopoverOpen] = useState(false);
  const [newClient, setNewClient] = useState({
    name: "",
    email: "",
    phone: "",
    whatsappNumber: "",
    useSameNumber: true,
    notes: ""
  });
  // Initialize payments state with proper type
  const [paymentsByBooking, setPaymentsByBooking] = useState<Record<string, { paid: number; refunds: number }>>({});
  const [formData, setFormData] = useState({
    event_name: "",
    event_date: "",
    from_time: "",
    to_time: "",
    location: "",
    client_id: "",
    package_id: "",
    entity_id: "",
    total_amount: 0,
  });
  
  // --- Payment state for initial payment ---
  const [paymentData, setPaymentData] = useState({
    amount: 0,
    payment_method: "cash",
    payment_date: new Date().toISOString().split("T")[0],
    payment_type: "full" as "full" | "partial" | "advance" | "overpaid",
    notes: "",
  });
  const [isAdvancePayment, setIsAdvancePayment] = useState(false);

  // Auto-select payment_type based on amount and advance checkbox
  useEffect(() => {
    const totalAmount = Number(formData.total_amount) || 0;

    if (isAdvancePayment) {
      setPaymentData((prev) => ({ ...prev, payment_type: "advance" }));
    } else if (paymentData.amount > 0) {
      if (Math.abs(paymentData.amount - totalAmount) < 0.01) {
        setPaymentData((prev) => ({ ...prev, payment_type: "full" }));
      } else if (paymentData.amount < totalAmount) {
        setPaymentData((prev) => ({ ...prev, payment_type: "partial" }));
      } else if (paymentData.amount > totalAmount) {
        setPaymentData((prev) => ({ ...prev, payment_type: "overpaid" }));
      }
    }
  }, [paymentData.amount, isAdvancePayment, formData.total_amount]);

  // Helper to record initial payment after booking creation
  const recordInitialPayment = async (bookingId: string) => {
    if (paymentData.amount <= 0) return;
    if (paymentData.amount - Number(formData.total_amount) > 0.01) {
      setPaymentData(prev => ({ ...prev, payment_type: "overpaid" }));
    }
    const { error: payErr } = await supabase.from("payments").insert({
      booking_id: bookingId,
      vendor_id: user!.id,
      amount: paymentData.amount,
      payment_method: paymentData.payment_method,
      payment_date: paymentData.payment_date,
      payment_type: paymentData.payment_type,
      notes: paymentData.notes,
    });
    if (payErr) {
      console.error("Failed to record initial payment", payErr);
      toast.error("Failed to record initial payment");
    }
  };

  // Helper function to get derived status of a booking
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

  // Filter and paginate bookings
  const { filteredBookings: filtered, paginatedBookings, totalPages } = useMemo(() => {
    let filtered = [...bookings];

    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(booking => {
        const status = getDerivedStatus(booking);
        return status === statusFilter;
      });
    } else {
      // When 'All' is selected, sort by status (confirmed → completed → cancelled) and then by date
      filtered.sort((a, b) => {
        // Get status for comparison
        const statusOrder = { 'confirmed': 0, 'completed': 1, 'cancelled': 2 };
        const statusA = getDerivedStatus(a);
        const statusB = getDerivedStatus(b);
        
        // First sort by status
        if (statusOrder[statusA] !== statusOrder[statusB]) {
          return statusOrder[statusA] - statusOrder[statusB];
        }
        
        // If status is the same, sort by event date
        const dateA = new Date(a.event_date);
        const dateB = new Date(b.event_date);
        return dateA.getTime() - dateB.getTime();
      });
    }

    // Apply search query filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(booking => {
        return (
          (booking.event_name?.toLowerCase().includes(query)) ||
          (booking.clients?.name?.toLowerCase().includes(query)) ||
          (booking.packages?.name?.toLowerCase().includes(query)) ||
          (booking.location?.toLowerCase().includes(query)) ||
          (booking.id?.toLowerCase().includes(query))
        );
      });
    }
    
    // Calculate pagination
    const totalPages = Math.ceil(filtered.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const paginated = filtered.slice(startIndex, startIndex + itemsPerPage);
    
    return {
      filteredBookings: filtered,
      paginatedBookings: paginated,
      totalPages
    };
  }, [bookings, statusFilter, searchQuery, currentPage, itemsPerPage]);
  
  // Update filteredBookings state when filtered data changes
  useEffect(() => {
    setFilteredBookings(filtered);
  }, [filtered]);
  
  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, searchQuery, itemsPerPage]);
  
  const handlePageChange = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };
  
  const handleItemsPerPageChange = (value: string) => {
    const newItemsPerPage = parseInt(value, 10);
    setItemsPerPage(newItemsPerPage);
    setCurrentPage(1); // Reset to first page when changing items per page
  };

  useEffect(() => {
    if (user) {
      fetchBookings();
      fetchClients();
      fetchPackages();
      fetchEntities();
      fetchPaymentsByBooking();
    }
  }, [user]);

  // Trigger re-render when payments change to update derived status
  useEffect(() => {
    // This will cause the component to re-render with updated status
  }, [paymentsByBooking]);

  const fetchBookings = async () => {
    try {
      const { data, error } = await supabase
        .from("bookings")
        .select(`
          *,
          clients(name),
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

      // Ensure we have proper data structure
      const processedData = (data || []).map(booking => ({
        ...booking,
        total_amount: Number(booking.total_amount) || 0,
        // Add fallbacks for missing fields
        from_time: booking.from_time || '',
        to_time: booking.to_time || '',
        event_date: booking.event_date || '',
        clients: booking.clients || { name: 'Unknown' },
        packages: booking.packages || { name: 'Custom', price: 0 }
      }));

      setBookings(processedData);
      setFilteredBookings(processedData);
    } catch (error) {
      console.error("Unexpected error in fetchBookings:", error);
      toast.error("An unexpected error occurred");
    }
  };

  const fetchPaymentsByBooking = async () => {
    const { data, error } = await supabase
      .from("payments")
      .select("booking_id, amount, payment_type, refund_amount")
      .eq("vendor_id", user!.id);
      
    if (!error && data) {
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
      
      // Update the state with the new payments map
      setPaymentsByBooking(map);
    } else if (error) {
      console.error('Error fetching payments:', error);
      toast.error('Failed to load payment information');
    }
  };


  const getPaymentInfo = (booking: any) => {
    // Default values
    const defaultValues = {
      totalPaid: 0,
      pending: Number(booking?.total_amount) || 0,
      totalAmount: Number(booking?.total_amount) || 0,
      paymentProgress: 0
    };

    try {
      // If no booking or no payments data, return defaults
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

  const fetchClients = async () => {
    const { data } = await supabase
      .from("clients")
      .select("*")
      .eq("vendor_id", user!.id)
      .eq("stage", "client");
    setClients(data || []);
  };

  const fetchPackages = async () => {
    const { data, error } = await supabase
      .from('packages')
      .select("*, entities(name)")
      .eq("vendor_id", user!.id);
    
    if (error) {
      console.error("Error fetching packages:", error);
      toast.error("Failed to load packages");
    } else {
      // Ensure we have the price field in each package
      const packagesWithPrice = data.map(pkg => ({
        ...pkg,
        price: pkg.price || 0
      }));
      setPackages(packagesWithPrice);
    }
  };

  // Handle package selection
  const handlePackageSelect = (packageId: string) => {
    console.log('Selected package ID:', packageId);
    
    if (packageId === 'none') {
      console.log('No package selected, resetting amount');
      setFormData(prev => ({
        ...prev,
        package_id: '',
        total_amount: 0
      }));
      return;
    }
    
    const selectedPackage = packages.find(pkg => pkg.id === packageId);
    console.log('Selected package:', selectedPackage);
    
    if (selectedPackage) {
      const price = Number(selectedPackage.price) || 0;
      console.log('Setting amount to:', price);
      
      setFormData(prev => ({
        ...prev,
        package_id: packageId,
        total_amount: price
      }));
    }
  };

  // Handle manual amount change
  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value) || 0;
    setFormData(prev => ({
      ...prev,
      total_amount: value
    }));
  };

  const fetchEntities = async () => {
    const { data, error } = await supabase
      .from("entities")
      .select("*")
      .eq("vendor_id", user!.id)
      .eq("is_active", true)
      .order("name");
    
    if (error) {
      console.error("Error fetching entities:", error);
      toast.error("Failed to load entities");
    } else {
      setEntities(data || []);
    }
  };

  const handleClientAdded = (client: any) => {
    // Add the new client to the local state
    const newClientData = {
      id: client.id,
      name: client.name,
      email: client.email,
      phone: client.phone
    };
    
    // Update the clients list with the new client
    setClients(prevClients => [...prevClients, newClientData]);
    
    // Update the form with the new client's ID
    setFormData(prev => ({
      ...prev,
      client_id: client.id.toString(),
    }));
    
    // Close the dialog
    setIsClientDialogOpen(false);
    
    // Refresh the full clients list in the background
    fetchClients().catch(console.error);
    
    toast.success("Client added and selected successfully");
  };

  // when called from the form it receives an event -> open confirm dialog first.
  // when called programmatically with confirmed = true it proceeds to validate & save.
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const validateForm = () => {
    const errors: Record<string, string> = {};
    
    if (!formData.client_id) {
      errors.client_id = "Client is required";
    }
    if (!formData.event_name) {
      errors.event_name = "Event name is required";
    }
    if (!formData.event_date) {
      errors.event_date = "Event date is required";
    }
    if (!formData.entity_id) {
      errors.entity_id = "Venue/Branch is required";
    }
    if (formData.from_time && formData.to_time) {
      const [startHours, startMinutes] = formData.from_time.split(':').map(Number);
      const [endHours, endMinutes] = formData.to_time.split(':').map(Number);
      
      const startDate = new Date();
      startDate.setHours(startHours, startMinutes, 0, 0);
      
      const endDate = new Date();
      endDate.setHours(endHours, endMinutes, 0, 0);
      
      if (startDate >= endDate) {
        errors.time = "End time must be after start time";
      }
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e?: React.FormEvent | null, confirmed = false) => {
    if (e) e.preventDefault();

    // If not yet confirmed by user, open the confirmation dialog and stop.
    if (!confirmed) {
      const isValid = validateForm();
      if (!isValid) return;
      
      // Check for duplicate booking name
      const { data: existingBookings } = await supabase
        .from('bookings')
        .select('id, event_name')
        .eq('vendor_id', user!.id)
        .ilike('event_name', formData.event_name.trim())
        .not('status', 'eq', 'cancelled');

      if (existingBookings && existingBookings.length > 0 && 
          (!editingBooking || !existingBookings.some(b => b.id === editingBooking.id))) {
        toast.error('A booking with this name already exists. Please use a unique name.');
        return;
      }
      
      setCreateConfirmOpen(true);
      return;
    }

    // Validate time range
    if (formData.from_time && formData.to_time) {
      const [startHours, startMinutes] = formData.from_time.split(':').map(Number);
      const [endHours, endMinutes] = formData.to_time.split(':').map(Number);
      
      // Create date objects for comparison (using the same date)
      const startDate = new Date();
      startDate.setHours(startHours, startMinutes, 0, 0);
      
      const endDate = new Date();
      endDate.setHours(endHours, endMinutes, 0, 0);
      
      if (startDate >= endDate) {
        toast.error("End time must be after start time");
        return;
      }
    }

    // Smart Conflict Detection
    const eventStartDateTime = new Date(`${formData.event_date}T${formData.from_time || '00:00'}`);
    const eventEndDateTime = new Date(`${formData.event_date}T${formData.to_time || '23:59'}`);

    // ensure payments map is up-to-date so we can derive effective status
    await fetchPaymentsByBooking();

    // build query conditionally to avoid passing empty string as UUID
    let query = supabase
      .from("bookings")
      .select("id, event_name, event_date, from_time, to_time, status, total_amount, location")
      .eq("vendor_id", user!.id)
      .neq("status", "cancelled"); // check all bookings except cancelled

    if (editingBooking?.id) {
      query = query.neq("id", editingBooking.id); // exclude current booking only when editing
    }

    const { data: conflictingBookings, error: conflictError } = await query;

    if (conflictError) {
      console.error("Conflict check error:", conflictError);
      toast.error("Error checking for conflicts: " + conflictError.message);
      // Don't return - allow booking creation to continue even if conflict check fails
    }

    // Only treat bookings as conflicting when their effective status is confirmed (not cancelled or completed).
    const conflicts = conflictingBookings?.filter(booking => {
      const effectiveStatus = getDerivedStatus(booking);
      if (effectiveStatus !== 'confirmed') return false;

      const bookingStartDateTime = new Date(`${booking.event_date}T${booking.from_time || '00:00'}`);
      const bookingEndDateTime = new Date(`${booking.event_date}T${booking.to_time || '23:59'}`);
      // Check for overlap: start1 < end2 and start2 < end1
      return eventStartDateTime < bookingEndDateTime && bookingStartDateTime < eventEndDateTime;
    });

    if (conflicts && conflicts.length > 0) {
      setConflictingBookings(conflicts);
      setConflictDialogOpen(true);
      return; // Stop here and let the dialog handle the choice
    }

    try {
      // Common payload mapping
      const payload = {
        event_name: formData.event_name,
        event_date: formData.event_date,
        from_time: formData.from_time || null,
        to_time: formData.to_time || null,
        location: formData.location || null,
        client_id: formData.client_id,
        package_id: formData.package_id || null,
        entity_id: formData.entity_id || null,
        total_amount: Number(formData.total_amount) || 0,
        updated_at: new Date().toISOString()
      };

      if (editingBooking) {
        const { error } = await supabase
          .from("bookings")
          .update(payload)
          .eq("id", editingBooking.id)
          .eq("vendor_id", user!.id);

        if (error) throw error;
        toast.success("Booking updated successfully");
      } else {
        const { data, error } = await supabase
          .from("bookings")
          .insert([{ ...payload, vendor_id: user!.id, created_at: new Date().toISOString() }])
          .select()
          .single();

        if (error) throw error;
        await recordInitialPayment(data.id);
        toast.success("Booking created successfully");
      }

      setIsOpen(false);
      setEditingBooking(null);
      await fetchBookings();
      setFormData({
        event_name: "",
        event_date: "",
        from_time: "",
        to_time: "",
        location: "",
        client_id: "",
        package_id: "",
        entity_id: "",
        total_amount: 0,
      });
    } catch (error) {
      console.error("Error saving booking:", error);
      toast.error(error instanceof Error ? error.message : "Failed to save booking");
    }
  };

  const handleSubmitAfterConflict = async () => {
    try {
      // Common payload mapping
      const payload = {
        event_name: formData.event_name,
        event_date: formData.event_date,
        from_time: formData.from_time || null,
        to_time: formData.to_time || null,
        location: formData.location || null,
        client_id: formData.client_id,
        package_id: formData.package_id || null,
        entity_id: formData.entity_id || null,
        total_amount: Number(formData.total_amount) || 0,
        updated_at: new Date().toISOString()
      };

      if (editingBooking) {
        const { error } = await supabase
          .from("bookings")
          .update(payload)
          .eq("id", editingBooking.id)
          .eq("vendor_id", user!.id);

        if (error) throw error;
        toast.success("Booking updated successfully");
      } else {
        const { data, error } = await supabase
          .from("bookings")
          .insert([{ ...payload, vendor_id: user!.id, created_at: new Date().toISOString() }])
          .select()
          .single();

        if (error) throw error;
        await recordInitialPayment(data.id);
        toast.success("Booking created successfully");
      }

      setIsOpen(false);
      setEditingBooking(null);
      setConflictDialogOpen(false);
      setConflictingBookings([]);
      await fetchBookings();
      setFormData({
        event_name: "",
        event_date: "",
        from_time: "",
        to_time: "",
        location: "",
        client_id: "",
        package_id: "",
        entity_id: "",
        total_amount: 0,
      });
     } catch (error) {
      console.error("Error saving booking:", error);
      toast.error(error instanceof Error ? error.message : "Failed to save booking");
    }
  } // <-- Add this closing brace here!

  const deleteBooking = (id: string) => {
    setBookingToDelete(id);
    setDeleteDialogOpen(true);
  };

  const confirmDeleteBooking = async () => {
    if (!bookingToDelete) return;

    const { error } = await supabase
      .from("bookings")
      .delete()
      .eq("id", bookingToDelete)
      .eq("vendor_id", user!.id);

    if (error) {
      console.error('Delete booking failed:', error.message || error);
      toast.error(`Failed to delete booking: ${error.message || 'Unknown error'}`);
    } else {
      toast.success("Booking deleted");
      fetchBookings();
    }

    setDeleteDialogOpen(false);
    setBookingToDelete(null);
  };

  const openDetailDialog = (booking: any) => {
    setSelectedBooking(booking);
    setDetailDialogOpen(true);
  };

  const openEditDialog = (booking: any) => {
    setEditingBooking(booking);
    setFormData({
      event_name: booking.event_name || "",
      event_date: booking.event_date ? new Date(booking.event_date).toISOString().split('T')[0] : "",
      from_time: booking.from_time || "",
      to_time: booking.to_time || "",
      location: booking.location || "",
      client_id: booking.client_id || "",
      package_id: booking.package_id || "",
      entity_id: booking.entity_id || "",
      total_amount: Number(booking.total_amount) || 0,
    });
    setIsOpen(true);
  };

  // Quick Actions
  const sendMessage = (booking: any) => {
    // Placeholder: Open WhatsApp or email composer
    const message = `Hi ${booking.clients?.name}, regarding your booking for ${booking.event_name} on ${new Date(booking.event_date).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}.`;
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, "_blank");
  };

  

  // CSV Export
  const exportToCSV = () => {
    const csvData = bookings.map(b => ({
      "Event Name": b.event_name,
      "Event Date": b.event_date,
      "From Time": b.from_time,
      "To Time": b.to_time,
      "Location": b.location,
      "Client": b.clients?.name,
      "Package": b.packages?.name,
      "Venue": b.entities?.name,
      "Status": b.status,
      "Total Amount": b.total_amount,
      "Created At": b.created_at,
    }));
    const csv = Papa.unparse(csvData);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "bookings.csv";
    a.click();
  };

  // CSV Import (basic implementation)
  const importFromCSV = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    Papa.parse(file, {
      header: true,
      complete: async (results) => {
        for (const row of results.data as any[]) {
          await supabase.from("bookings").insert({
            event_name: row["Event Name"],
            event_date: row["Event Date"],
            from_time: row["From Time"],
            to_time: row["To Time"],
            location: row["Location"],
            client_id: clients.find(c => c.name === row["Client"])?.id,
            package_id: packages.find(p => p.name === row["Package"])?.id,
            entity_id: entities.find(e => e.name === row["Venue"])?.id,
            status: row["Status"],
            total_amount: parseFloat(row["Total Amount"]),
            vendor_id: user!.id,
          });
        }
        toast.success("Bookings imported successfully");
        fetchBookings();
      },
      error: (error) => toast.error("Failed to import CSV: " + error.message),
    });
  };

  const confirmBooking = async (id: string) => {
    try {
      const { error } = await supabase
        .from("bookings")
        .update({ status: "confirmed" })
        .eq("id", id)
        .eq("vendor_id", user!.id);
      if (error) {
        console.error("Confirm booking failed:", error);
        toast.error("Failed to confirm booking: " + (error.message || "Unknown error"));
        return;
      }
      toast.success("Booking marked confirmed (test)");
      await fetchBookings();
    } catch (err) {
      console.error(err);
      toast.error("Failed to confirm booking");
    }
  };


  return (
    <div className="space-y-4 md:space-y-8 animate-fade-in">
      <div className="text-center space-y-1 md:space-y-2">
        <h1 className="text-2xl md:text-4xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
          Bookings
        </h1>
        <p className="text-muted-foreground text-sm md:text-lg">Manage your event bookings</p>
      </div>

      <div className="flex flex-col gap-4 mb-6">
        
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 md:gap-4">
            <div className="relative w-full sm:max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search bookings..."
                className="pl-9 h-9 md:h-10 rounded-lg w-full"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 text-muted-foreground hover:bg-transparent"
                  onClick={() => setSearchQuery("")}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>

            <Button
              onClick={() => {
                setEditingBooking(null);
                setFormData({
                  event_name: "",
                  event_date: "",
                  from_time: "",
                  to_time: "",
                  location: "",
                  client_id: "",
                  package_id: "",
                  entity_id: "",
                  total_amount: 0,
                });
                setIsOpen(true);
              }}
              className="btn-primary touch-feedback w-full sm:w-auto h-9 md:h-10 text-xs md:text-sm px-3 md:px-4"
            >
              <Plus className="mr-1 md:mr-2 h-3.5 w-3.5 md:h-4 md:w-4" /> New Booking
            </Button>
          </div>
          
          <div className="flex flex-col w-full gap-3">
            {/* Status filter buttons - aligned to left */}
            <div className="flex flex-wrap gap-2">
              <Button variant={statusFilter === 'all' ? 'default' : 'outline'} size="sm"
                className={`text-xs ${statusFilter === 'all' ? 'bg-primary' : 'bg-white'}`} 
                onClick={() => setStatusFilter('all')}>
                All
              </Button>
              <Button variant={statusFilter === 'confirmed' ? 'default' : 'outline'} size="sm"
                className={`text-xs ${statusFilter === 'confirmed' ? 'bg-green-100 text-green-800 hover:bg-green-100 hover:text-green-800' : 'bg-white'}`} 
                onClick={() => setStatusFilter('confirmed')}>
                Confirmed
              </Button>
              <Button variant={statusFilter === 'completed' ? 'default' : 'outline'} size="sm"
                className={`text-xs ${statusFilter === 'completed' ? 'bg-blue-100 text-blue-800 hover:bg-blue-100 hover:text-blue-800' : 'bg-white'}`} 
                onClick={() => setStatusFilter('completed')}>
                Completed
              </Button>
              <Button variant={statusFilter === 'cancelled' ? 'default' : 'outline'} size="sm"
                className={`text-xs ${statusFilter === 'cancelled' ? 'bg-gray-100 text-gray-800 hover:bg-gray-100 hover:text-gray-800' : 'bg-white'}`} 
                onClick={() => setStatusFilter('cancelled')}>
                Cancelled
              </Button>
            </div>

            {/* CSV buttons - aligned to right */}
            <div className="flex justify-end gap-2">
              <Button 
                variant="outline" 
                onClick={exportToCSV} 
                className="touch-feedback text-xs md:text-sm h-8 md:h-9 px-3 md:px-4"
              >
                <Download className="mr-1 h-3.5 w-3.5" />
                <span>Export CSV</span>
              </Button>
              <label htmlFor="csv-import-inline" className="cursor-pointer">
                <Button 
                  variant="outline" 
                  asChild 
                  className="touch-feedback text-xs md:text-sm h-8 md:h-9 px-3 md:px-4"
                >
                  <span className="inline-flex items-center">
                    <Upload className="mr-1 h-3.5 w-3.5" />
                    <span>Import CSV</span>
                  </span>
                </Button>
              </label>
              <input id="csv-import-inline" type="file" accept=".csv" onChange={importFromCSV} className="hidden" />
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 md:gap-4">
        <div className="flex items-center gap-1 md:gap-4">
          <Dialog
            open={isOpen}
            onOpenChange={(open) => {
              setIsOpen(open);
              if (!open) {
                setEditingBooking(null);
                setFormData({
                  event_name: "",
                  event_date: "",
                  from_time: "",
                  to_time: "",
                  location: "",
                  client_id: "",
                  package_id: "",
                  entity_id: "",
                  total_amount: 0,
                });
              }
            }}
          >
            <DialogContent className="max-w-6xl w-full rounded-t-2xl md:rounded-xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-lg md:text-xl font-semibold">{editingBooking ? 'Edit Booking' : 'Create New Booking'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4 md:space-y-6">
                <div className="space-y-6">
                  {/* First Row - Event Name */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 md:gap-6">
                    {/* 1. Event Name - Full Width */}
                    <div className="lg:col-span-3 space-y-2">
                      <div className="flex items-center">
                        <Label htmlFor="event_name" className="font-medium text-gray-700">Event Name</Label>
                        <span className="text-red-500 ml-1">*</span>
                      </div>
                      <Input
                        id="event_name"
                        value={formData.event_name}
                        onChange={(e) => {
                          setFormData({ ...formData, event_name: e.target.value });
                          if (formErrors.event_name) {
                            setFormErrors(prev => ({ ...prev, event_name: '' }));
                          }
                        }}
                        className={cn(
                          "w-full h-10 rounded-md border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500",
                          formErrors.event_name ? 'border-red-500 focus:ring-red-200' : 'border-gray-300'
                        )}
                        placeholder="Enter event name"
                      />
                      {formErrors.event_name && (
                        <p className="text-red-500 text-xs mt-1 flex items-center">
                          <AlertCircle className="h-3.5 w-3.5 mr-1" />
                          {formErrors.event_name}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Second Row - Time and Location */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 md:gap-6">
                    {/* 2. From Time */}
                    <div className="space-y-2">
                      <div className="flex items-center">
                        <Label htmlFor="from_time" className="font-medium text-gray-700">From Time</Label>
                        <span className="text-red-500 ml-1">*</span>
                      </div>
                      <div className="relative">
                        <Input
                          id="from_time"
                          type="time"
                          value={formData.from_time}
                          onChange={(e) => {
                            setFormData({ ...formData, from_time: e.target.value });
                            if (formErrors.time) {
                              setFormErrors(prev => ({ ...prev, time: '' }));
                            }
                          }}
                          className={cn(
                            "w-full pl-10 h-10 rounded-md border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500",
                            formErrors.time ? 'border-red-500 focus:ring-red-200' : 'border-gray-300'
                          )}
                        />
                        <Clock4 className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      </div>
                      {formErrors.time && (
                        <p className="text-red-500 text-xs mt-1 flex items-center">
                          <AlertCircle className="h-3.5 w-3.5 mr-1" />
                          {formErrors.time}
                        </p>
                      )}
                    </div>

                    {/* 3. To Time */}
                    <div className="space-y-2">
                      <div className="flex items-center">
                        <Label htmlFor="to_time" className="font-medium text-gray-700">To Time</Label>
                        <span className="text-red-500 ml-1">*</span>
                      </div>
                      <div className="relative">
                        <Input
                          id="to_time"
                          type="time"
                          value={formData.to_time}
                          onChange={(e) => {
                            setFormData({ ...formData, to_time: e.target.value });
                            if (formErrors.time) {
                              setFormErrors(prev => ({ ...prev, time: '' }));
                            }
                          }}
                          className={cn(
                            "w-full pl-10 h-10 rounded-md border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500",
                            formErrors.time ? 'border-red-500 focus:ring-red-200' : 'border-gray-300'
                          )}
                        />
                        <Clock4 className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      </div>
                      {formErrors.time && (
                        <p className="text-red-500 text-xs mt-1 flex items-center">
                          <AlertCircle className="h-3.5 w-3.5 mr-1" />
                          {formErrors.time}
                        </p>
                      )}
                    </div>

                    {/* 4. Location */}
                    <div className="space-y-2">
                      <div className="flex items-center">
                        <Label htmlFor="location" className="font-medium text-gray-700">Location</Label>
                        <span className="text-red-500 ml-1">*</span>
                      </div>
                      <div className="relative">
                        <Input
                          id="location"
                          value={formData.location}
                          onChange={(e) => {
                            setFormData({ ...formData, location: e.target.value });
                            if (formErrors.location) {
                              setFormErrors(prev => ({ ...prev, location: '' }));
                            }
                          }}
                          placeholder="Enter event location"
                          className={cn(
                            "w-full pl-10 h-10 rounded-md border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500",
                            formErrors.location ? 'border-red-500 focus:ring-red-200' : 'border-gray-300'
                          )}
                        />
                        <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      </div>
                      {formErrors.location && (
                        <p className="text-red-500 text-xs mt-1 flex items-center">
                          <AlertCircle className="h-3.5 w-3.5 mr-1" />
                          {formErrors.location}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Third Row - Venue/Branch and Event Date */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 md:gap-6">
                    {/* 5. Venue/Branch */}
                    <div className="space-y-2">
                      <div className="flex items-center">
                        <Label htmlFor="entity_id" className="font-medium text-gray-700">Venue/Branch</Label>
                        <span className="text-red-500 ml-1">*</span>
                      </div>
                      <Select
                        value={formData.entity_id}
                        onValueChange={(value) => setFormData({ ...formData, entity_id: value })}
                      >
                        <SelectTrigger 
                          className={cn(
                            "w-full h-10 rounded-md border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500",
                            formErrors.entity_id ? 'border-red-500 focus:ring-red-200' : 'border-gray-300'
                          )}
                        >
                          <SelectValue placeholder="Select venue/branch" />
                        </SelectTrigger>
                        <SelectContent className="bg-white border border-gray-200 rounded-md shadow-lg">
                          {entities.map((entity) => (
                            <SelectItem 
                              key={entity.id} 
                              value={entity.id}
                              className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
                            >
                              <div className="flex items-center">
                                <Building2 className="h-4 w-4 mr-2 text-gray-500" />
                                {entity.name}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {formErrors.entity_id && (
                        <p className="text-red-500 text-xs mt-1 flex items-center">
                          <AlertCircle className="h-3.5 w-3.5 mr-1" />
                          {formErrors.entity_id}
                        </p>
                      )}
                    </div>

                    {/* 6. Event Date */}
                    <div className="space-y-2">
                      <div className="flex items-center">
                        <Label htmlFor="event_date" className="font-medium text-gray-700">Event Date</Label>
                        <span className="text-red-500 ml-1">*</span>
                      </div>
                      <div className="relative">
                        <Input
                          id="event_date"
                          type="date"
                          value={formData.event_date}
                          onChange={(e) => {
                            setFormData({ ...formData, event_date: e.target.value });
                            if (formErrors.event_date) {
                              setFormErrors(prev => ({ ...prev, event_date: '' }));
                            }
                          }}
                          className={cn(
                            "w-full pl-10 h-10 rounded-md border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500",
                            formErrors.event_date ? 'border-red-500 focus:ring-red-200' : 'border-gray-300'
                          )}
                        />
                        <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      </div>
                      {formErrors.event_date && (
                        <p className="text-red-500 text-xs mt-1 flex items-center">
                          <AlertCircle className="h-3.5 w-3.5 mr-1" />
                          {formErrors.event_date}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <Label htmlFor="client_id" className="font-medium text-gray-700">Client</Label>
                        <span className="text-red-500 ml-1">*</span>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="text-xs h-8 px-3 border-dashed border-gray-300 hover:bg-gray-50"
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsClientDialogOpen(true);
                        }}
                      >
                        <UserPlus className="h-3.5 w-3.5 mr-1.5 text-blue-600" />
                        <span className="text-blue-600 font-medium">Add New Client</span>
                      </Button>
                    </div>
                    <Popover open={isClientPopoverOpen} onOpenChange={setIsClientPopoverOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          className={cn(
                            "w-full h-10 justify-between items-center px-3 py-2 rounded-md border border-gray-300 bg-white text-left shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500",
                            !formData.client_id ? "text-gray-400" : "text-gray-900",
                            formErrors.client_id ? 'border-red-500 focus:ring-red-200' : 'border-gray-300'
                          )}
                        >
                          <span className="truncate">
                            {formData.client_id
                              ? clients.find((client) => client.id === formData.client_id)?.name || "Select a client"
                              : "Select a client"}
                          </span>
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 text-gray-400" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[320px] p-0 border border-gray-200 shadow-lg rounded-lg overflow-hidden">
                        <Command className="bg-white">
                          <div className="px-3 pt-2">
                            <CommandInput 
                              placeholder="Search clients..." 
                              className="h-9 text-sm"
                            />
                          </div>
                          <CommandList className="max-h-[280px] overflow-y-auto">
                            <CommandEmpty className="py-3 px-4 text-sm text-gray-500">
                              No clients found. Try a different search or add a new client.
                            </CommandEmpty>
                            <CommandGroup>
                              {clients.map((client) => (
                                <CommandItem
                                  value={client.name}
                                  key={client.id}
                                  onSelect={() => {
                                    setFormData({ ...formData, client_id: client.id });
                                    if (formErrors.client_id) {
                                      setFormErrors(prev => ({ ...prev, client_id: '' }));
                                    }
                                    // Close the popover after selection
                                    setIsClientPopoverOpen(false);
                                  }}
                                  className="px-3 py-2 text-sm cursor-pointer hover:bg-gray-50"
                                >
                                  <div className={cn(
                                    "flex items-center justify-center h-4 w-4 rounded-full border mr-3 flex-shrink-0",
                                    formData.client_id === client.id 
                                      ? "bg-blue-100 border-blue-500 text-blue-700" 
                                      : "border-gray-300"
                                  )}>
                                    {formData.client_id === client.id && (
                                      <Check className="h-3 w-3" />
                                    )}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="font-medium text-gray-900 truncate">
                                      {client.name || 'Unnamed Client'}
                                    </div>
                                    {client.phone && (
                                      <div className="text-xs text-gray-500 truncate">
                                        {client.phone}
                                      </div>
                                    )}
                                  </div>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="package_id">Package (Optional)</Label>
                    <Select
                      value={formData.package_id || ''}
                      onValueChange={handlePackageSelect}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select package (optional)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">
                          None
                        </SelectItem>
                        {packages.map((pkg) => (
                          <SelectItem key={pkg.id} value={pkg.id}>
                            {pkg.name} {pkg.entities?.name && `(${pkg.entities.name})`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="total_amount">Total Amount (₹)</Label>
                    <Input
                      id="total_amount"
                      type="number"
                      value={formData.total_amount || ''}
                      onChange={handleAmountChange}
                      readOnly={!!formData.package_id}
                      className={formData.package_id ? 'bg-gray-100' : ''}
                      required
                    />
                    {formData.package_id && (
                      <p className="text-xs text-muted-foreground">
                        Amount is set by selected package. Change package to edit amount.
                      </p>
                    )}
                  </div>

                  {/* --- Initial Payment Section --- */}
                  <Separator className="md:col-span-2" />

                  <div className="space-y-2">
                    <Label htmlFor="payment_amount">Initial Payment (₹)</Label>
                    <Input
                      id="payment_amount"
                      type="number"
                      step="0.01"
                      value={paymentData.amount || ''}
                      onChange={(e) => setPaymentData({ ...paymentData, amount: parseFloat(e.target.value) || 0 })}
                      placeholder="0.00"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="payment_date">Payment Date</Label>
                    <Input
                      id="payment_date"
                      type="date"
                      value={paymentData.payment_date}
                      onChange={(e) => setPaymentData({ ...paymentData, payment_date: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="payment_method">Payment Method</Label>
                    <Select
                      value={paymentData.payment_method}
                      onValueChange={(value) => setPaymentData({ ...paymentData, payment_method: value })}
                    >
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
                    <Label htmlFor="payment_type">Payment Type</Label>
                    <Input
                      id="payment_type"
                      value={paymentData.payment_type}
                      readOnly
                      className="bg-muted"
                    />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="advance_payment"
                        checked={isAdvancePayment}
                        onCheckedChange={(checked) => setIsAdvancePayment(checked as boolean)}
                      />
                      <Label htmlFor="advance_payment">This is an advance payment</Label>
                    </div>
                  </div>

                </div>
                <div className="flex justify-end gap-2 md:gap-3 pt-3 md:pt-4 col-span-1 md:col-span-2">
                  <Button type="button" variant="outline" onClick={() => setIsOpen(false)} className="px-4 md:px-6 touch-feedback">
                    Cancel
                  </Button>
                  <Button type="submit" className="px-4 md:px-6 touch-feedback">{editingBooking ? 'Update' : 'Create'}</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>

          <BookingDetailDialog
            booking={selectedBooking}
            open={detailDialogOpen}
            onOpenChange={setDetailDialogOpen}
            onUpdate={fetchBookings}
          />
        </div>

      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4 lg:gap-6">
        {filteredBookings.length === 0 ? (
          <Card className="col-span-full glass card-hover rounded-xl md:rounded-2xl border-0 shadow-card">
            <CardContent className="flex flex-col items-center justify-center py-8 md:py-12">
              <Calendar className="h-10 w-10 md:h-12 md:w-12 text-muted-foreground/50 mb-3 md:mb-4" />
              <p className="text-muted-foreground text-base md:text-lg mb-2">No bookings yet</p>
              <p className="text-xs md:text-sm text-muted-foreground/70">Create your first booking to get started</p>
            </CardContent>
          </Card>
        ) : (
          <>
            {paginatedBookings.map((booking) => (
            <Card
              key={booking.id}
              className="group glass card-hover rounded-xl md:rounded-2xl border-0 shadow-card hover:shadow-card-hover cursor-pointer w-full min-w-0 flex flex-col touch-feedback active:scale-[0.98] transition-all duration-300 overflow-hidden"
              onClick={() => openDetailDialog(booking)}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
              <CardHeader className="pb-2 md:pb-3 pt-4 md:pt-6 px-4 md:px-6 relative">
                <CardTitle className="flex items-center justify-between gap-2">
                  <span className="text-base md:text-lg font-bold text-foreground truncate group-hover:text-primary transition-colors duration-200">
                    {booking.event_name}
                  </span>
                  <span
                    className={`px-2.5 md:px-3 py-1 md:py-1.5 rounded-full text-[10px] md:text-xs font-semibold transition-all duration-200 whitespace-nowrap shadow-sm ${
                      getDerivedStatus(booking) === "confirmed"
                        ? "bg-gradient-to-r from-green-100 to-green-50 text-green-700 group-hover:from-green-200 group-hover:to-green-100"
                        : getDerivedStatus(booking) === "completed"
                        ? "bg-gradient-to-r from-blue-100 to-blue-50 text-blue-700 group-hover:from-blue-200 group-hover:to-blue-100"
                        : "bg-gradient-to-r from-gray-100 to-gray-50 text-gray-700 group-hover:from-gray-200 group-hover:to-gray-100"
                    }`}
                  >
                    {getDerivedStatus(booking)}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 md:px-6 pb-3 md:pb-4 flex flex-col flex-1 relative">
                <div className="space-y-1.5 md:space-y-2 flex-1">
                  <div className="space-y-1">
                    <div className="flex items-center text-xs text-muted-foreground">
                      <Calendar className="mr-1.5 h-3 w-3" />
                      <span className="text-xs font-medium">Booked on: </span>
                      <span className="ml-1">
                        {new Date(booking.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </span>
                    </div>
                    <div className="flex items-center text-xs md:text-sm text-muted-foreground">
                      <Calendar className="mr-1.5 md:mr-2 h-3.5 w-3.5 md:h-4 md:w-4" />
                      {new Date(booking.event_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                      {booking.from_time && booking.to_time && ` • ${formatTime12Hour(booking.from_time)} - ${formatTime12Hour(booking.to_time)}`}
                    </div>
                  </div>

                  {/* Location */}
                  {booking.location && (
                    <div className="flex items-center text-xs md:text-sm text-muted-foreground">
                      <MapPin className="mr-1 md:mr-1.5 h-3 w-3 md:h-3.5 md:w-3.5 flex-shrink-0" />
                      <span className="truncate">{booking.location}</span>
                    </div>
                  )}

                  {/* Entity */}
                  {booking.entities?.name && (
                    <div className="flex items-center text-xs md:text-sm text-primary font-medium truncate">
                      <Building2 className="mr-1 md:mr-1.5 h-3 w-3 md:h-3.5 md:w-3.5 flex-shrink-0" />
                      <span className="truncate">{booking.entities.name}</span>
                    </div>
                  )}

                  {/* Client */}
                  <div className="text-xs md:text-sm truncate">
                    <span className="font-medium">Client:</span> {booking.clients?.name || "N/A"}
                  </div>

                  {/* Package */}
                  {booking.packages?.name && (
                    <div className="text-xs md:text-sm truncate">
                      <span className="font-medium">Package:</span> {booking.packages.name}
                    </div>
                  )}

                  {/* Portfolio Item */}
                  {booking.portfolio_items?.title && (
                    <div className="text-xs md:text-sm truncate">
                      <span className="font-medium">Item:</span> {booking.portfolio_items.title}
                      {booking.portfolio_items.price > 0 && ` (₹${booking.portfolio_items.price})`}
                    </div>
                  )}

                  {/* Amount and Payment Status */}
                  {booking.total_amount > 0 && (
                    <div className="pt-1 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-muted-foreground">Total Amount</span>
                        <span className="text-sm md:text-base font-bold text-primary">₹{getPaymentInfo(booking).totalAmount.toLocaleString()}</span>
                      </div>
                      
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Paid</span>
                        <div className="flex items-center gap-1">
                          <span className="font-medium text-green-600">₹{getPaymentInfo(booking).totalPaid.toLocaleString()}</span>
                          <span className="text-muted-foreground">/</span>
                          <span className="font-medium">₹{getPaymentInfo(booking).totalAmount.toLocaleString()}</span>
                        </div>
                      </div>
                      
                      {/* Payment Progress Bar */}
                      {getPaymentInfo(booking).totalAmount > 0 && (
                        <div className="w-full bg-gray-200 rounded-full h-1.5">
                          <div 
                            className="bg-green-500 h-1.5 rounded-full transition-all duration-300"
                            style={{ width: `${getPaymentInfo(booking).paymentProgress}%` }}
                          />
                        </div>
                      )}
                      
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Status</span>
                        <span className={`font-medium ${getPaymentInfo(booking).pending > 0 ? 'text-amber-600' : 'text-green-600'}`}>
                          {getPaymentInfo(booking).pending > 0 ? 
                            `Pending: ₹${getPaymentInfo(booking).pending.toLocaleString()}` : 
                            'Fully Paid'}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Buttons always at bottom */}
                <div className="flex gap-1 md:gap-1.5 pt-2 flex-wrap mt-auto">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation();
                      sendMessage(booking);
                    }}
                    className="flex-1 min-w-0 h-8 md:h-9 touch-feedback"
                    title="Send Message"
                  >
                    <MessageSquare className="h-3.5 w-3.5 md:h-4 md:w-4 text-green-600" />
                  </Button>
                  
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation();
                      openDetailDialog(booking);
                    }}
                    className="flex-1 min-w-0 h-8 md:h-9 touch-feedback"
                    title="View Details"
                  >
                    <Eye className="h-3.5 w-3.5 md:h-4 md:w-4" />
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation();
                      openEditDialog(booking);
                    }}
                    className="flex-1 min-w-0 h-8 md:h-9 touch-feedback"
                    title="Edit Booking"
                  >
                    <Pencil className="h-3.5 w-3.5 md:h-4 md:w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteBooking(booking.id);
                    }}
                    className="flex-1 min-w-0 h-8 md:h-9 touch-feedback text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200 hover:border-red-300"
                    title="Delete Booking"
                  >
                    <Trash2 className="h-3.5 w-3.5 md:h-4 md:w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
            ))}
          </>
        )}
      </div>

      {/* Bottom Pagination - Responsive */}
      <div className="w-full mt-8 mb-4 px-2 sm:px-4">
        {filteredBookings.length > 0 && totalPages > 0 && (
          <div className="flex flex-col sm:flex-row justify-between items-center gap-3 sm:gap-4 pt-4 sm:pt-6 border-t">
            <div className="text-xs sm:text-sm text-muted-foreground whitespace-nowrap">
              <span className="hidden sm:inline">Showing </span>
              <span className="font-medium">{(currentPage - 1) * itemsPerPage + 1}-{
                Math.min(currentPage * itemsPerPage, filteredBookings.length)
              }</span>
              <span className="hidden sm:inline"> of <span className="font-medium">{filteredBookings.length}</span> bookings</span>
            </div>
            
            <div className="flex items-center gap-1 sm:gap-2 w-full sm:w-auto justify-between sm:justify-normal">
              <div className="flex items-center gap-1 sm:gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 w-8 sm:h-9 sm:w-auto sm:px-3"
                  onClick={() => handlePageChange(1)}
                  disabled={currentPage === 1}
                  title="First page"
                >
                  <ChevronsUpDown className="h-4 w-4 -rotate-90" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 w-8 sm:h-9 sm:w-auto sm:px-3"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
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
                  className="h-8 w-8 sm:h-9 sm:w-auto sm:px-3"
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  title="Next page"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 w-8 sm:h-9 sm:w-auto sm:px-3"
                  onClick={() => handlePageChange(totalPages)}
                  disabled={currentPage === totalPages}
                  title="Last page"
                >
                  <ChevronsUpDown className="h-4 w-4 rotate-90" />
                </Button>
              </div>
            </div>
            
            {/* Mobile page info */}
            <div className="text-xs text-muted-foreground sm:hidden w-full text-center mt-2">
              Page {currentPage} of {totalPages}
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="rounded-t-2xl md:rounded-xl">
          <DialogHeader>
            <DialogTitle>Confirm Deletion</DialogTitle>
          </DialogHeader>
          <p>Are you sure you want to delete this booking? This action cannot be undone.</p>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDeleteBooking}>
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Conflict Confirmation Dialog */}
      <Dialog open={conflictDialogOpen} onOpenChange={setConflictDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Booking Conflict Detected</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p>The following bookings conflict with your selected time slot:</p>
            <div className="border rounded-md divide-y">
              {conflictingBookings.map((conflict) => (
                <div key={conflict.id} className="p-3">
                  <div className="font-medium">{conflict.event_name}</div>
                  <div className="text-sm text-muted-foreground">
                    {new Date(conflict.event_date).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })} • {conflict.from_time} - {conflict.to_time}
                  </div>
                  <div className="text-sm">{conflict.location}</div>
                </div>
              ))}
            </div>
            <p className="text-sm text-muted-foreground">
              Do you want to proceed with the booking anyway?
            </p>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={() => setConflictDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmitAfterConflict}>
              Continue with Booking
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create/Update Confirmation Dialog */}
      <Dialog open={createConfirmOpen} onOpenChange={setCreateConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Booking</DialogTitle>
          </DialogHeader>
          <p>Are you sure you want to {editingBooking ? "update" : "create"} this booking?</p>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={() => setCreateConfirmOpen(false)}>Cancel</Button>
            <Button onClick={async () => {
              setCreateConfirmOpen(false);
              // call handleSubmit without an event, and mark confirmed=true
              await handleSubmit(null, true);
            }}>
              Confirm
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Client Dialog */}
      <Dialog open={isClientDialogOpen} onOpenChange={setIsClientDialogOpen}>
        <DialogContent className="max-w-4xl w-[95vw] rounded-t-2xl md:rounded-xl h-[90vh] max-h-[800px] overflow-y-auto">
          <DialogHeader className="px-1">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-xl md:text-2xl">Add New Client</DialogTitle>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsClientDialogOpen(false)}
                className="h-8 w-8 rounded-full -mr-2"
              >
                <X className="h-5 w-5" />
                <span className="sr-only">Close</span>
              </Button>
            </div>
            <DialogDescription className="text-sm md:text-base">
              Add a new client to your database. All fields marked with * are required.
            </DialogDescription>
          </DialogHeader>
          <div className="px-1 py-2">
            <ClientForm 
              onSuccess={handleClientAdded}
              onCancel={() => setIsClientDialogOpen(false)}
            />
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

export default Bookings;
