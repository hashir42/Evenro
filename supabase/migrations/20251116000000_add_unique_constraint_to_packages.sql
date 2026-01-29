-- Create a case-sensitive unique index to ensure package names are unique per vendor
CREATE UNIQUE INDEX idx_unique_package_name_per_vendor 
ON public.packages (lower(name), vendor_id);

-- Add a comment to document the constraint
COMMENT ON INDEX public.idx_unique_package_name_per_vendor 
IS 'Ensures case-sensitive unique package names per vendor';
