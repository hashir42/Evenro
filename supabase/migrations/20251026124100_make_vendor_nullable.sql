-- Make vendor column nullable in expenses table
ALTER TABLE public.expenses ALTER COLUMN vendor DROP NOT NULL;

-- Update existing NULL values to an empty string if any exist
UPDATE public.expenses SET vendor = '' WHERE vendor IS NULL;
