-- Create enum for user roles
CREATE TYPE public.app_role AS ENUM ('admin', 'manager', 'staff', 'accountant');

-- Create user_roles table for role-based access control
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Create function to get user's vendor_id
CREATE OR REPLACE FUNCTION public.get_user_vendor_id(_user_id UUID)
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.profiles WHERE id = _user_id
$$;

-- RLS policies for user_roles
CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all roles for their vendor"
ON public.user_roles
FOR ALL
USING (
  public.has_role(auth.uid(), 'admin')
  AND user_id IN (
    SELECT id FROM public.profiles 
    WHERE id = (SELECT id FROM public.profiles WHERE id = auth.uid())
  )
);

-- Create entities/branches table
CREATE TABLE public.entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  category TEXT,
  location TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  contact_person TEXT,
  phone TEXT,
  email TEXT,
  capacity INTEGER,
  description TEXT,
  amenities TEXT[],
  operating_hours JSONB,
  is_active BOOLEAN DEFAULT true,
  portfolio_images TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on entities
ALTER TABLE public.entities ENABLE ROW LEVEL SECURITY;

-- RLS policies for entities
CREATE POLICY "Vendors can view own entities"
ON public.entities
FOR SELECT
USING (auth.uid() = vendor_id);

CREATE POLICY "Admins and managers can insert entities"
ON public.entities
FOR INSERT
WITH CHECK (
  auth.uid() = vendor_id AND
  (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
);

CREATE POLICY "Admins and managers can update entities"
ON public.entities
FOR UPDATE
USING (
  auth.uid() = vendor_id AND
  (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
);

CREATE POLICY "Admins can delete entities"
ON public.entities
FOR DELETE
USING (
  auth.uid() = vendor_id AND
  public.has_role(auth.uid(), 'admin')
);

-- Create inventory table for venues
CREATE TABLE public.inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID REFERENCES public.entities(id) ON DELETE CASCADE NOT NULL,
  vendor_id UUID NOT NULL,
  item_name TEXT NOT NULL,
  category TEXT,
  quantity_total INTEGER NOT NULL DEFAULT 0,
  quantity_available INTEGER NOT NULL DEFAULT 0,
  unit TEXT,
  purchase_date DATE,
  purchase_price NUMERIC(10, 2),
  condition TEXT,
  maintenance_status TEXT DEFAULT 'good',
  last_maintenance_date DATE,
  next_maintenance_date DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on inventory
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;

-- RLS policies for inventory
CREATE POLICY "Vendors can view own inventory"
ON public.inventory
FOR SELECT
USING (auth.uid() = vendor_id);

CREATE POLICY "Staff and above can manage inventory"
ON public.inventory
FOR ALL
USING (
  auth.uid() = vendor_id AND
  (public.has_role(auth.uid(), 'admin') OR 
   public.has_role(auth.uid(), 'manager') OR 
   public.has_role(auth.uid(), 'staff'))
);

-- Add entity_id to packages table
ALTER TABLE public.packages
ADD COLUMN entity_id UUID REFERENCES public.entities(id) ON DELETE SET NULL;

-- Add entity_id to bookings table if not exists
ALTER TABLE public.bookings
ADD COLUMN IF NOT EXISTS entity_id UUID REFERENCES public.entities(id) ON DELETE SET NULL;

-- Add category to profiles for vendor business type
ALTER TABLE public.profiles
ADD COLUMN category TEXT,
ADD COLUMN subscription_tier TEXT DEFAULT 'free',
ADD COLUMN subscription_expires_at TIMESTAMP WITH TIME ZONE;

-- Create trigger for entities updated_at
CREATE TRIGGER update_entities_updated_at
BEFORE UPDATE ON public.entities
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create trigger for inventory updated_at
CREATE TRIGGER update_inventory_updated_at
BEFORE UPDATE ON public.inventory
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Update handle_new_user to create default admin role
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  -- Insert profile
  INSERT INTO public.profiles (id, business_name, email, phone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'business_name', 'My Business'),
    NEW.email,
    NEW.raw_user_meta_data->>'phone'
  );
  
  -- Insert admin role for new user
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'admin');
  
  RETURN NEW;
END;
$function$;