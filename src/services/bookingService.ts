import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface Booking {
  id: string;
  client_id: string;
  vendor_id: string;
  package_id: string | null;
  portfolio_item_id: string | null;
  entity_id: string | null;
  event_name: string;
  event_date: string;
  event_time?: string;
  location?: string;
  status: string;
  total_amount: number;
  created_at: string;
  updated_at: string;
  package?: {
    id: string;
    name: string;
  };
  portfolio_item?: {
    id: string;
    title: string;
  };
  entity?: {
    id: string;
    name: string;
  };
}

export const fetchClientBookings = async (clientId: string): Promise<Booking[]> => {
  try {
    const { data, error } = await supabase
      .from("bookings")
      .select(`
        *,
        package:packages(id, name),
        portfolio_item:portfolio_items(id, title),
        entity:entities(id, name)
      `)
      .eq("client_id", clientId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error("Error fetching bookings:", error);
    toast.error("Failed to load booking history");
    return [];
  }
};

export const createBooking = async (bookingData: Omit<Booking, 'id' | 'created_at' | 'updated_at'>): Promise<Booking | null> => {
  try {
    const { data, error } = await supabase
      .from('bookings')
      .insert(bookingData)
      .select()
      .single();

    if (error) throw error;
    
    toast.success('Booking created successfully');
    return data;
  } catch (error) {
    console.error('Error creating booking:', error);
    toast.error('Failed to create booking');
    return null;
  }
};

export const updateBookingStatus = async (bookingId: string, status: string): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('bookings')
      .update({ 
        status,
        updated_at: new Date().toISOString()
      })
      .eq('id', bookingId);

    if (error) throw error;
    
    toast.success('Booking status updated');
    return true;
  } catch (error) {
    console.error('Error updating booking status:', error);
    toast.error('Failed to update booking status');
    return false;
  }
};
