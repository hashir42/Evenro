-- Add is_active column to packages table
ALTER TABLE public.packages 
ADD COLUMN is_active BOOLEAN DEFAULT TRUE;

-- Create index for better performance on active packages
CREATE INDEX idx_packages_is_active ON public.packages(is_active);

-- Update RLS policies if needed
COMMENT ON COLUMN public.packages.is_active IS 'Indicates if the package is active and available for selection';

-- Update existing packages to be active by default
UPDATE public.packages SET is_active = TRUE WHERE is_active IS NULL;
