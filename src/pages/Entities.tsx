import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Plus, Building2, Pencil, Trash2, MapPin, Users, DollarSign, MapPinned, Clock } from "lucide-react";

const Entities = () => {
  const { user } = useAuth();
  const [entities, setEntities] = useState<any[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [editingEntity, setEditingEntity] = useState<any>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [entityToDelete, setEntityToDelete] = useState<string | null>(null);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [isLoadingPincode, setIsLoadingPincode] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    category: null as string | null,
    location: null as string | null,
    address: null as string | null,
    city: "",
    state: "",
    zip_code: "",
    contact_person: null as string | null,
    phone: null as string | null,
    email: null as string | null,
    capacity: null as number | null,
    description: null as string | null,
    is_active: true,
    amenities: [] as string[],
    operating_hours: null as any,
    portfolio_images: [] as string[]
  });

  useEffect(() => {
    if (user) {
      fetchEntities();
    }
  }, [user]);

  const fetchEntities = async () => {
    const { data, error } = await supabase
      .from("entities")
      .select("*")
      .eq("vendor_id", user!.id)
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Failed to fetch entities");
    } else {
      setEntities(data || []);
    }
  };

  const fetchPincodeDetails = useCallback(async (pincode: string) => {
    if (pincode.length !== 6) return;
    
    setIsLoadingPincode(true);
    try {
      const response = await fetch(`https://api.postalpincode.in/pincode/${pincode}`);
      const data = await response.json();
      
      if (data && data[0]?.Status === 'Success' && data[0]?.PostOffice?.length > 0) {
        const firstPostOffice = data[0].PostOffice[0];
        setFormData(prev => ({
          ...prev,
          city: firstPostOffice.District || prev.city,
          state: firstPostOffice.State || prev.state
        }));
      } else {
        toast.warning('PIN code not found. Please enter city and state manually.');
      }
    } catch (error) {
      console.error('Error fetching pincode details:', error);
      toast.error('Failed to fetch location details. Please enter manually.');
    } finally {
      setIsLoadingPincode(false);
    }
  }, []);

  const handlePincodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const pincode = e.target.value.replace(/\D/g, '').slice(0, 6);
    setFormData(prev => ({
      ...prev,
      zip_code: pincode,
      // Clear city and state when pincode is being changed
      ...(pincode.length < 6 && { city: '', state: '' })
    }));

    // Only fetch if we have exactly 6 digits
    if (pincode.length === 6) {
      fetchPincodeDetails(pincode);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const isEntityNameUnique = async (name: string, excludeId?: string): Promise<boolean> => {
    const { data, error } = await supabase
      .from("entities")
      .select("id, name")
      .ilike('name', name.trim())
      .neq('id', excludeId || '');

    if (error) {
      console.error('Error checking entity name:', error);
      return true; // Allow submission if there's an error checking
    }
    
    return data.length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const name = formData.name.trim();
    
    // Ensure required fields are present
    if (!name) {
      toast.error("Name is required");
      return;
    }

    // Check for duplicate name
    const isUnique = await isEntityNameUnique(name, editingEntity?.id);
    if (!isUnique) {
      toast.error("An entity with this name already exists. Please choose a different name.");
      return;
    }
    
    // If we're editing and the name hasn't changed, skip the check
    if (editingEntity && editingEntity.name === name) {
      setShowSubmitConfirm(true);
      return;
    }
    
    // Show confirmation dialog if all validations pass
    setShowSubmitConfirm(true);
  };

  const confirmSubmit = async () => {
    // Double-check name uniqueness in case of race conditions
    const name = formData.name.trim();
    const isUnique = await isEntityNameUnique(name, editingEntity?.id);
    if (!isUnique) {
      toast.error("This name is already taken. Please choose a different name.");
      return;
    }

    // Prepare the data to match the database schema
    const entityData = {
      name: formData.name,
      category: formData.category,
      location: formData.location,
      address: formData.address,
      city: formData.city,
      state: formData.state,
      zip_code: formData.zip_code,
      contact_person: formData.contact_person,
      phone: formData.phone,
      email: formData.email,
      capacity: formData.capacity,
      description: formData.description,
      is_active: formData.is_active,
      amenities: formData.amenities,
      operating_hours: formData.operating_hours,
      portfolio_images: formData.portfolio_images,
      // Only include vendor_id for new entities
      ...(editingEntity ? {} : { vendor_id: user!.id })
    };

    try {
      if (editingEntity) {
        const { data, error } = await supabase
          .from("entities")
          .update(entityData)
          .eq("id", editingEntity.id)
          .select();

        if (error) throw error;
        
        toast.success("Entity updated successfully");
        setIsOpen(false);
        setEditingEntity(null);
      } else {
        const { data, error } = await supabase
          .from("entities")
          .insert([entityData])
          .select();

        if (error) throw error;
        
        toast.success("Entity created successfully");
        setIsOpen(false);
      }
      
      resetForm();
      fetchEntities();
    } catch (error: any) {
      console.error('Error:', error);
      const errorMessage = error?.message || 'An unexpected error occurred';
      toast.error(`Failed to save entity: ${errorMessage}`);
    } finally {
      setShowSubmitConfirm(false);
    }
  };

  const toggleEntityStatus = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from("entities")
        .update({ is_active: !currentStatus })
        .eq("id", id);

      if (error) throw error;
      
      toast.success(`Entity marked as ${!currentStatus ? 'active' : 'inactive'}`);
      fetchEntities();
    } catch (error) {
      console.error("Error updating entity status:", error);
      toast.error("Failed to update entity status");
    }
  };

  const deleteEntity = async (id: string) => {
    setEntityToDelete(id);
    setDeleteDialogOpen(true);
  };

  const confirmDeleteEntity = async () => {
    if (!entityToDelete) return;

    const { error } = await supabase.from("entities").delete().eq("id", entityToDelete);

    if (error) {
      toast.error("Failed to delete entity");
    } else {
      toast.success("Entity deleted");
      fetchEntities();
    }

    setDeleteDialogOpen(false);
    setEntityToDelete(null);
  };

  const openEditDialog = (entity: any) => {
    setEditingEntity(entity);
    setFormData({
      name: entity.name,
      category: entity.category,
      location: entity.location,
      address: entity.address,
      city: entity.city,
      state: entity.state,
      zip_code: entity.zip_code,
      contact_person: entity.contact_person,
      phone: entity.phone,
      email: entity.email,
      capacity: entity.capacity,
      description: entity.description,
      is_active: entity.is_active,
      amenities: entity.amenities || [],
      operating_hours: entity.operating_hours,
      portfolio_images: entity.portfolio_images || []
    });
    setIsOpen(true);
  };
  
  const openMapView = (entity: any) => {
    if (entity.latitude && entity.longitude) {
      window.open(`https://www.google.com/maps?q=${entity.latitude},${entity.longitude}`, '_blank');
    } else if (entity.address) {
      const address = `${entity.address}, ${entity.city}, ${entity.state} ${entity.zip_code}`;
      window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`, '_blank');
    } else {
      toast.error("No location information available");
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      category: null,
      location: null,
      address: null,
      city: null,
      state: null,
      zip_code: null,
      contact_person: null,
      phone: null,
      email: null,
      capacity: null,
      description: null,
      is_active: true,
      amenities: [],
      operating_hours: null,
      portfolio_images: []
    });
  };

  return (
    <div className="space-y-4 md:space-y-8 animate-fade-in">
      <div className="text-center space-y-1 md:space-y-2">
        <h1 className="text-2xl md:text-4xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
          Venues & Branches
        </h1>
        <p className="text-muted-foreground text-sm md:text-lg">Manage your business locations</p>
      </div>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 md:gap-4">
        <div className="flex items-center gap-2 md:gap-4">
          <Dialog
            open={isOpen}
            onOpenChange={(open) => {
              setIsOpen(open);
              if (!open) {
                setEditingEntity(null);
                resetForm();
              }
            }}
          >
            <DialogTrigger asChild>
              <Button className="btn-primary touch-feedback w-full sm:w-auto h-9 md:h-10 text-xs md:text-sm px-3 md:px-4">
                <Plus className="mr-1 md:mr-2 h-3.5 w-3.5 md:h-4 md:w-4" />
                <span className="hidden sm:inline">New Entity</span>
                <span className="sm:hidden">New</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="w-[98vw] max-w-5xl rounded-t-2xl md:rounded-xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-lg md:text-xl font-semibold">{editingEntity ? "Edit Entity" : "Create New Entity"}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4 p-1 md:p-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                  <div className="space-y-3">
                    <Label htmlFor="name" className="text-sm font-medium">Entity Name *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                      placeholder="e.g., Main Venue, Downtown Branch"
                      className="rounded-xl h-10 text-sm"
                    />
                  </div>
                  <div className="space-y-3">
                    <Label htmlFor="category" className="text-sm font-medium">Category <span className="text-red-500">*</span></Label>
                    <Input
                      id="category"
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      placeholder="e.g., Wedding Hall, Studio"
                      className="rounded-xl h-10 text-sm"
                      required
                    />
                  </div>
                  <div className="space-y-3">
                    <Label htmlFor="capacity" className="text-sm font-medium">Capacity</Label>
                    <Input
                      id="capacity"
                      type="number"
                      value={formData.capacity}
                      onChange={(e) => setFormData({ ...formData, capacity: e.target.value === '' ? '' : parseInt(e.target.value) || 0 })}
                      placeholder="Max guests/people"
                      className="rounded-xl h-10 text-sm"
                    />
                  </div>
                  <div className="space-y-3 md:col-span-2">
                    <Label htmlFor="address" className="text-sm font-medium">Full Address <span className="text-red-500">*</span></Label>
                    <Input
                      id="address"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      placeholder="Street address"
                      className="rounded-xl h-10 text-sm"
                      required
                    />
                  </div>
                  <div className="space-y-3">
                    <Label htmlFor="zip_code" className="text-sm font-medium">Pin code <span className="text-red-500">*</span></Label>
                    <div className="relative">
                      <Input
                        id="zip_code"
                        name="zip_code"
                        value={formData.zip_code}
                        onChange={handlePincodeChange}
                        placeholder="6-digit PIN code"
                        maxLength={6}
                        pattern="\d{6}"
                        className="rounded-xl pr-10"
                        required
                      />
                      {isLoadingPincode && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                          <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">Enter 6-digit PIN code to auto-fill city & state</p>
                  </div>
                  <div className="space-y-3">
                    <Label htmlFor="city" className="text-sm font-medium">City <span className="text-red-500">*</span></Label>
                    <Input
                      id="city"
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      className="rounded-xl h-10 text-sm"
                      required
                    />
                  </div>
                  <div className="space-y-3">
                    <Label htmlFor="state" className="text-sm font-medium">State <span className="text-red-500">*</span></Label>
                    <Input
                      id="state"
                      value={formData.state}
                      onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                      className="rounded-xl h-10 text-sm"
                      required
                    />
                  </div>
                  <div className="space-y-3">
                    <Label htmlFor="contact_person" className="text-sm font-medium">Contact Person <span className="text-red-500">*</span></Label>
                    <Input
                      id="contact_person"
                      value={formData.contact_person}
                      onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                      className="rounded-xl h-10 text-sm"
                      required
                    />
                  </div>
                  <div className="space-y-3">
                    <Label htmlFor="phone" className="text-sm font-medium">Phone <span className="text-red-500">*</span></Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="rounded-xl h-10 text-sm"
                      required
                    />
                  </div>
                  <div className="space-y-3 md:col-span-2">
                    <Label htmlFor="email" className="text-sm font-medium">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="rounded-xl h-10 text-sm"
                    />
                  </div>
                  <div className="space-y-3 md:col-span-2">
                    <Label htmlFor="description" className="text-sm font-medium">Description</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      rows={3}
                      placeholder="Brief description of this location..."
                      className="rounded-xl h-10 text-sm"
                    />
                  </div>
                  <div className="space-y-3 md:col-span-2">
                    <div className="flex items-center gap-3">
                      <Switch
                        id="is_active"
                        checked={formData.is_active}
                        onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                      />
                      <Label htmlFor="is_active" className="text-sm font-medium">Active (available for bookings)</Label>
                    </div>
                  </div>

                  {/* Location & Maps and Custom Pricing & Tax sections removed as per request */}

                  {/* Availability Status */}
                  <div className="md:col-span-2 pt-4 border-t">
                    <h3 className="text-lg font-semibold mb-4">Availability Status</h3>
                  </div>
                  <div className="space-y-3 md:col-span-2">
                    <Label htmlFor="availability_status" className="text-sm font-medium">Current Status</Label>
                    <select
                      id="availability_status"
                      value={formData.availability_status}
                      onChange={(e) => setFormData({ ...formData, availability_status: e.target.value })}
                      className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 shadow-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500/50 focus:outline-none"
                    >
                      <option value="available">Available</option>
                      <option value="busy">Busy</option>
                      <option value="maintenance">Maintenance</option>
                    </select>
                  </div>
                </div>
                <div className="flex justify-end gap-2 md:gap-3 pt-3 md:pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsOpen(false);
                      setEditingEntity(null);
                      resetForm();
                    }}
                    className="px-4 md:px-6 touch-feedback"
                  >
                    Cancel
                  </Button>
                  <Button type="submit" className="px-4 md:px-6 touch-feedback">{editingEntity ? "Update" : "Create"}</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4 lg:gap-6">
        {entities.length === 0 ? (
          <Card className="col-span-full glass card-hover rounded-xl md:rounded-2xl border-0 shadow-card">
            <CardContent className="flex flex-col items-center justify-center py-8 md:py-12">
              <Building2 className="h-10 w-10 md:h-12 md:w-12 text-muted-foreground/50 mb-3 md:mb-4" />
              <p className="text-muted-foreground text-base md:text-lg mb-2">No entities yet</p>
              <p className="text-xs md:text-sm text-muted-foreground/70">Create your first venue/branch to get started</p>
            </CardContent>
          </Card>
        ) : (
          entities.map((entity) => (
            <Card key={entity.id} className="group glass card-hover rounded-xl md:rounded-2xl border-0 shadow-card flex flex-col touch-feedback active:scale-[0.98]">
              <CardHeader className="pb-2 md:pb-3 pt-4 md:pt-6 px-4 md:px-6">
                <CardTitle className="flex items-center justify-between gap-2">
                  <span className="text-base md:text-lg font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                    {entity.name}
                  </span>
                  <Building2 className="h-4 w-4 md:h-5 md:w-5 text-primary flex-shrink-0" />
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 md:px-6 pb-3 md:pb-4 flex flex-col flex-1">
                <div className="space-y-1.5 md:space-y-2 flex-1">
                  {/* Category badge */}
                  {entity.category && (
                    <div className="text-xs md:text-sm bg-primary/10 text-primary px-2 md:px-3 py-0.5 md:py-1 rounded-full inline-block font-medium mb-2">
                      {entity.category}
                    </div>
                  )}
                  
                  {/* Address section */}
                  <div className="space-y-1 text-sm text-foreground/80">
                    {entity.address && (
                      <div className="flex items-start gap-2">
                        <MapPin className="h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-muted-foreground" />
                        <span>{entity.address}</span>
                      </div>
                    )}
                    {(entity.city || entity.state || entity.zip_code) && (
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                        {entity.city && <span>{entity.city}</span>}
                        {entity.state && <span>{entity.state}</span>}
                        {entity.zip_code && <span>{entity.zip_code}</span>}
                      </div>
                    )}
                  </div>

                  {/* Capacity */}
                  {entity.capacity > 0 && (
                    <p className="text-xs md:text-sm truncate">
                      <span className="font-medium">Capacity:</span> <span className="font-semibold">{entity.capacity}</span>
                    </p>
                  )}

                  {/* Description */}
                  {entity.description && (
                    <p className="text-xs md:text-sm text-muted-foreground line-clamp-2">{entity.description}</p>
                  )}

                  {/* Status badges */}
                  <div className="flex items-center gap-1 md:gap-1.5 flex-wrap">
                    <span className={`px-2 md:px-2.5 py-0.5 rounded-full text-[10px] md:text-xs font-medium whitespace-nowrap ${
                      entity.is_active
                        ? "bg-green-100 text-green-800"
                        : "bg-gray-100 text-gray-800"
                    }`}>
                      {entity.is_active ? "Active" : "Inactive"}
                    </span>
                    {entity.availability_status && (
                      <span className={`px-2 md:px-2.5 py-0.5 rounded-full text-[10px] md:text-xs font-medium whitespace-nowrap ${
                        entity.availability_status === "available"
                          ? "bg-blue-100 text-blue-800"
                          : entity.availability_status === "busy"
                          ? "bg-yellow-100 text-yellow-800"
                          : "bg-red-100 text-red-800"
                      }`}>
                        <Clock className="h-2.5 w-2.5 md:h-3 md:w-3 inline mr-0.5" />
                        {entity.availability_status}
                      </span>
                    )}
                  </div>

                  {/* Custom Pricing Info */}
                  {entity.custom_pricing_enabled && entity.base_price > 0 && (
                    <div className="pt-1 md:pt-2 border-t border-border/50">
                      <p className="text-xs md:text-sm truncate">
                        <span className="font-medium">Price:</span> <span className="text-primary font-bold">₹{entity.base_price}</span>
                        {entity.custom_tax_rate > 0 && <span className="text-[10px] md:text-xs text-muted-foreground ml-1">(+{entity.custom_tax_rate}%)</span>}
                      </p>
                    </div>
                  )}
                </div>

                {/* Buttons always at bottom */}
                <div className="flex gap-1 md:gap-1.5 pt-2 flex-wrap mt-auto">
                  <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-muted/50">
                    <span className="text-xs text-muted-foreground">Status:</span>
                    <div className="flex items-center gap-1">
                      <span className={`text-xs font-medium ${entity.is_active ? 'text-green-600' : 'text-muted-foreground'}`}>
                        {entity.is_active ? 'Active' : 'Inactive'}
                      </span>
                      <Switch
                        checked={entity.is_active}
                        onCheckedChange={() => toggleEntityStatus(entity.id, entity.is_active)}
                        className="data-[state=checked]:bg-green-500 data-[state=unchecked]:bg-gray-300"
                        title={entity.is_active ? "Mark as Inactive" : "Mark as Active"}
                      />
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openEditDialog(entity)}
                    className="flex-1 min-w-0 h-8 md:h-9 touch-feedback"
                    title="Edit Entity"
                  >
                    <Pencil className="h-3 w-3 md:h-3.5 md:w-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => deleteEntity(entity.id)}
                    className="flex-1 min-w-0 h-8 md:h-9 touch-feedback"
                    title="Delete Entity"
                  >
                    <Trash2 className="h-3 w-3 md:h-3.5 md:w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Submit Confirmation Dialog */}
      <Dialog open={showSubmitConfirm} onOpenChange={setShowSubmitConfirm}>
        <DialogContent className="sm:max-w-[425px] rounded-xl">
          <DialogHeader>
            <DialogTitle>{editingEntity ? 'Update' : 'Create'} Entity</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p>Are you sure you want to {editingEntity ? 'update' : 'create'} this entity?</p>
            {!editingEntity && <p className="text-sm text-muted-foreground mt-2">You can edit the details later if needed.</p>}
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setShowSubmitConfirm(false)}>
              Cancel
            </Button>
            <Button 
              onClick={confirmSubmit}
              className="bg-primary hover:bg-primary/90"
            >
              {editingEntity ? 'Update' : 'Create'} Entity
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[425px] rounded-xl">
          <DialogHeader>
            <DialogTitle>Delete Entity</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p>Are you sure you want to delete this entity? This action cannot be undone.</p>
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDeleteEntity}>
              Delete
            </Button>
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

export default Entities;
