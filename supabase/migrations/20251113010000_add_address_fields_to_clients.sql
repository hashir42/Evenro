-- Add address fields to clients table
ALTER TABLE public.clients
ADD COLUMN IF NOT EXISTS full_address TEXT,
ADD COLUMN IF NOT EXISTS city TEXT,
ADD COLUMN IF NOT EXISTS pincode TEXT,
ADD COLUMN IF NOT EXISTS landmark TEXT,
ADD COLUMN IF NOT EXISTS google_maps_link TEXT;

-- Add comments for the new columns
COMMENT ON COLUMN public.clients.full_address IS 'Full address of the client';
COMMENT ON COLUMN public.clients.city IS 'City of the client';
COMMENT ON COLUMN public.clients.pincode IS 'Pincode of the client\'s location';
COMMENT ON COLUMN public.clients.landmark IS 'Landmark near the client\'s location';
COMMENT ON COLUMN public.clients.google_maps_link IS 'Google Maps link to the client\'s location';

-- Update RLS policies to include the new columns
DROP POLICY IF EXISTS "Vendors can view own clients" ON public.clients;
CREATE POLICY "Vendors can view own clients" ON public.clients
  FOR SELECT USING (auth.uid() = vendor_id);

DROP POLICY IF EXISTS "Vendors can insert own clients" ON public.clients;
CREATE POLICY "Vendors can insert own clients" ON public.clients
  FOR INSERT WITH CHECK (auth.uid() = vendor_id);

DROP POLICY IF EXISTS "Vendors can update own clients" ON public.clients;
CREATE POLICY "Vendors can update own clients" ON public.clients
  FOR UPDATE USING (auth.uid() = vendor_id);
