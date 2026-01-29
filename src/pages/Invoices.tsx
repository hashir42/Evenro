import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { FileText, Download, QrCode, Share2, CheckCircle, AlertCircle, Upload, ChevronsUpDown, Check } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const Invoices = () => {
  const { user } = useAuth();
  const [bookings, setBookings] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [selectedBooking, setSelectedBooking] = useState("");
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [gstRate, setGstRate] = useState(18);
  const [showGst, setShowGst] = useState(false);
  const [companyLogo, setCompanyLogo] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (user) {
      fetchBookings();
      fetchInvoices();
      fetchProfile();
      loadGstRate();
      loadCompanyLogo();
    }
  }, [user]);

  const [isEditingGst, setIsEditingGst] = useState(false);
  const [newGstRate, setNewGstRate] = useState('');

  const loadGstRate = () => {
    const saved = localStorage.getItem('global_gst_rate') || '18';
    setGstRate(parseFloat(saved));
    setNewGstRate(saved);
  };

  const handleGstRateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Allow only numbers and decimal point
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setNewGstRate(value);
    }
  };

  const saveGstRate = () => {
    if (newGstRate === '') {
      toast.error('Please enter a GST rate');
      return;
    }
    const rate = parseFloat(newGstRate);
    if (isNaN(rate) || rate < 0 || rate > 100) {
      toast.error('Please enter a valid GST rate between 0 and 100');
      return;
    }
    setGstRate(rate);
    localStorage.setItem('global_gst_rate', rate.toString());
    setIsEditingGst(false);
    toast.success(`GST rate updated to ${rate}%`);
  };

  const loadCompanyLogo = () => {
    const saved = localStorage.getItem(`company_logo_${user?.id}`);
    if (saved) {
      setCompanyLogo(saved);
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        toast.error("Logo size should be less than 2MB");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        setCompanyLogo(base64String);
        localStorage.setItem(`company_logo_${user?.id}`, base64String);
        toast.success("Logo uploaded successfully!");
      };
      reader.readAsDataURL(file);
    }
  };

  const removeCompanyLogo = () => {
    setCompanyLogo("");
    localStorage.removeItem(`company_logo_${user?.id}`);
    toast.success("Logo removed");
  };

  const fetchInvoices = async () => {
    const { data } = await supabase
      .from("invoices")
      .select("*, bookings(event_name, clients(name))")
      .eq("user_id", user!.id)
      .order("created_at", { ascending: false });
    setInvoices(data || []);
  };

  const fetchBookings = async () => {
    const { data } = await supabase
      .from("bookings")
      .select("*, clients(name, email, phone), packages(name, price), payments(amount)")
      .eq("vendor_id", user!.id)
      .order("event_date", { ascending: false });
    setBookings(data || []);
  };

  const fetchProfile = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user!.id)
      .single();
    setProfile(data);
  };

  const createInvoicePdf = async (booking: any) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    doc.setFontSize(24);
    // Add company logo if available with proper aspect ratio
    if (companyLogo) {
      try {
        const maxSize = 35;
        doc.addImage(companyLogo, 'JPEG', 14, 10, maxSize, maxSize, undefined, 'FAST');
      } catch (error) {
        console.error("Error adding logo:", error);
      }
    }

    doc.setTextColor(0, 0, 0);
    doc.text("INVOICE", pageWidth / 2, 20, { align: "center" });

    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    
    const businessStartY = companyLogo ? 50 : 35;
    doc.text(profile?.business_name || "Your Business", 14, businessStartY);
    if (profile?.email) doc.text(profile.email, 14, businessStartY + 7);
    if (profile?.phone) doc.text(profile.phone, 14, businessStartY + 14);

    const billToY = companyLogo ? 75 : 65;
    doc.text("Bill To:", 14, billToY);
    doc.text(booking.clients?.name || "N/A", 14, billToY + 7);
    if (booking.clients?.email) doc.text(booking.clients.email, 14, billToY + 14);
    if (booking.clients?.phone) doc.text(booking.clients.phone, 14, billToY + 21);

    doc.text(`Invoice #: INV-${booking.id.substring(0, 8).toUpperCase()}`, pageWidth - 14, 35, { align: "right" });
    doc.text(`Date: ${new Date().toLocaleDateString()}`, pageWidth - 14, 42, { align: "right" });
    doc.text(`Event Date: ${new Date(booking.event_date).toLocaleDateString()}`, pageWidth - 14, 49, { align: "right" });

    const totalPaid = booking.payments?.reduce((sum: number, p: any) => sum + Number(p.amount), 0) || 0;
    const subtotal = Number(booking.total_amount || 0);
    const taxAmount = showGst ? (subtotal * gstRate) / 100 : 0;
    const totalWithTax = subtotal + taxAmount;
    const balance = totalWithTax - totalPaid;

    // Helper function to format numbers properly for PDF
    const formatCurrency = (amount: number) => {
      const value = Number(amount || 0);
      // Use INR with space for better PDF rendering
      return `INR ${value.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
    };

    const invoiceBody = [
      ["Event: " + booking.event_name, ""],
      ["Package: " + (booking.packages?.name || "N/A"), formatCurrency(Number(booking.packages?.price || 0))],
      ["", ""],
      ["Subtotal", formatCurrency(subtotal)],
    ];
    
    if (showGst) {
      invoiceBody.push([`GST (${gstRate}%)`, formatCurrency(taxAmount)]);
      invoiceBody.push(["Total with Tax", formatCurrency(totalWithTax)]);
    } else {
      invoiceBody.push(["Total Amount", formatCurrency(subtotal)]);
    }
    
    if (profile?.business_gst && showGst) {
      invoiceBody.push(["GSTIN: " + profile.business_gst, ""]);
    }
    
    invoiceBody.push(["Amount Paid", formatCurrency(totalPaid)]);
    invoiceBody.push(["Balance Due", formatCurrency(balance)]);

    const tableStartY = companyLogo ? 105 : 95;
    autoTable(doc, {
      startY: tableStartY,
      head: [["Description", "Amount"]],
      body: invoiceBody,
      theme: "striped",
      headStyles: { 
        fillColor: [0, 0, 0],
        fontSize: 12,
        fontStyle: 'bold'
      },
      bodyStyles: {
        fontSize: 10,
        textColor: [0, 0, 0]
      },
      columnStyles: { 
        0: { cellWidth: 130, fontStyle: 'normal' }, 
        1: { cellWidth: 50, halign: "right", fontStyle: 'bold', fontSize: 11 } 
      },
    });

    const finalY = (doc as any).lastAutoTable.finalY || 150;
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text("Thank you for your business!", pageWidth / 2, finalY + 20, { align: "center" });

    return doc;
  };

  const generateInvoice = async () => {
    const booking = bookings.find((b) => b.id === selectedBooking);
    if (!booking) {
      toast.error("Please select a booking");
      return;
    }
    const doc = await createInvoicePdf(booking);
    doc.save(`invoice-${booking.event_name.replace(/\s+/g, "-").toLowerCase()}.pdf`);
    toast.success("Invoice downloaded successfully");
  };

  const shareInvoice = async () => {
    const booking = bookings.find((b) => b.id === selectedBooking);
    if (!booking) {
      toast.error("Please select a booking");
      return;
    }

    try {
      const doc = await createInvoicePdf(booking);
      const blob = doc.output("blob");

      // Try Web Share with file (best on mobile)
      if (navigator.share && (navigator as any).canShare?.({ files: [new File([blob], "invoice.pdf", { type: "application/pdf" })] })) {
        const file = new File([blob], `invoice-${booking.id}.pdf`, { type: "application/pdf" });
        await (navigator as any).share({
          title: `Invoice - ${booking.event_name}`,
          text: `Please find your invoice for ${booking.event_name}.`,
          files: [file],
        });
        toast.success("Share sheet opened");
        return;
      }

      // Upload to Supabase Storage to get a shareable link
      const fileName = `invoice-${booking.id}.pdf`;
      const path = `${user!.id}/${fileName}`;
      const { error: uploadError } = await supabase.storage
        .from("invoices")
        .upload(path, blob, { contentType: "application/pdf", upsert: true });

      if (uploadError) {
        console.error("Upload failed", uploadError);
        toast.error("Failed to upload invoice for sharing");
        return;
      }

      // Prefer public URL if bucket is public; otherwise create signed URL
      let publicUrl = supabase.storage.from("invoices").getPublicUrl(path).data.publicUrl;
      if (!publicUrl) {
        const { data: signed, error: signErr } = await supabase.storage
          .from("invoices")
          .createSignedUrl(path, 60 * 60 * 24 * 7); // 7 days
        if (signErr || !signed?.signedUrl) {
          toast.error("Could not generate share link");
          return;
        }
        publicUrl = signed.signedUrl;
      }

      // Build WhatsApp link to customer's phone
      const rawPhone: string | undefined = booking.clients?.phone;
      const digits = (rawPhone || "").replace(/\D/g, "");
      const customerNumber = digits.length === 10 ? `91${digits}` : digits; // heuristic, adjust as needed
      const message = `Hello ${booking.clients?.name || ""}, here is your invoice for ${booking.event_name} dated ${new Date(
        booking.event_date
      ).toLocaleDateString()}: ${publicUrl}`.trim();

      if (customerNumber) {
        const waUrl = `https://wa.me/${customerNumber}?text=${encodeURIComponent(message)}`;
        window.open(waUrl, "_blank");
        toast.success("Opening WhatsApp to share");
      } else {
        await navigator.clipboard.writeText(publicUrl);
        toast.success("Share link copied to clipboard");
      }
    } catch (e) {
      console.error(e);
      toast.error("Failed to prepare invoice for sharing");
    }
  };

  return (
    <div className="space-y-4 md:space-y-8 animate-fade-in">
      <div className="text-center space-y-1 md:space-y-2">
        <h1 className="text-2xl md:text-4xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
          Invoices
        </h1>
        <p className="text-muted-foreground text-sm md:text-lg">Generate professional branded invoices with GST</p>
      </div>

      <Card className="glass card-hover rounded-xl md:rounded-2xl border-0 shadow-card">
        <CardHeader className="pb-4 md:pb-6 pt-4 md:pt-8 px-4 md:px-8">
          <CardTitle className="flex items-center gap-2 md:gap-3 text-base md:text-xl font-semibold">
            <FileText className="h-5 w-5 md:h-6 md:w-6 text-primary" />
            Generate Invoice
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 md:space-y-6 px-4 md:px-8 pb-4 md:pb-8">
          <div className="space-y-4 md:space-y-6">
            <div className="space-y-3 p-4 bg-muted/30 rounded-lg border">
              <Label className="text-sm font-medium">Company Logo</Label>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                {companyLogo ? (
                  <div className="flex items-center gap-3 w-full">
                    <img src={companyLogo} alt="Company Logo" className="h-16 w-16 object-contain border rounded" />
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => document.getElementById('logo-upload')?.click()}>
                        Change Logo
                      </Button>
                      <Button variant="destructive" size="sm" onClick={removeCompanyLogo}>
                        Remove
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button variant="outline" onClick={() => document.getElementById('logo-upload')?.click()}>
                    <Upload className="mr-2 h-4 w-4" />
                    Upload Logo
                  </Button>
                )}
                <input
                  id="logo-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  className="hidden"
                />
              </div>
              <p className="text-xs text-muted-foreground">Logo will appear on invoices. Max size: 2MB</p>
            </div>

            <div className="space-y-3">
              <Label htmlFor="booking" className="text-sm font-medium">Select Booking</Label>
              <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    className="w-full justify-between"
                  >
                    {selectedBooking
                      ? `${bookings.find((b) => b.id === selectedBooking)?.event_name || 'Booking'} - ${bookings.find((b) => b.id === selectedBooking)?.clients?.name || 'No client'}`
                      : "Select booking..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[300px] p-0" align="start">
                  <Command filter={(value, search) => {
                    if (!search) return 1;
                    const booking = bookings.find(b => b.id === value);
                    if (!booking) return 0;
                    const searchLower = search.toLowerCase();
                    const nameMatch = booking.event_name?.toLowerCase().includes(searchLower) ? 1 : 0;
                    const clientMatch = booking.clients?.name?.toLowerCase().includes(searchLower) ? 1 : 0;
                    const dateMatch = new Date(booking.event_date).toLocaleDateString().includes(search) ? 1 : 0;
                    return nameMatch + clientMatch + dateMatch > 0 ? 1 : 0;
                  }}>
                    <CommandInput 
                      placeholder="Search bookings..." 
                      value={searchQuery}
                      onValueChange={setSearchQuery}
                    />
                    <CommandList>
                      <CommandEmpty>No bookings found.</CommandEmpty>
                      <CommandGroup>
                        {bookings.map((booking) => (
                          <CommandItem
                            key={booking.id}
                            value={booking.id}
                            onSelect={() => {
                              setSelectedBooking(booking.id === selectedBooking ? "" : booking.id);
                              setSearchQuery("");
                              setIsPopoverOpen(false); // Close the popover after selection
                            }}
                            className="cursor-pointer"
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4 flex-shrink-0",
                                selectedBooking === booking.id ? "opacity-100" : "opacity-0"
                              )}
                            />
                            <div className="flex-1 min-w-0">
                              <div className="font-medium truncate">
                                {booking.event_name || 'Unnamed Event'}
                              </div>
                              <div className="text-xs text-muted-foreground truncate">
                                {booking.clients?.name || 'No client'} • {new Date(booking.event_date).toLocaleDateString()}
                              </div>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 pt-3 md:pt-4 border-t">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label htmlFor="gst-toggle" className="text-sm font-medium">Include GST/Tax</Label>
                  <p className="text-xs text-muted-foreground">Add tax calculation to invoice</p>
                </div>
                <Switch
                  id="gst-toggle"
                  checked={showGst}
                  onCheckedChange={setShowGst}
                />
              </div>

              {showGst && (
                <div className="space-y-2">
                  <Label htmlFor="gst-rate" className="text-sm font-medium">GST Rate (%)</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="gst-rate"
                      type="text"
                      value={isEditingGst ? newGstRate : gstRate}
                      onChange={handleGstRateChange}
                      readOnly={!isEditingGst}
                      className={`rounded-xl ${isEditingGst ? 'bg-background' : 'bg-muted'}`}
                      placeholder="Enter GST rate"
                      suffix="%"
                    />
                    {isEditingGst ? (
                      <div className="flex gap-1">
                        <Button 
                          size="sm" 
                          variant="outline" 
                          onClick={() => {
                            setNewGstRate(gstRate.toString());
                            setIsEditingGst(false);
                          }}
                        >
                          Cancel
                        </Button>
                        <Button 
                          size="sm" 
                          onClick={saveGstRate}
                        >
                          Save
                        </Button>
                      </div>
                    ) : (
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => setIsEditingGst(true)}
                      >
                        Edit
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Enter GST rate (0-100%)
                  </p>
                </div>
              )}
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
            <Button onClick={generateInvoice} disabled={!selectedBooking} className="h-10 md:h-12 rounded-lg md:rounded-xl text-sm md:text-base touch-feedback">
              <Download className="mr-2 h-4 w-4 md:h-5 md:w-5" />
              Download PDF
            </Button>
            <Button onClick={shareInvoice} variant="outline" disabled={!selectedBooking} className="h-10 md:h-12 rounded-lg md:rounded-xl text-sm md:text-base touch-feedback">
              <Share2 className="mr-2 h-4 w-4 md:h-5 md:w-5" />
              Share to Customer
            </Button>
          </div>
        </CardContent>
      </Card>

      {selectedBooking && (
        <Card className="glass card-hover rounded-xl md:rounded-2xl border-0 shadow-card">
          <CardHeader className="pb-4 md:pb-6 pt-4 md:pt-8 px-4 md:px-8">
            <CardTitle className="flex items-center gap-2 md:gap-3 text-base md:text-xl font-semibold">
              <QrCode className="h-5 w-5 md:h-6 md:w-6 text-primary" />
              Invoice Preview
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 md:px-8 pb-4 md:pb-8">
            {(() => {
              const booking = bookings.find((b) => b.id === selectedBooking);
              if (!booking) return null;

              const totalPaid =
                booking.payments?.reduce((sum: number, p: any) => sum + Number(p.amount), 0) || 0;
              const subtotal = Number(booking.total_amount || 0);
              const taxAmount = showGst ? (subtotal * gstRate) / 100 : 0;
              const totalWithTax = subtotal + taxAmount;
              const balance = totalWithTax - totalPaid;

              return (
                <div className="space-y-4 md:space-y-6 p-4 md:p-6 lg:p-8 border border-border/50 rounded-lg md:rounded-xl bg-muted/30">
                  <div className="text-center">
                    <h2 className="text-xl md:text-2xl lg:text-3xl font-bold text-primary">INVOICE</h2>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8 pt-3 md:pt-4 lg:pt-6">
                    <div className="space-y-2 md:space-y-3">
                      <h3 className="font-semibold text-sm md:text-base lg:text-lg mb-2 md:mb-3">From:</h3>
                      <div className="space-y-2">
                        <p className="text-sm font-medium">{profile?.business_name || "Your Business"}</p>
                        <p className="text-sm text-muted-foreground">{profile?.email}</p>
                        <p className="text-sm text-muted-foreground">{profile?.phone}</p>
                      </div>
                    </div>
                    <div className="space-y-2 md:space-y-3">
                      <h3 className="font-semibold text-sm md:text-base lg:text-lg mb-2 md:mb-3">Bill To:</h3>
                      <div className="space-y-2">
                        <p className="text-sm font-medium">{booking.clients?.name || "N/A"}</p>
                        <p className="text-sm text-muted-foreground">{booking.clients?.email}</p>
                        <p className="text-sm text-muted-foreground">{booking.clients?.phone}</p>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-border/50 pt-4 md:pt-6">
                    <div className="space-y-2 md:space-y-3">
                      <div className="flex justify-between text-sm md:text-base py-2">
                        <span className="font-medium">Event:</span>
                        <span className="text-muted-foreground">{booking.event_name}</span>
                      </div>
                      <div className="flex justify-between text-sm md:text-base py-2">
                        <span className="font-medium">Package:</span>
                        <span className="text-muted-foreground">{booking.packages?.name || "N/A"}</span>
                      </div>
                      <div className="flex justify-between text-sm md:text-base py-2">
                        <span className="font-medium">Event Date:</span>
                        <span className="text-muted-foreground">{new Date(booking.event_date).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-border/50 pt-4 md:pt-6 space-y-2 md:space-y-3">
                    <div className="flex justify-between text-base md:text-lg py-2">
                      <span className="font-medium">Subtotal:</span>
                      <span className="font-medium">₹{subtotal.toLocaleString()}</span>
                    </div>
                    {showGst && (
                      <>
                        <div className="flex justify-between text-sm md:text-base py-2">
                          <span>GST ({gstRate}%):</span>
                          <span>₹{taxAmount.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-lg md:text-xl py-2 border-t pt-3">
                          <span className="font-semibold">Total with Tax:</span>
                          <span className="font-semibold">₹{totalWithTax.toLocaleString()}</span>
                        </div>
                      </>
                    )}
                    {!showGst && (
                      <div className="flex justify-between text-lg md:text-xl py-2">
                        <span className="font-semibold">Total Amount:</span>
                        <span className="font-semibold">₹{subtotal.toLocaleString()}</span>
                      </div>
                    )}
                    {profile?.business_gst && showGst && (
                      <div className="text-xs text-muted-foreground pt-2">
                        GSTIN: {profile.business_gst}
                      </div>
                    )}
                    <div className="flex justify-between text-sm md:text-base py-2 border-t pt-3">
                      <span>Amount Paid:</span>
                      <span className="text-green-600 font-medium">₹{totalPaid.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-xl md:text-2xl font-bold py-2">
                      <span>Balance Due:</span>
                      <span className={balance > 0 ? "text-red-600" : "text-green-600"}>
                        ₹{balance.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })()}
          </CardContent>
        </Card>
      )}

<div className="space-y-4 md:space-y-6">
        {bookings.length === 0 && (
            <Card className="glass card-hover rounded-xl md:rounded-2xl border-0 shadow-card">
              <CardContent className="flex flex-col items-center justify-center py-8 md:py-12">
                <FileText className="h-10 w-10 md:h-12 md:w-12 text-muted-foreground/50 mb-3 md:mb-4" />
                <p className="text-muted-foreground text-base md:text-lg mb-2">No bookings available</p>
                <p className="text-xs md:text-sm text-muted-foreground/70">Create bookings to generate invoices</p>
              </CardContent>
            </Card>
          )}
      </div>

      {/* Mobile FABs for quick actions */}
      <div className="md:hidden fixed bottom-24 right-4 z-40 flex flex-col gap-3">
        <Button
          size="icon"
          className="h-14 w-14 rounded-full shadow-lg bg-primary hover:bg-primary/90 transition-all duration-180 hover:scale-110"
          onClick={generateInvoice}
          disabled={!selectedBooking}
        >
          <Download className="h-7 w-7" />
        </Button>
        <Button
          size="icon"
          variant="outline"
          className="h-14 w-14 rounded-full shadow-lg border-border/50 hover:bg-muted/30 transition-all duration-180 hover:scale-110"
          onClick={shareInvoice}
          disabled={!selectedBooking}
        >
          <Share2 className="h-7 w-7" />
        </Button>
      </div>
    </div>
  );
};

export default Invoices;
