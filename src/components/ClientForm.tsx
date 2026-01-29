import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

type ClientFormData = {
  name: string;
  email: string;
  phone: string;
  whatsappNumber: string;
  useSameNumber: boolean;
  notes: string;
  stage: string;
  fullAddress: string;
  city: string;
  pincode: string;
  landmark: string;
  googleMapsLink: string;
};

type ClientFormProps = {
  onSuccess: (client: any) => void;
  onCancel: () => void;
};

export function ClientForm({ onSuccess, onCancel }: ClientFormProps) {
  const { user } = useAuth();
  const [formData, setFormData] = useState<ClientFormData>({
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
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 10);
    setFormData(prev => ({
      ...prev,
      phone: value,
      whatsappNumber: prev.useSameNumber ? value : prev.whatsappNumber
    }));
  };

  const handleWhatsAppChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 10);
    setFormData(prev => ({
      ...prev,
      whatsappNumber: value,
      useSameNumber: value === prev.phone
    }));
  };

  const toggleUseSameNumber = (checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      useSameNumber: checked,
      whatsappNumber: checked ? prev.phone : prev.whatsappNumber
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    // Validate phone number
    if (!/^\d{10}$/.test(formData.phone)) {
      toast.error("Please enter a valid 10-digit phone number");
      return;
    }

    setIsSubmitting(true);

    try {
      const clientData = {
        name: formData.name,
        email: formData.email || null,
        phone: formData.phone,
        whatsapp_number: formData.useSameNumber ? formData.phone : formData.whatsappNumber,
        notes: formData.notes || null,
        stage: 'client',
        vendor_id: user.id,
        full_address: formData.fullAddress || null,
        city: formData.city || null,
        pincode: formData.pincode || null,
        landmark: formData.landmark || null,
        google_maps_link: formData.googleMapsLink || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('clients')
        .insert([clientData])
        .select()
        .single();

      if (error) {
        if (error.code === '23505') { // Unique violation
          if (error.message.includes('email')) {
            throw new Error('A client with this email already exists');
          } else if (error.message.includes('phone')) {
            throw new Error('A client with this phone number already exists');
          }
        }
        throw error;
      }

      toast.success("Client added successfully");
      onSuccess(data);
    } catch (error: any) {
      console.error('Error saving client:', error);
      toast.error(error.message || 'Failed to add client');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
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
                  onCheckedChange={(checked: boolean) => toggleUseSameNumber(checked)}
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
            <Label htmlFor="googleMapsLink" className="text-sm font-medium text-foreground/80">Google Maps Link</Label>
            <Input
              id="googleMapsLink"
              type="url"
              value={formData.googleMapsLink}
              onChange={(e) => setFormData({ ...formData, googleMapsLink: e.target.value })}
              placeholder="https://maps.google.com/..."
              className="h-10 rounded-lg border-input focus-visible:ring-2 focus-visible:ring-offset-2"
            />
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="notes" className="text-sm font-medium text-foreground/80">Notes</Label>
        <Textarea
          id="notes"
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          placeholder="Additional notes about the client"
          rows={3}
          className="rounded-lg border-input focus-visible:ring-2 focus-visible:ring-offset-2"
        />
      </div>

      <div className="flex justify-end space-x-3 pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          className="h-10 px-6"
          disabled={isSubmitting}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          className="h-10 px-6"
          disabled={isSubmitting || !formData.name || !formData.phone}
        >
          {isSubmitting ? 'Saving...' : 'Save Client'}
        </Button>
      </div>
    </form>
  );
}

export default ClientForm;
