-- Allow anyone to view basic vendor info when viewing public portfolio items
CREATE POLICY "Public can view vendor info for active portfolio items"
ON public.profiles FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.portfolio_items
    WHERE portfolio_items.vendor_id = profiles.id
    AND portfolio_items.is_active = true
  )
);