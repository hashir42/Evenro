-- Add booking_id to expenses table so each expense can be linked to a specific booking
ALTER TABLE public.expenses
ADD COLUMN IF NOT EXISTS booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL;

-- Add an index for faster lookups by booking
CREATE INDEX IF NOT EXISTS expenses_booking_id_idx ON public.expenses (booking_id);
