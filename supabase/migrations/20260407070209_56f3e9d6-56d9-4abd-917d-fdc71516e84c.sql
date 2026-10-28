-- Add sync tracking columns to pplp_actions
ALTER TABLE public.pplp_actions 
ADD COLUMN IF NOT EXISTS synced_to_fun_rich boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS synced_at timestamptz DEFAULT null;

-- Index for fast lookup of unsynced scored actions
CREATE INDEX IF NOT EXISTS idx_pplp_actions_unsynced 
ON public.pplp_actions (actor_id, synced_to_fun_rich) 
WHERE synced_to_fun_rich = false AND status = 'scored';