-- ============================================
-- ENHANCE ENTITIES/VENUES MODULE
-- Add staff assignment, custom pricing, tax rules, and location coordinates
-- ============================================

-- Add location coordinates and custom rules to entities table
ALTER TABLE public.entities
ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 8),
ADD COLUMN IF NOT EXISTS longitude DECIMAL(11, 8),
ADD COLUMN IF NOT EXISTS custom_tax_rate DECIMAL(5, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS custom_pricing_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS base_price DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS availability_status TEXT DEFAULT 'available' CHECK (availability_status IN ('available', 'busy', 'maintenance'));

-- Create entity_staff table for staff assignment per branch
CREATE TABLE IF NOT EXISTS public.entity_staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES public.entities(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL, -- e.g., 'manager', 'staff', 'coordinator'
  assigned_date TIMESTAMPTZ DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(entity_id, user_id)
);

-- Create entity_pricing_rules table for custom pricing per branch
CREATE TABLE IF NOT EXISTS public.entity_pricing_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES public.entities(id) ON DELETE CASCADE,
  rule_name TEXT NOT NULL,
  rule_type TEXT NOT NULL, -- 'weekday', 'weekend', 'peak_season', 'off_peak', 'custom'
  price_modifier DECIMAL(10, 2) NOT NULL, -- Can be percentage or fixed amount
  modifier_type TEXT NOT NULL DEFAULT 'percentage' CHECK (modifier_type IN ('percentage', 'fixed')),
  start_date DATE,
  end_date DATE,
  days_of_week INTEGER[], -- 0=Sunday, 1=Monday, etc.
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create entity_availability table for real-time availability tracking
CREATE TABLE IF NOT EXISTS public.entity_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES public.entities(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  time_slot_start TIME,
  time_slot_end TIME,
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'booked', 'blocked', 'maintenance')),
  booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(entity_id, date, time_slot_start)
);

-- Enable RLS
ALTER TABLE public.entity_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entity_pricing_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entity_availability ENABLE ROW LEVEL SECURITY;

-- RLS Policies for entity_staff
CREATE POLICY "Vendors can view staff for their entities"
ON public.entity_staff
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.entities 
    WHERE entities.id = entity_staff.entity_id 
    AND entities.vendor_id = auth.uid()
  )
);

CREATE POLICY "Vendors can manage staff for their entities"
ON public.entity_staff
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.entities 
    WHERE entities.id = entity_staff.entity_id 
    AND entities.vendor_id = auth.uid()
  )
);

-- RLS Policies for entity_pricing_rules
CREATE POLICY "Vendors can view pricing rules for their entities"
ON public.entity_pricing_rules
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.entities 
    WHERE entities.id = entity_pricing_rules.entity_id 
    AND entities.vendor_id = auth.uid()
  )
);

CREATE POLICY "Vendors can manage pricing rules for their entities"
ON public.entity_pricing_rules
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.entities 
    WHERE entities.id = entity_pricing_rules.entity_id 
    AND entities.vendor_id = auth.uid()
  )
);

-- RLS Policies for entity_availability
CREATE POLICY "Vendors can view availability for their entities"
ON public.entity_availability
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.entities 
    WHERE entities.id = entity_availability.entity_id 
    AND entities.vendor_id = auth.uid()
  )
);

CREATE POLICY "Vendors can manage availability for their entities"
ON public.entity_availability
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.entities 
    WHERE entities.id = entity_availability.entity_id 
    AND entities.vendor_id = auth.uid()
  )
);

-- Create function to update availability when booking is created/updated
CREATE OR REPLACE FUNCTION public.update_entity_availability()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Mark entity as booked for the booking date/time
  IF NEW.entity_id IS NOT NULL AND NEW.status IN ('confirmed', 'pending') THEN
    INSERT INTO public.entity_availability (entity_id, date, time_slot_start, time_slot_end, status, booking_id)
    VALUES (
      NEW.entity_id,
      NEW.event_date,
      NEW.event_time,
      (NEW.event_time::TIME + INTERVAL '4 hours')::TIME, -- Default 4-hour slot
      'booked',
      NEW.id
    )
    ON CONFLICT (entity_id, date, time_slot_start)
    DO UPDATE SET status = 'booked', booking_id = NEW.id;
  END IF;

  -- Free up slot if booking is cancelled
  IF TG_OP = 'UPDATE' AND NEW.status = 'cancelled' AND OLD.status != 'cancelled' THEN
    DELETE FROM public.entity_availability 
    WHERE booking_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger for automatic availability updates
DROP TRIGGER IF EXISTS trigger_update_entity_availability ON public.bookings;
CREATE TRIGGER trigger_update_entity_availability
  AFTER INSERT OR UPDATE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_entity_availability();

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_entity_staff_entity_id ON public.entity_staff(entity_id);
CREATE INDEX IF NOT EXISTS idx_entity_staff_user_id ON public.entity_staff(user_id);
CREATE INDEX IF NOT EXISTS idx_entity_pricing_rules_entity_id ON public.entity_pricing_rules(entity_id);
CREATE INDEX IF NOT EXISTS idx_entity_availability_entity_id ON public.entity_availability(entity_id);
CREATE INDEX IF NOT EXISTS idx_entity_availability_date ON public.entity_availability(date);
CREATE INDEX IF NOT EXISTS idx_entities_coordinates ON public.entities(latitude, longitude);

-- Add triggers for updated_at
CREATE TRIGGER update_entity_pricing_rules_updated_at
  BEFORE UPDATE ON public.entity_pricing_rules
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_entity_availability_updated_at
  BEFORE UPDATE ON public.entity_availability
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add comments
COMMENT ON COLUMN public.entities.latitude IS 'Latitude for Google Maps integration';
COMMENT ON COLUMN public.entities.longitude IS 'Longitude for Google Maps integration';
COMMENT ON COLUMN public.entities.custom_tax_rate IS 'Custom tax rate percentage for this entity';
COMMENT ON COLUMN public.entities.custom_pricing_enabled IS 'Enable custom pricing rules for this entity';
COMMENT ON COLUMN public.entities.base_price IS 'Base price for this venue/branch';
COMMENT ON COLUMN public.entities.availability_status IS 'Real-time availability status';
COMMENT ON TABLE public.entity_staff IS 'Staff assignment per entity/branch';
COMMENT ON TABLE public.entity_pricing_rules IS 'Custom pricing rules per entity';
COMMENT ON TABLE public.entity_availability IS 'Real-time availability calendar for entities';
