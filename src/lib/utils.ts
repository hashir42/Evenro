import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Calculate the dynamic status of a booking based on booking state and event date
 * @param booking - The booking object with status and event_date
 * @param totalPaid - Total amount paid for the booking (deprecated, kept for compatibility)
 * @returns The derived status: 'cancelled' | 'completed' | 'confirmed'
 */
export function getDerivedBookingStatus(
  booking: { status: string; event_date: string; total_amount?: number },
  totalPaid?: number
): string {
  // If booking is cancelled, return cancelled
  if (booking?.status === 'cancelled') return 'cancelled';
  
  // Check if event_date exists
  if (!booking?.event_date) return 'confirmed';
  
  // Check if event date has passed
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const eventDate = new Date(booking.event_date);
  eventDate.setHours(0, 0, 0, 0);
  
  // If date has passed, it's completed
  if (eventDate < today) return 'completed';
  
  // If booking exists and date hasn't passed, it's confirmed
  return 'confirmed';
}
