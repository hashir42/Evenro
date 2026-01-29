import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface Payment {
  id: string;
  client_id: string;
  booking_id: string;
  vendor_id: string;
  amount: number;
  payment_date: string;
  payment_method: string;
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  transaction_id?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  booking?: {
    id: string;
    event_name: string;
    event_date: string;
  };
}

export const fetchClientPayments = async (clientId: string): Promise<Payment[]> => {
  try {
    console.log('Fetching payments for client ID:', clientId);
    
    // First, get all bookings for this client
    const { data: bookings, error: bookingsError } = await supabase
      .from('bookings')
      .select('id')
      .eq('client_id', clientId);

    if (bookingsError) {
      console.error('Error fetching client bookings:', bookingsError);
      toast.error('Error loading booking information');
      return [];
    }

    if (!bookings || bookings.length === 0) {
      console.log('No bookings found for client:', clientId);
      return [];
    }

    const bookingIds = bookings.map(b => b.id);
    console.log('Found booking IDs:', bookingIds);

    // Now fetch payments for these bookings
    const { data: payments, error } = await supabase
      .from('payments')
      .select(`
        *,
        booking:bookings!inner(
          id,
          event_name,
          event_date,
          client_id
        )
      `)
      .in('booking_id', bookingIds)
      .order('payment_date', { ascending: false });

    if (error) {
      console.error('Error fetching payments:', error);
      toast.error('Error loading payment history');
      return [];
    }

    console.log('Payments data received:', payments);
    
    // Transform the data to match the Payment interface
    return (payments || []).map(payment => ({
      id: payment.id,
      client_id: payment.booking?.client_id || clientId,
      booking_id: payment.booking_id,
      vendor_id: payment.vendor_id || '',
      amount: Number(payment.amount) || 0,
      payment_date: payment.payment_date || new Date().toISOString().split('T')[0],
      payment_method: payment.payment_method || 'cash',
      status: payment.status || 'completed',
      transaction_id: payment.transaction_id || `txn_${payment.id.substring(0, 8)}`,
      notes: payment.notes || '',
      created_at: payment.created_at,
      updated_at: payment.updated_at || payment.created_at,
      booking: payment.booking ? {
        id: payment.booking.id,
        event_name: payment.booking.event_name || 'Unnamed Event',
        event_date: payment.booking.event_date || new Date().toISOString()
      } : null
    }));
  } catch (error) {
    console.error("Error fetching payments:", error);
    toast.error("Failed to load payment history");
    return [];
  }
};

export const recordPayment = async (
  paymentData: Omit<Payment, 'id' | 'payment_date' | 'created_at' | 'updated_at'>
): Promise<Payment | null> => {
  try {
    const { data, error } = await supabase
      .from('payments')
      .insert({
        ...paymentData,
        payment_date: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;
    
    toast.success('Payment recorded successfully');
    return data;
  } catch (error) {
    console.error('Error recording payment:', error);
    toast.error('Failed to record payment');
    return null;
  }
};

export const updatePaymentStatus = async (paymentId: string, status: Payment['status']): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('payments')
      .update({ 
        status,
        updated_at: new Date().toISOString()
      })
      .eq('id', paymentId);

    if (error) throw error;
    
    toast.success('Payment status updated');
    return true;
  } catch (error) {
    console.error('Error updating payment status:', error);
    toast.error('Failed to update payment status');
    return false;
  }
};

export interface BookingPaymentSummary {
  bookingId: string;
  eventName: string;
  totalAmount: number;
  totalPaid: number;
  pendingAmount: number;
  payments: Payment[];
}

export interface PaymentSummary {
  totalReceived: number;
  totalPending: number;
  totalTransactions: number;
  recentPayments: Payment[];
  bookingSummaries: BookingPaymentSummary[];
}

export const getPaymentSummary = async (clientId: string): Promise<PaymentSummary> => {
  try {
    // Get all bookings for the client first
    const { data: bookings, error: bookingsError } = await supabase
      .from('bookings')
      .select('id, event_name, total_amount')
      .eq('client_id', clientId);

    if (bookingsError) throw bookingsError;
    if (!bookings?.length) {
      return {
        totalReceived: 0,
        totalPending: 0,
        totalTransactions: 0,
        recentPayments: [],
        bookingSummaries: []
      };
    }

    // Get all payments for these bookings with proper status mapping
    const bookingIds = bookings.map(b => b.id);
    const { data: payments, error } = await supabase
      .from('payments')
      .select('*')
      .in('booking_id', bookingIds)
      .order('created_at', { ascending: false });
    
    // Ensure all payments have the status field properly set
    const normalizedPayments = (payments || []).map(payment => ({
      ...payment,
      status: payment.status || 'completed', // Default to 'completed' if status is missing
      amount: Number(payment.amount) || 0,
      payment_date: payment.payment_date || payment.created_at
    }));

    if (error) throw error;

    // Process each booking to calculate payment summary
    const bookingSummaries: BookingPaymentSummary[] = bookings.map(booking => {
      const bookingPayments = normalizedPayments.filter(p => p.booking_id === booking.id);
      const completedPayments = bookingPayments.filter(p => p.status === 'completed');
      const pendingPayments = bookingPayments.filter(p => ['pending', 'failed'].includes(p.status));
      
      const totalPaid = completedPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
      const pendingAmount = pendingPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
      
      return {
        bookingId: booking.id,
        eventName: booking.event_name || 'Unnamed Event',
        totalAmount: booking.total_amount || 0,
        totalPaid,
        pendingAmount: Math.max(0, (booking.total_amount || 0) - totalPaid) + pendingAmount,
        payments: bookingPayments as unknown as Payment[]
      };
    });

    const allPayments = normalizedPayments.map(p => ({
      ...p,
      booking: bookings.find(b => b.id === p.booking_id) || null
    })) as unknown as Payment[];

    const receivedPayments = allPayments.filter(p => p.status === 'completed');
    const totalReceived = receivedPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
    const totalPending = bookingSummaries.reduce((sum, b) => sum + b.pendingAmount, 0);

    return {
      totalReceived,
      totalPending,
      totalTransactions: allPayments.length,
      recentPayments: receivedPayments
        .sort((a, b) => new Date(b.payment_date || b.created_at).getTime() - new Date(a.payment_date || a.created_at).getTime())
        .slice(0, 5),
      bookingSummaries
    };
  } catch (error) {
    console.error('Error fetching payment summary:', error);
    return {
      totalReceived: 0,
      totalPending: 0,
      totalTransactions: 0,
      recentPayments: [],
      bookingSummaries: []
    };
  }
};
