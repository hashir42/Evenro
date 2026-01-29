-- ============================================
-- COMBINED MIGRATION SCRIPT FOR NEW SUPABASE PROJECT
-- Run this entire script in your new Supabase SQL Editor
-- Project: eounpksresrouvfnchng
-- ============================================

-- ============================================
-- PART 1: Core Tables (profiles, clients, packages, bookings, payments)
-- ============================================

-- Create profiles table for vendor information
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  business_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  logo_url TEXT,
  category TEXT,
  subscription_tier TEXT DEFAULT 'free',
  subscription_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create clients table
CREATE TABLE public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  notes TEXT,
  stage TEXT DEFAULT 'lead' CHECK (stage IN ('lead', 'prospect', 'client')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create packages table
CREATE TABLE public.packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create bookings table
CREATE TABLE public.bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  package_id UUID REFERENCES public.packages(id) ON DELETE SET NULL,
  event_name TEXT NOT NULL,
  event_date DATE NOT NULL,
  event_time TIME,
  location TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled')),
  total_amount DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create payments table
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_method TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- PART 2: Helper Functions
-- ============================================

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Add updated_at triggers for base tables
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_packages_updated_at BEFORE UPDATE ON public.packages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_bookings_updated_at BEFORE UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- PART 3: Roles and Access Control
-- ============================================

-- Create enum for user roles
CREATE TYPE public.app_role AS ENUM ('admin', 'manager', 'staff', 'accountant');

-- Create user_roles table for role-based access control
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, role)
);

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

-- ============================================
-- PART 4: Entities and Inventory
-- ============================================

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
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
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
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add entity_id to packages and bookings
ALTER TABLE public.packages
ADD COLUMN entity_id UUID REFERENCES public.entities(id) ON DELETE SET NULL;

ALTER TABLE public.bookings
ADD COLUMN entity_id UUID REFERENCES public.entities(id) ON DELETE SET NULL;

-- Create triggers for entities and inventory
CREATE TRIGGER update_entities_updated_at
BEFORE UPDATE ON public.entities
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_inventory_updated_at
BEFORE UPDATE ON public.inventory
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- PART 5: Portfolio Module
-- ============================================

-- Create portfolio_items table
CREATE TABLE public.portfolio_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vendor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entity_id UUID REFERENCES public.entities(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  price NUMERIC,
  image_url TEXT NOT NULL,
  video_url TEXT,
  before_image_url TEXT,
  is_featured BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  view_count INTEGER DEFAULT 0,
  category TEXT,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add portfolio_item_id to bookings
ALTER TABLE public.bookings 
ADD COLUMN portfolio_item_id UUID REFERENCES public.portfolio_items(id) ON DELETE SET NULL;

-- Portfolio reviews/testimonials
CREATE TABLE public.portfolio_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_item_id UUID NOT NULL REFERENCES public.portfolio_items(id) ON DELETE CASCADE,
  client_name TEXT NOT NULL,
  client_email TEXT,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  review_text TEXT NOT NULL,
  is_approved BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Portfolio analytics
CREATE TABLE public.portfolio_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_item_id UUID NOT NULL REFERENCES public.portfolio_items(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  user_agent TEXT,
  referrer TEXT,
  ip_address INET,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create trigger for portfolio_items
CREATE TRIGGER update_portfolio_items_updated_at
BEFORE UPDATE ON public.portfolio_items
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- PART 6: Subscription Plans
-- ============================================

-- Create subscription plans table
CREATE TABLE public.subscription_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC NOT NULL DEFAULT 0,
  billing_cycle TEXT NOT NULL DEFAULT 'monthly',
  features JSONB,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Payment history
CREATE TABLE public.payment_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  currency TEXT DEFAULT 'INR',
  payment_method TEXT,
  payment_gateway TEXT DEFAULT 'razorpay',
  transaction_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  subscription_plan_id UUID REFERENCES public.subscription_plans(id),
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Subscription instances
CREATE TABLE public.user_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  subscription_plan_id UUID NOT NULL REFERENCES public.subscription_plans(id),
  status TEXT NOT NULL DEFAULT 'active',
  start_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  end_date TIMESTAMPTZ NOT NULL,
  auto_renew BOOLEAN DEFAULT true,
  razorpay_subscription_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Invoices
CREATE TABLE public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  invoice_number TEXT UNIQUE NOT NULL,
  subscription_plan_id UUID REFERENCES public.subscription_plans(id),
  amount NUMERIC NOT NULL,
  tax_amount NUMERIC DEFAULT 0,
  total_amount NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE NOT NULL,
  payment_history_id UUID REFERENCES public.payment_history(id),
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Subscription triggers
CREATE TRIGGER update_subscription_plans_updated_at
BEFORE UPDATE ON public.subscription_plans
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_subscriptions_updated_at
BEFORE UPDATE ON public.user_subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- PART 7: Documents Module
-- ============================================

-- Create documents table
CREATE TABLE public.documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vendor_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  file_url TEXT NOT NULL,
  file_type TEXT,
  file_size INTEGER,
  category TEXT,
  tags TEXT[],
  is_public BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Document folders
CREATE TABLE public.document_folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  parent_folder_id UUID REFERENCES public.document_folders(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add folder_id to documents
ALTER TABLE public.documents 
ADD COLUMN folder_id UUID REFERENCES public.document_folders(id) ON DELETE SET NULL;

-- Document versions
CREATE TABLE public.document_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  file_url TEXT NOT NULL,
  file_size INTEGER,
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Document sharing
CREATE TABLE public.document_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  share_token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  expires_at TIMESTAMPTZ,
  access_count INTEGER DEFAULT 0,
  max_access_count INTEGER,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Document triggers
CREATE TRIGGER update_documents_updated_at
BEFORE UPDATE ON public.documents
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_document_folders_updated_at
BEFORE UPDATE ON public.document_folders
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- PART 8: CRM Tables
-- ============================================

-- Create communication_logs table
CREATE TABLE public.communication_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  notes TEXT,
  date TIMESTAMPTZ DEFAULT NOW(),
  user_id UUID REFERENCES auth.users(id)
);

-- Create reminders table
CREATE TABLE public.reminders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  due_date TIMESTAMPTZ,
  is_completed BOOLEAN DEFAULT FALSE,
  user_id UUID REFERENCES auth.users(id)
);

-- ============================================
-- PART 9: Expenses Table
-- ============================================

-- Create expenses table
CREATE TABLE public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  category TEXT NOT NULL,
  description TEXT,
  amount DECIMAL(10,2) NOT NULL,
  vendor TEXT NOT NULL,
  payment_mode TEXT NOT NULL DEFAULT 'cash',
  receipt_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- PART 10: Storage Buckets
-- ============================================

-- Create storage bucket for portfolio images
INSERT INTO storage.buckets (id, name, public) 
VALUES ('portfolios', 'portfolios', true)
ON CONFLICT (id) DO NOTHING;

-- Create storage bucket for documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', false)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- PART 11: Enable Row Level Security
-- ============================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portfolio_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portfolio_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portfolio_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

-- ============================================
-- PART 12: RLS Policies - Profiles
-- ============================================

CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Public can view vendor info for active portfolio items"
ON public.profiles FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.portfolio_items
    WHERE portfolio_items.vendor_id = profiles.id
    AND portfolio_items.is_active = true
  )
);

-- ============================================
-- PART 13: RLS Policies - Clients
-- ============================================

CREATE POLICY "Vendors can view own clients" ON public.clients
  FOR SELECT USING (auth.uid() = vendor_id);

CREATE POLICY "Vendors can insert own clients" ON public.clients
  FOR INSERT WITH CHECK (auth.uid() = vendor_id);

CREATE POLICY "Vendors can update own clients" ON public.clients
  FOR UPDATE USING (auth.uid() = vendor_id);

CREATE POLICY "Vendors can delete own clients" ON public.clients
  FOR DELETE USING (auth.uid() = vendor_id);

-- ============================================
-- PART 14: RLS Policies - Packages
-- ============================================

CREATE POLICY "Vendors can view own packages" ON public.packages
  FOR SELECT USING (auth.uid() = vendor_id);

CREATE POLICY "Vendors can insert own packages" ON public.packages
  FOR INSERT WITH CHECK (auth.uid() = vendor_id);

CREATE POLICY "Vendors can update own packages" ON public.packages
  FOR UPDATE USING (auth.uid() = vendor_id);

CREATE POLICY "Vendors can delete own packages" ON public.packages
  FOR DELETE USING (auth.uid() = vendor_id);

-- ============================================
-- PART 15: RLS Policies - Bookings
-- ============================================

CREATE POLICY "Vendors can view own bookings" ON public.bookings
  FOR SELECT USING (auth.uid() = vendor_id);

CREATE POLICY "Vendors can insert own bookings" ON public.bookings
  FOR INSERT WITH CHECK (auth.uid() = vendor_id);

CREATE POLICY "Vendors can update own bookings" ON public.bookings
  FOR UPDATE USING (auth.uid() = vendor_id);

CREATE POLICY "Vendors can delete own bookings" ON public.bookings
  FOR DELETE USING (auth.uid() = vendor_id);

-- ============================================
-- PART 16: RLS Policies - Payments
-- ============================================

CREATE POLICY "Vendors can view own payments" ON public.payments
  FOR SELECT USING (auth.uid() = vendor_id);

CREATE POLICY "Vendors can insert own payments" ON public.payments
  FOR INSERT WITH CHECK (auth.uid() = vendor_id);

CREATE POLICY "Vendors can update own payments" ON public.payments
  FOR UPDATE USING (auth.uid() = vendor_id);

CREATE POLICY "Vendors can delete own payments" ON public.payments
  FOR DELETE USING (auth.uid() = vendor_id);

-- ============================================
-- PART 17: RLS Policies - User Roles
-- ============================================

CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all roles"
ON public.user_roles
FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- ============================================
-- PART 18: RLS Policies - Entities
-- ============================================

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

-- ============================================
-- PART 19: RLS Policies - Inventory
-- ============================================

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

-- ============================================
-- PART 20: RLS Policies - Portfolio
-- ============================================

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

CREATE POLICY "Anyone can view active portfolio items"
ON public.portfolio_items FOR SELECT
USING (is_active = true);

CREATE POLICY "Anyone can view approved reviews"
ON public.portfolio_reviews
FOR SELECT
USING (is_approved = true);

CREATE POLICY "Vendors can manage reviews for their items"
ON public.portfolio_reviews
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.portfolio_items 
    WHERE portfolio_items.id = portfolio_reviews.portfolio_item_id 
    AND portfolio_items.vendor_id = auth.uid()
  )
);

CREATE POLICY "Vendors can view analytics for their items"
ON public.portfolio_analytics
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.portfolio_items 
    WHERE portfolio_items.id = portfolio_analytics.portfolio_item_id 
    AND portfolio_items.vendor_id = auth.uid()
  )
);

CREATE POLICY "Anyone can insert analytics"
ON public.portfolio_analytics
FOR INSERT
WITH CHECK (true);

-- ============================================
-- PART 21: RLS Policies - Subscriptions
-- ============================================

CREATE POLICY "Anyone can view active subscription plans"
ON public.subscription_plans
FOR SELECT
USING (is_active = true);

CREATE POLICY "Admins can manage subscription plans"
ON public.subscription_plans
FOR ALL
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view own payment history"
ON public.payment_history
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can view own subscriptions"
ON public.user_subscriptions
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can view own invoices"
ON public.invoices
FOR SELECT
USING (auth.uid() = user_id);

-- ============================================
-- PART 22: RLS Policies - Documents
-- ============================================

CREATE POLICY "Vendors can view own documents"
ON public.documents
FOR SELECT
USING (auth.uid() = vendor_id OR is_public = true);

CREATE POLICY "Vendors can insert own documents"
ON public.documents
FOR INSERT
WITH CHECK (auth.uid() = vendor_id);

CREATE POLICY "Vendors can update own documents"
ON public.documents
FOR UPDATE
USING (auth.uid() = vendor_id);

CREATE POLICY "Vendors can delete own documents"
ON public.documents
FOR DELETE
USING (auth.uid() = vendor_id);

CREATE POLICY "Vendors can manage own folders"
ON public.document_folders
FOR ALL
USING (auth.uid() = vendor_id);

CREATE POLICY "Vendors can view document versions"
ON public.document_versions
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.documents 
    WHERE documents.id = document_versions.document_id 
    AND documents.vendor_id = auth.uid()
  )
);

CREATE POLICY "Vendors can manage document shares"
ON public.document_shares
FOR ALL
USING (auth.uid() = created_by);

CREATE POLICY "Public can access valid shares"
ON public.document_shares
FOR SELECT
USING (
  (expires_at IS NULL OR expires_at > now()) AND
  (max_access_count IS NULL OR access_count < max_access_count)
);

-- ============================================
-- PART 23: RLS Policies - Expenses
-- ============================================

CREATE POLICY "Vendors can view own expenses" ON public.expenses
  FOR SELECT USING (auth.uid() = vendor_id);

CREATE POLICY "Vendors can insert own expenses" ON public.expenses
  FOR INSERT WITH CHECK (auth.uid() = vendor_id);

CREATE POLICY "Vendors can update own expenses" ON public.expenses
  FOR UPDATE USING (auth.uid() = vendor_id);

CREATE POLICY "Vendors can delete own expenses" ON public.expenses
  FOR DELETE USING (auth.uid() = vendor_id);

-- ============================================
-- PART 24: Storage Policies
-- ============================================

-- Portfolio storage policies
CREATE POLICY "Anyone can view portfolio images"
ON storage.objects FOR SELECT
USING (bucket_id = 'portfolios');

CREATE POLICY "Vendors can upload their portfolio images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'portfolios' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Vendors can update their portfolio images"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'portfolios' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Vendors can delete their portfolio images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'portfolios' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Document storage policies
CREATE POLICY "Users can view their own documents"
ON storage.objects
FOR SELECT
USING (bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can upload their own documents"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own documents"
ON storage.objects
FOR UPDATE
USING (bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own documents"
ON storage.objects
FOR DELETE
USING (bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]);

-- ============================================
-- PART 25: Auth Trigger Function
-- ============================================

-- Create function to handle profile creation on signup
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

-- Trigger to create profile on user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- PART 26: Performance Indexes
-- ============================================

CREATE INDEX IF NOT EXISTS idx_clients_stage ON public.clients(stage);
CREATE INDEX IF NOT EXISTS idx_document_versions_document_id ON public.document_versions(document_id);
CREATE INDEX IF NOT EXISTS idx_document_shares_token ON public.document_shares(share_token);
CREATE INDEX IF NOT EXISTS idx_portfolio_analytics_item_id ON public.portfolio_analytics(portfolio_item_id);
CREATE INDEX IF NOT EXISTS idx_portfolio_reviews_item_id ON public.portfolio_reviews(portfolio_item_id);
CREATE INDEX IF NOT EXISTS idx_payment_history_user_id ON public.payment_history(user_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id ON public.user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_user_id ON public.invoices(user_id);
CREATE INDEX IF NOT EXISTS idx_expenses_vendor_id ON public.expenses(vendor_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON public.expenses(date);

-- ============================================
-- MIGRATION COMPLETE
-- ============================================
