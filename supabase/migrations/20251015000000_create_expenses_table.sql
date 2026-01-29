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

-- Enable Row Level Security
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

-- RLS Policies for expenses
CREATE POLICY "Vendors can view own expenses" ON public.expenses
  FOR SELECT USING (auth.uid() = vendor_id);

CREATE POLICY "Vendors can insert own expenses" ON public.expenses
  FOR INSERT WITH CHECK (auth.uid() = vendor_id);

CREATE POLICY "Vendors can update own expenses" ON public.expenses
  FOR UPDATE USING (auth.uid() = vendor_id);

CREATE POLICY "Vendors can delete own expenses" ON public.expenses
  FOR DELETE USING (auth.uid() = vendor_id);

-- Add index for better performance
CREATE INDEX idx_expenses_vendor_id ON public.expenses(vendor_id);
CREATE INDEX idx_expenses_date ON public.expenses(date);
