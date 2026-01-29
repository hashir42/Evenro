-- Add whatsapp_number column to clients table
ALTER TABLE public.clients
ADD COLUMN IF NOT EXISTS whatsapp_number TEXT;

-- Add comment
COMMENT ON COLUMN public.clients.whatsapp_number IS 'WhatsApp number for the client';

-- Update RLS policies to include whatsapp_number
DROP POLICY IF EXISTS "Vendors can view own clients" ON public.clients;
CREATE POLICY "Vendors can view own clients" ON public.clients
  FOR SELECT USING (auth.uid() = vendor_id);

DROP POLICY IF EXISTS "Vendors can insert own clients" ON public.clients;
CREATE POLICY "Vendors can insert own clients" ON public.clients
  FOR INSERT WITH CHECK (auth.uid() = vendor_id);

DROP POLICY IF EXISTS "Vendors can update own clients" ON public.clients;
CREATE POLICY "Vendors can update own clients" ON public.clients
  FOR UPDATE USING (auth.uid() = vendor_id);
