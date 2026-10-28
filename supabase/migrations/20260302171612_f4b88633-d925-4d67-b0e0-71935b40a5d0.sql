
-- Create table for linking IDs between Angel AI and FUN Profile
CREATE TABLE public.fun_id_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  angel_user_id UUID NOT NULL,
  fun_profile_user_id TEXT,
  wallet_address TEXT,
  linked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (angel_user_id)
);

-- Enable RLS
ALTER TABLE public.fun_id_links ENABLE ROW LEVEL SECURITY;

-- Users can view their own link
CREATE POLICY "Users can view own fun_id_link"
  ON public.fun_id_links FOR SELECT
  USING (auth.uid() = angel_user_id);

-- Users can create their own link
CREATE POLICY "Users can create own fun_id_link"
  ON public.fun_id_links FOR INSERT
  WITH CHECK (auth.uid() = angel_user_id);

-- Users can update their own link
CREATE POLICY "Users can update own fun_id_link"
  ON public.fun_id_links FOR UPDATE
  USING (auth.uid() = angel_user_id);

-- Admins can view all links
CREATE POLICY "Admins can view all fun_id_links"
  ON public.fun_id_links FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- Trigger for updated_at
CREATE TRIGGER update_fun_id_links_updated_at
  BEFORE UPDATE ON public.fun_id_links
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
