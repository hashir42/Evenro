import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Package as PackageIcon, Pencil, Trash2, Copy, Building2, Check, X } from "lucide-react";
import { toast } from "sonner";

const Packages = () => {
  const { user } = useAuth();
  const [packages, setPackages] = useState<any[]>([]);
  const [entities, setEntities] = useState<any[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [editingPackage, setEditingPackage] = useState<any>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [packageToDelete, setPackageToDelete] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    price: 0,
    entity_id: "",
    is_active: true,
  });

  useEffect(() => {
    if (user) {
      fetchPackages();
      fetchEntities();
    }
  }, [user]);

  const fetchPackages = async () => {
    const { data, error } = await supabase
      .from("packages")
      .select("*, entities(name)")
      .eq("vendor_id", user!.id)
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Failed to fetch packages");
    } else {
      setPackages(data || []);
    }
  };

  const fetchEntities = async () => {
    const { data, error } = await supabase
      .from("entities")
      .select("*")
      .eq("vendor_id", user!.id)
      .eq("is_active", true)
      .order("name");

    if (error) {
      toast.error("Failed to fetch entities");
    } else {
      setEntities(data || []);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (editingPackage) {
        const { error } = await supabase
          .from("packages")
          .update(formData)
          .eq("id", editingPackage.id);

        if (error) {
          if (error.code === '23505') { // Unique violation error code
            toast.error(`A package with the name "${formData.name}" already exists. Please choose a different name.`);
          } else {
            toast.error(`Failed to update package: ${error.message}`);
          }
        } else {
          toast.success("Package updated successfully");
          setIsOpen(false);
          setEditingPackage(null);
          fetchPackages();
        }
      } else {
        const { error } = await supabase.from("packages").insert({
          ...formData,
          vendor_id: user!.id,
        });

        if (error) {
          if (error.code === '23505') { // Unique violation error code
            toast.error(`A package with the name "${formData.name}" already exists. Please choose a different name.`);
          } else {
            toast.error(`Failed to create package: ${error.message}`);
          }
        } else {
          toast.success("Package created successfully");
          setIsOpen(false);
          fetchPackages();
        }
      }
    } catch (error: any) {
      console.error('Error in handleSubmit:', error);
      toast.error(`An unexpected error occurred: ${error.message}`);
    }

    setFormData({ name: "", description: "", price: 0, entity_id: "" });
  };

  const deletePackage = async (id: string) => {
    setPackageToDelete(id);
    setDeleteDialogOpen(true);
  };

  const confirmDeletePackage = async () => {
    if (!packageToDelete) return;

    const { error } = await supabase.from("packages").delete().eq("id", packageToDelete);

    if (error) {
      toast.error("Failed to delete package");
    } else {
      toast.success("Package deleted");
      fetchPackages();
    }

    setDeleteDialogOpen(false);
    setPackageToDelete(null);
  };

  const duplicatePackage = async (pkg: any) => {
    const { error } = await supabase.from("packages").insert({
      name: `${pkg.name} (Copy)`,
      description: pkg.description,
      price: pkg.price,
      entity_id: pkg.entity_id,
      vendor_id: user!.id,
    });

    if (error) {
      toast.error("Failed to duplicate package");
    } else {
      toast.success("Package duplicated successfully");
      fetchPackages();
    }
  };

  const togglePackageStatus = async (pkg: any) => {
    const newStatus = !pkg.is_active;
    const { error } = await supabase
      .from("packages")
      .update({ is_active: newStatus })
      .eq("id", pkg.id);

    if (error) {
      toast.error(`Failed to ${newStatus ? 'activate' : 'deactivate'} package`);
    } else {
      toast.success(`Package ${newStatus ? 'activated' : 'deactivated'} successfully`);
      fetchPackages();
    }
  };

  const openEditDialog = (pkg: any) => {
    setEditingPackage(pkg);
    setFormData({
      name: pkg.name,
      description: pkg.description || "",
      price: pkg.price,
      entity_id: pkg.entity_id || "",
      is_active: pkg.is_active !== false, // Default to true if undefined
    });
    setIsOpen(true);
  };

  return (
    <div className="space-y-4 md:space-y-8 animate-fade-in">
      <div className="text-center space-y-1 md:space-y-2">
        <h1 className="text-2xl md:text-4xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
          Packages
        </h1>
        <p className="text-muted-foreground text-sm md:text-lg">Manage your service packages</p>
      </div>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 md:gap-4">
        <div className="flex items-center gap-2 md:gap-4">
          <Dialog
            open={isOpen}
            onOpenChange={(open) => {
              setIsOpen(open);
              if (!open) {
                setEditingPackage(null);
                setFormData({ name: "", description: "", price: 0, entity_id: "", is_active: true });
              }
            }}
          >
            <DialogTrigger asChild>
              <Button className="btn-primary touch-feedback w-full sm:w-auto h-9 md:h-10 text-xs md:text-sm px-3 md:px-4">
                <Plus className="mr-1 md:mr-2 h-3.5 w-3.5 md:h-4 md:w-4" />
                <span className="hidden sm:inline">New Package</span>
                <span className="sm:hidden">New</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="md:max-w-2xl w-full md:w-auto rounded-t-2xl md:rounded-xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-lg md:text-xl font-semibold">{editingPackage ? "Edit Package" : "Create New Package"}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4 md:space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-6">
                  <div className="space-y-3">
                    <Label htmlFor="entity_id" className="text-sm font-medium">
                      Venue/Branch <span className="text-red-500">*</span>
                    </Label>
                    <Select
                      value={formData.entity_id}
                      onValueChange={(value) => setFormData({ ...formData, entity_id: value })}
                    >
                      <SelectTrigger className="rounded-xl" required>
                        <SelectValue placeholder="Select venue/branch" />
                      </SelectTrigger>
                      <SelectContent>
                        {entities.map((entity) => (
                          <SelectItem key={entity.id} value={entity.id}>
                            {entity.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-3">
                    <Label htmlFor="name" className="text-sm font-medium">
                      Package Name <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                      placeholder="e.g., Wedding Photography Package"
                      className="rounded-xl"
                    />
                  </div>
                  <div className="space-y-3 md:col-span-2">
                    <Label htmlFor="description" className="text-sm font-medium">
                      Description <span className="text-muted-foreground text-xs">(optional)</span>
                    </Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      rows={4}
                      placeholder="Describe what's included in this package..."
                      className="rounded-xl"
                    />
                  </div>
                  <div className="space-y-3">
                    <Label htmlFor="price" className="text-sm font-medium">
                      Price (₹) <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="price"
                      type="number"
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) })}
                      required
                      min="0"
                      step="0.01"
                      className="rounded-xl"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2 md:gap-3 pt-3 md:pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsOpen(false);
                      setEditingPackage(null);
                      setFormData({ name: "", description: "", price: 0, entity_id: "", is_active: true });
                    }}
                    className="px-4 md:px-6 touch-feedback"
                  >
                    Cancel
                  </Button>
                  <Button type="submit" className="px-4 md:px-6 touch-feedback">{editingPackage ? "Update" : "Create"}</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4 lg:gap-6">
        {packages.length === 0 ? (
          <Card className="col-span-full glass card-hover rounded-xl md:rounded-2xl border-0 shadow-card">
            <CardContent className="flex flex-col items-center justify-center py-8 md:py-12">
              <PackageIcon className="h-10 w-10 md:h-12 md:w-12 text-muted-foreground/50 mb-3 md:mb-4" />
              <p className="text-muted-foreground text-base md:text-lg mb-2">No packages yet</p>
              <p className="text-xs md:text-sm text-muted-foreground/70">Create your first package to get started</p>
            </CardContent>
          </Card>
        ) : (
          packages.map((pkg) => (
            <Card key={pkg.id} className={`group glass card-hover rounded-xl md:rounded-2xl border-0 shadow-card touch-feedback active:scale-[0.98] ${!pkg.is_active ? 'opacity-70' : ''}`}>
              {!pkg.is_active && (
                <div className="absolute top-2 right-2 bg-yellow-100 text-yellow-800 text-xs font-medium px-2 py-0.5 rounded-full flex items-center">
                  <X className="w-3 h-3 mr-1" /> Inactive
                </div>
              )}
              <CardHeader className="pb-2 md:pb-3 pt-4 md:pt-6 px-4 md:px-6">
                <CardTitle className="flex items-center justify-between gap-2">
                  <span className="text-base md:text-lg font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                    {pkg.name}
                  </span>
                  <PackageIcon className="h-4 w-4 md:h-5 md:w-5 text-primary flex-shrink-0" />
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 md:px-6 pb-3 md:pb-4 space-y-1.5 md:space-y-2">
                {pkg.entities?.name && (
                  <div className="flex items-center text-xs md:text-sm text-primary font-medium truncate">
                    <Building2 className="mr-1 md:mr-1.5 h-3 w-3 md:h-3.5 md:w-3.5 flex-shrink-0" />
                    <span className="truncate">{pkg.entities.name}</span>
                  </div>
                )}
                {pkg.description && (
                  <p className="text-xs md:text-sm text-muted-foreground line-clamp-2">{pkg.description}</p>
                )}
                <div className="text-base md:text-xl font-bold text-primary pt-1">₹{pkg.price.toLocaleString()}</div>
                <div className="flex items-center justify-between pt-2">
                  <div className="flex items-center space-x-2">
                    <span className={`text-xs font-medium ${pkg.is_active ? 'text-green-600' : 'text-gray-500'}`}>
                      {pkg.is_active ? 'Active' : 'Inactive'}
                    </span>
                    <button
                      type="button"
                      onClick={() => togglePackageStatus(pkg)}
                      className={`relative inline-flex h-5 w-10 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
                        pkg.is_active ? 'bg-green-500' : 'bg-gray-200'
                      }`}
                      role="switch"
                      aria-checked={pkg.is_active}
                    >
                      <span className="sr-only">Toggle status</span>
                      <span
                        aria-hidden="true"
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          pkg.is_active ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                  <div className="flex gap-1 md:gap-1.5">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openEditDialog(pkg)}
                    className="flex-1 h-8 md:h-9 touch-feedback text-xs md:text-sm"
                  >
                    <Pencil className="h-3 w-3 md:h-3.5 md:w-3.5 md:mr-1" />
                    <span className="hidden md:inline">Edit</span>
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => deletePackage(pkg.id)}
                    className="h-8 md:h-9 w-8 md:w-9 p-0 touch-feedback text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200 hover:border-red-300"
                    title="Delete"
                  >
                    <Trash2 className="h-3 w-3 md:h-3.5 md:w-3.5" />
                  </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="md:max-w-sm w-full md:w-auto rounded-t-2xl md:rounded-lg">
          <DialogHeader>
            <DialogTitle>Confirm Delete</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Are you sure you want to delete this package? This action cannot be undone.</p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={confirmDeletePackage}>Delete</Button>
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

export default Packages;
