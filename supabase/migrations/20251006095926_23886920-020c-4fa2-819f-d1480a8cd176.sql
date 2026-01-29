-- Create enum for user roles (if not exists)
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'manager', 'staff', 'accountant');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create user_roles table for role-based access control
CREATE TABLE IF NOT EXISTS public.user_roles (
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

-- RLS policies for user_roles (drop if exists first)
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can manage all roles for their vendor" ON public.user_roles;
CREATE POLICY "Admins can manage all roles for their vendor"
ON public.user_roles
FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- Create entities/branches table
CREATE TABLE IF NOT EXISTS public.entities (
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
DROP POLICY IF EXISTS "Vendors can view own entities" ON public.entities;
CREATE POLICY "Vendors can view own entities"
ON public.entities
FOR SELECT
USING (auth.uid() = vendor_id);

DROP POLICY IF EXISTS "Admins and managers can insert entities" ON public.entities;
CREATE POLICY "Admins and managers can insert entities"
ON public.entities
FOR INSERT
WITH CHECK (
  auth.uid() = vendor_id AND
  (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
);

DROP POLICY IF EXISTS "Admins and managers can update entities" ON public.entities;
CREATE POLICY "Admins and managers can update entities"
ON public.entities
FOR UPDATE
USING (
  auth.uid() = vendor_id AND
  (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
);

DROP POLICY IF EXISTS "Admins can delete entities" ON public.entities;
CREATE POLICY "Admins can delete entities"
ON public.entities
FOR DELETE
USING (
  auth.uid() = vendor_id AND
  public.has_role(auth.uid(), 'admin')
);

-- Create inventory table for venues
CREATE TABLE IF NOT EXISTS public.inventory (
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
DROP POLICY IF EXISTS "Vendors can view own inventory" ON public.inventory;
CREATE POLICY "Vendors can view own inventory"
ON public.inventory
FOR SELECT
USING (auth.uid() = vendor_id);

DROP POLICY IF EXISTS "Staff and above can manage inventory" ON public.inventory;
CREATE POLICY "Staff and above can manage inventory"
ON public.inventory
FOR ALL
USING (
  auth.uid() = vendor_id AND
  (public.has_role(auth.uid(), 'admin') OR 
   public.has_role(auth.uid(), 'manager') OR 
   public.has_role(auth.uid(), 'staff'))
);

-- Add entity_id to packages table if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='packages' AND column_name='entity_id') THEN
    ALTER TABLE public.packages
    ADD COLUMN entity_id UUID REFERENCES public.entities(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add category and subscription to profiles
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='profiles' AND column_name='category') THEN
    ALTER TABLE public.profiles
    ADD COLUMN category TEXT,
    ADD COLUMN subscription_tier TEXT DEFAULT 'free',
    ADD COLUMN subscription_expires_at TIMESTAMP WITH TIME ZONE;
  END IF;
END $$;

-- Create trigger for entities updated_at
DROP TRIGGER IF EXISTS update_entities_updated_at ON public.entities;
CREATE TRIGGER update_entities_updated_at
BEFORE UPDATE ON public.entities
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create trigger for inventory updated_at
DROP TRIGGER IF EXISTS update_inventory_updated_at ON public.inventory;
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
  VALUES (NEW.id, 'admin')
  ON CONFLICT (user_id, role) DO NOTHING;
  
  RETURN NEW;
END;
$function$;