-- Add stage column to clients table for Lead → Client pipeline
ALTER TABLE public.clients
ADD COLUMN IF NOT EXISTS stage TEXT DEFAULT 'lead' CHECK (stage IN ('lead', 'prospect', 'client'));

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_clients_stage ON public.clients(stage);

-- Add comment
COMMENT ON COLUMN public.clients.stage IS 'Client stage in sales pipeline: lead, prospect, or client';
