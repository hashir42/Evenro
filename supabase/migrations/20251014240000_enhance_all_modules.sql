-- ============================================
-- COMPREHENSIVE MODULE ENHANCEMENTS
-- Payments, Invoices, Documents, Reports, Settings
-- ============================================

-- ============================================
-- PAYMENTS ENHANCEMENTS
-- ============================================

-- Add payment gateway fields to payments table
ALTER TABLE public.payments
ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'cash' CHECK (payment_method IN ('cash', 'card', 'upi', 'razorpay', 'stripe', 'bank_transfer')),
ADD COLUMN IF NOT EXISTS payment_gateway TEXT,
ADD COLUMN IF NOT EXISTS gateway_transaction_id TEXT,
ADD COLUMN IF NOT EXISTS gateway_payment_id TEXT,
ADD COLUMN IF NOT EXISTS payment_type TEXT DEFAULT 'full' CHECK (payment_type IN ('full', 'partial', 'advance', 'refund')),
ADD COLUMN IF NOT EXISTS refund_amount DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS settlement_status TEXT DEFAULT 'pending' CHECK (settlement_status IN ('pending', 'processing', 'settled', 'failed')),
ADD COLUMN IF NOT EXISTS settlement_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS settlement_reference TEXT,
ADD COLUMN IF NOT EXISTS gateway_fee DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS net_amount DECIMAL(10, 2);

-- Create payment_settlements table
CREATE TABLE IF NOT EXISTS public.payment_settlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  payment_id UUID REFERENCES public.payments(id) ON DELETE SET NULL,
  settlement_amount DECIMAL(10, 2) NOT NULL,
  gateway TEXT NOT NULL,
  settlement_date TIMESTAMPTZ NOT NULL,
  settlement_reference TEXT,
  status TEXT DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INVOICES ENHANCEMENTS
-- ============================================

-- Enhance invoices table
ALTER TABLE public.invoices
ADD COLUMN IF NOT EXISTS invoice_template TEXT DEFAULT 'default',
ADD COLUMN IF NOT EXISTS brand_logo_url TEXT,
ADD COLUMN IF NOT EXISTS brand_color TEXT DEFAULT '#000000',
ADD COLUMN IF NOT EXISTS pdf_url TEXT,
ADD COLUMN IF NOT EXISTS shared_via_whatsapp BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS auto_generated BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS gst_number TEXT,
ADD COLUMN IF NOT EXISTS tax_rate DECIMAL(5, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS tax_amount DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS subtotal DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS discount_amount DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS terms_and_conditions TEXT;

-- Create invoice_items table for line items
CREATE TABLE IF NOT EXISTS public.invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity INTEGER DEFAULT 1,
  unit_price DECIMAL(10, 2) NOT NULL,
  total_price DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- DOCUMENTS ENHANCEMENTS (Already exists but add more fields)
-- ============================================

ALTER TABLE public.documents
ADD COLUMN IF NOT EXISTS preview_url TEXT,
ADD COLUMN IF NOT EXISTS thumbnail_url TEXT,
ADD COLUMN IF NOT EXISTS is_contract BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS signature_status TEXT CHECK (signature_status IN ('pending', 'signed', 'declined')),
ADD COLUMN IF NOT EXISTS signed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS signed_by UUID REFERENCES auth.users(id);

ALTER TABLE public.document_shares
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS password_protected BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS password_hash TEXT,
ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_viewed_at TIMESTAMPTZ;

-- ============================================
-- REPORTS & ANALYTICS
-- ============================================

-- Create analytics_cache table for pre-computed reports
CREATE TABLE IF NOT EXISTS public.analytics_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  report_type TEXT NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(vendor_id, report_type, period_start, period_end)
);

-- ============================================
-- SETTINGS ENHANCEMENTS
-- ============================================

-- Add branding and settings to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS brand_color TEXT DEFAULT '#6366f1',
ADD COLUMN IF NOT EXISTS theme_mode TEXT DEFAULT 'light' CHECK (theme_mode IN ('light', 'dark', 'auto')),
ADD COLUMN IF NOT EXISTS notification_preferences JSONB DEFAULT '{"email": true, "sms": false, "whatsapp": true, "push": true}'::jsonb,
ADD COLUMN IF NOT EXISTS business_address TEXT,
ADD COLUMN IF NOT EXISTS business_gst TEXT,
ADD COLUMN IF NOT EXISTS business_pan TEXT,
ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'INR',
ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'Asia/Kolkata';

-- Create staff_roles table for role-based access
CREATE TABLE IF NOT EXISTS public.staff_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  staff_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'manager', 'staff', 'accountant', 'viewer')),
  permissions JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(vendor_id, staff_user_id)
);

-- Create notification_logs table
CREATE TABLE IF NOT EXISTS public.notification_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('email', 'sms', 'whatsapp', 'push', 'in_app')),
  subject TEXT,
  message TEXT NOT NULL,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT DEFAULT 'sent' CHECK (status IN ('pending', 'sent', 'failed', 'read')),
  metadata JSONB
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

CREATE INDEX IF NOT EXISTS idx_payments_gateway_transaction ON public.payments(gateway_transaction_id);
CREATE INDEX IF NOT EXISTS idx_payments_settlement_status ON public.payments(settlement_status);
CREATE INDEX IF NOT EXISTS idx_payment_settlements_vendor ON public.payment_settlements(vendor_id);
CREATE INDEX IF NOT EXISTS idx_payment_settlements_date ON public.payment_settlements(settlement_date);
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON public.invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_analytics_cache_vendor ON public.analytics_cache(vendor_id, report_type);
CREATE INDEX IF NOT EXISTS idx_staff_roles_vendor ON public.staff_roles(vendor_id);
CREATE INDEX IF NOT EXISTS idx_notification_logs_user ON public.notification_logs(user_id, sent_at);

-- ============================================
-- RLS POLICIES
-- ============================================

-- Payment Settlements
ALTER TABLE public.payment_settlements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Vendors can view own settlements"
ON public.payment_settlements FOR SELECT
USING (auth.uid() = vendor_id);

CREATE POLICY "Vendors can manage own settlements"
ON public.payment_settlements FOR ALL
USING (auth.uid() = vendor_id);

-- Invoice Items
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view invoice items for their invoices"
ON public.invoice_items FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.invoices 
    WHERE invoices.id = invoice_items.invoice_id 
    AND invoices.user_id = auth.uid()
  )
);

CREATE POLICY "Users can manage invoice items for their invoices"
ON public.invoice_items FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.invoices 
    WHERE invoices.id = invoice_items.invoice_id 
    AND invoices.user_id = auth.uid()
  )
);

-- Analytics Cache
ALTER TABLE public.analytics_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Vendors can view own analytics"
ON public.analytics_cache FOR SELECT
USING (auth.uid() = vendor_id);

CREATE POLICY "Vendors can manage own analytics"
ON public.analytics_cache FOR ALL
USING (auth.uid() = vendor_id);

-- Staff Roles
ALTER TABLE public.staff_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Vendors can view staff roles"
ON public.staff_roles FOR SELECT
USING (auth.uid() = vendor_id OR auth.uid() = staff_user_id);

CREATE POLICY "Vendors can manage staff roles"
ON public.staff_roles FOR ALL
USING (auth.uid() = vendor_id);

-- Notification Logs
ALTER TABLE public.notification_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications"
ON public.notification_logs FOR SELECT
USING (auth.uid() = user_id);

-- ============================================
-- TRIGGERS
-- ============================================

-- Trigger for updated_at
CREATE TRIGGER update_payment_settlements_updated_at
  BEFORE UPDATE ON public.payment_settlements
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_staff_roles_updated_at
  BEFORE UPDATE ON public.staff_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-generate invoice when booking is confirmed
CREATE OR REPLACE FUNCTION public.auto_generate_invoice()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only generate invoice when status changes to 'confirmed'
  IF NEW.status = 'confirmed' AND (OLD.status IS NULL OR OLD.status != 'confirmed') THEN
    INSERT INTO public.invoices (
      user_id,
      booking_id,
      invoice_number,
      amount,
      due_date,
      status,
      auto_generated
    ) VALUES (
      NEW.vendor_id,
      NEW.id,
      'INV-' || to_char(NOW(), 'YYYYMMDD') || '-' || substring(NEW.id::text, 1, 8),
      NEW.total_amount,
      NEW.event_date,
      'pending',
      true
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_auto_generate_invoice ON public.bookings;
CREATE TRIGGER trigger_auto_generate_invoice
  AFTER INSERT OR UPDATE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_generate_invoice();

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE public.payment_settlements IS 'Track payment settlements from gateways';
COMMENT ON TABLE public.invoice_items IS 'Line items for invoices';
COMMENT ON TABLE public.analytics_cache IS 'Pre-computed analytics for faster reporting';
COMMENT ON TABLE public.staff_roles IS 'Role-based access control for staff members';
COMMENT ON TABLE public.notification_logs IS 'Track all notifications sent to users';

COMMENT ON COLUMN public.payments.payment_method IS 'Payment method: cash, card, upi, razorpay, stripe';
COMMENT ON COLUMN public.payments.settlement_status IS 'Gateway settlement status';
COMMENT ON COLUMN public.invoices.auto_generated IS 'Whether invoice was auto-generated from booking';
COMMENT ON COLUMN public.profiles.notification_preferences IS 'JSON object with notification channel preferences';
