-- Create portfolio_items table to store portfolio metadata
CREATE TABLE public.portfolio_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vendor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entity_id UUID REFERENCES public.entities(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  price NUMERIC,
  image_url TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.portfolio_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Vendors can view own portfolio items"
ON public.portfolio_items FOR SELECT
USING (auth.uid() = vendor_id);

CREATE POLICY "Vendors can insert own portfolio items"
ON public.portfolio_items FOR INSERT
WITH CHECK (auth.uid() = vendor_id);

CREATE POLICY "Vendors can update own portfolio items"
ON public.portfolio_items FOR UPDATE
USING (auth.uid() = vendor_id);

CREATE POLICY "Vendors can delete own portfolio items"
ON public.portfolio_items FOR DELETE
USING (auth.uid() = vendor_id);

-- Public can view active portfolio items (for sharing)
CREATE POLICY "Anyone can view active portfolio items"
ON public.portfolio_items FOR SELECT
USING (is_active = true);

-- Add portfolio_item_id to bookings (optional alternative to package)
ALTER TABLE public.bookings 
ADD COLUMN portfolio_item_id UUID REFERENCES public.portfolio_items(id) ON DELETE SET NULL;

-- Make package_id nullable (already is, but ensure it)
ALTER TABLE public.bookings 
ALTER COLUMN package_id DROP NOT NULL;

-- Create trigger for updated_at
CREATE TRIGGER update_portfolio_items_updated_at
BEFORE UPDATE ON public.portfolio_items
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();