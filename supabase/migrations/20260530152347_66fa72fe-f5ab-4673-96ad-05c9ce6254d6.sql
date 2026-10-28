CREATE TABLE public.web_scrape_cache (
  url_hash text PRIMARY KEY,
  url text NOT NULL,
  title text,
  description text,
  summary text,
  markdown text,
  fetched_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.web_scrape_cache TO service_role;

ALTER TABLE public.web_scrape_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service role only" ON public.web_scrape_cache FOR ALL TO service_role USING (true) WITH CHECK (true);