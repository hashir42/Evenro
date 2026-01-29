import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "lucide-react";
import { format } from "date-fns";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface BookingFormProps {
  onSubmit: (data: any) => void;
  onCancel: () => void;
  clients: any[];
  packages: any[];
  entities: any[];
  portfolioItems: any[];
  loading: boolean;
  formData: any;
  setFormData: (data: any) => void;
  formErrors: any;
  setFormErrors: (errors: any) => void;
  isEditing: boolean;
}

export const AddBookingForm = ({
  onSubmit,
  onCancel,
  clients,
  packages,
  entities,
  portfolioItems,
  loading,
  formData,
  setFormData,
  formErrors,
  setFormErrors,
  isEditing
}: BookingFormProps) => {
  const [clientSearch, setClientSearch] = useState("");
  const [filteredClients, setFilteredClients] = useState<any[]>([]);
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [date, setDate] = useState<Date | undefined>(formData.event_date ? new Date(formData.event_date) : undefined);

  useEffect(() => {
    if (clientSearch.trim()) {
      const filtered = clients.filter(client => 
        client.name?.toLowerCase().includes(clientSearch.toLowerCase()) ||
        client.email?.toLowerCase().includes(clientSearch.toLowerCase()) ||
        client.phone?.toLowerCase().includes(clientSearch.toLowerCase())
      );
      setFilteredClients(filtered);
    } else {
      setFilteredClients(clients);
    }
  }, [clientSearch, clients]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const handleDateSelect = (selectedDate: Date | undefined) => {
    setDate(selectedDate);
    if (selectedDate) {
      const formattedDate = format(selectedDate, 'yyyy-MM-dd');
      setFormData({ ...formData, event_date: formattedDate });
      if (formErrors.event_date) {
        setFormErrors({ ...formErrors, event_date: '' });
      }
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <div className="flex items-center">
            <Label htmlFor="event_name">Event Name</Label>
            <span className="text-red-500 ml-1">*</span>
          </div>
          <Input
            id="event_name"
            value={formData.event_name}
            onChange={(e) => {
              setFormData({ ...formData, event_name: e.target.value });
              if (formErrors.event_name) {
                setFormErrors({ ...formErrors, event_name: '' });
              }
            }}
            placeholder="Enter event name"
            className={formErrors.event_name ? 'border-red-500' : ''}
          />
          {formErrors.event_name && (
            <p className="text-red-500 text-xs mt-1">{formErrors.event_name}</p>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-center">
            <Label htmlFor="client_id">Client</Label>
            <span className="text-red-500 ml-1">*</span>
          </div>
          <div className="relative">
            <Input
              id="client_id"
              value={clientSearch}
              onChange={(e) => {
                setClientSearch(e.target.value);
                setShowClientDropdown(true);
              }}
              onFocus={() => setShowClientDropdown(true)}
              placeholder="Search client by name, email, or phone"
              className={formErrors.client_id ? 'border-red-500' : ''}
            />
            {showClientDropdown && (
              <div className="absolute z-10 w-full mt-1 bg-white border rounded-md shadow-lg max-h-60 overflow-auto">
                {filteredClients.length > 0 ? (
                  filteredClients.map((client) => (
                    <div
                      key={client.id}
                      className="p-2 hover:bg-gray-100 cursor-pointer"
                      onClick={() => {
                        setFormData({ ...formData, client_id: client.id });
                        setClientSearch(client.name || '');
                        setShowClientDropdown(false);
                        if (formErrors.client_id) {
                          setFormErrors({ ...formErrors, client_id: '' });
                        }
                      }}
                    >
                      <div className="font-medium">{client.name}</div>
                      <div className="text-sm text-gray-500">{client.email}</div>
                    </div>
                  ))
                ) : (
                  <div className="p-2 text-gray-500">No clients found</div>
                )}
              </div>
            )}
          </div>
          {formErrors.client_id && (
            <p className="text-red-500 text-xs mt-1">{formErrors.client_id}</p>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-center">
            <Label htmlFor="package_id">Package</Label>
            <span className="text-red-500 ml-1">*</span>
          </div>
          <Select
            value={formData.package_id}
            onValueChange={(value) => {
              setFormData({ ...formData, package_id: value });
              if (formErrors.package_id) {
                setFormErrors({ ...formErrors, package_id: '' });
              }
            }}
          >
            <SelectTrigger className={formErrors.package_id ? 'border-red-500' : ''}>
              <SelectValue placeholder="Select a package" />
            </SelectTrigger>
            <SelectContent>
              {packages.map((pkg) => (
                <SelectItem key={pkg.id} value={pkg.id}>
                  {pkg.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {formErrors.package_id && (
            <p className="text-red-500 text-xs mt-1">{formErrors.package_id}</p>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-center">
            <Label htmlFor="entity_id">Venue/Branch</Label>
            <span className="text-red-500 ml-1">*</span>
          </div>
          <Select
            value={formData.entity_id}
            onValueChange={(value) => {
              setFormData({ ...formData, entity_id: value });
              if (formErrors.entity_id) {
                setFormErrors({ ...formErrors, entity_id: '' });
              }
            }}
          >
            <SelectTrigger className={formErrors.entity_id ? 'border-red-500' : ''}>
              <SelectValue placeholder="Select a venue/branch" />
            </SelectTrigger>
            <SelectContent>
              {entities.map((entity) => (
                <SelectItem key={entity.id} value={entity.id}>
                  {entity.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {formErrors.entity_id && (
            <p className="text-red-500 text-xs mt-1">{formErrors.entity_id}</p>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-center">
            <Label htmlFor="event_date">Event Date</Label>
            <span className="text-red-500 ml-1">*</span>
          </div>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !date && "text-muted-foreground",
                  formErrors.event_date ? 'border-red-500' : ''
                )}
              >
                <Calendar className="mr-2 h-4 w-4" />
                {date ? format(date, "PPP") : <span>Pick a date</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <CalendarComponent
                mode="single"
                selected={date}
                onSelect={handleDateSelect}
                initialFocus
              />
            </PopoverContent>
          </Popover>
          {formErrors.event_date && (
            <p className="text-red-500 text-xs mt-1">{formErrors.event_date}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="event_time">Event Time</Label>
          <Input
            id="event_time"
            type="time"
            value={formData.event_time}
            onChange={(e) => {
              setFormData({ ...formData, event_time: e.target.value });
              if (formErrors.event_time) {
                setFormErrors({ ...formErrors, event_time: '' });
              }
            }}
            className={formErrors.event_time ? 'border-red-500' : ''}
          />
          {formErrors.event_time && (
            <p className="text-red-500 text-xs mt-1">{formErrors.event_time}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="location">Location</Label>
          <Input
            id="location"
            value={formData.location}
            onChange={(e) => {
              setFormData({ ...formData, location: e.target.value });
              if (formErrors.location) {
                setFormErrors({ ...formErrors, location: '' });
              }
            }}
            placeholder="Enter event location"
            className={formErrors.location ? 'border-red-500' : ''}
          />
          {formErrors.location && (
            <p className="text-red-500 text-xs mt-1">{formErrors.location}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="portfolio_item_id">Portfolio Item (Optional)</Label>
          <Select
            value={formData.portfolio_item_id || ''}
            onValueChange={(value) => {
              setFormData({ ...formData, portfolio_item_id: value });
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select a portfolio item" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">None</SelectItem>
              {portfolioItems.map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  {item.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="notes">Notes (Optional)</Label>
          <Input
            id="notes"
            value={formData.notes || ''}
            onChange={(e) => {
              setFormData({ ...formData, notes: e.target.value });
            }}
            placeholder="Any additional notes"
          />
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={loading}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? (
            <>
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              {isEditing ? 'Updating...' : 'Saving...'}
            </>
          ) : isEditing ? (
            'Update Booking'
          ) : (
            'Create Booking'
          )}
        </Button>
      </div>
    </form>
  );
};

export default AddBookingForm;
