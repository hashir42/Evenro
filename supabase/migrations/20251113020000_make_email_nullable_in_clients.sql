-- Make email column nullable in clients table
ALTER TABLE public.clients 
ALTER COLUMN email DROP NOT NULL;

-- Update RLS policies to handle null emails
DROP POLICY IF EXISTS "Vendors can view own clients" ON public.clients;
CREATE POLICY "Vendors can view own clients" ON public.clients
  FOR SELECT USING (auth.uid() = vendor_id);

DROP POLICY IF EXISTS "Vendors can insert own clients" ON public.clients;
CREATE POLICY "Vendors can insert own clients" ON public.clients
  FOR INSERT WITH CHECK (auth.uid() = vendor_id);

DROP POLICY IF EXISTS "Vendors can update own clients" ON public.clients;
CREATE POLICY "Vendors can update own clients" ON public.clients
  FOR UPDATE USING (auth.uid() = vendor_id);
