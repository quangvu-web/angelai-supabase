-- Cost controls: provider observability, safer storage caps, and temporary-object cleanup.

create table if not exists public.ai_provider_usage_log (
  id uuid primary key default gen_random_uuid(),
  function_name text not null,
  provider text not null,
  model text,
  status integer,
  user_id uuid references auth.users(id) on delete set null,
  estimated_input_tokens integer,
  estimated_output_tokens integer,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists ai_provider_usage_log_created_idx
  on public.ai_provider_usage_log (created_at desc);

create index if not exists ai_provider_usage_log_function_provider_idx
  on public.ai_provider_usage_log (function_name, provider, created_at desc);

alter table public.ai_provider_usage_log enable row level security;

drop policy if exists "Service role can insert provider usage logs" on public.ai_provider_usage_log;
create policy "Service role can insert provider usage logs"
  on public.ai_provider_usage_log
  for insert
  to service_role
  with check (true);

drop policy if exists "Admins can read provider usage logs" on public.ai_provider_usage_log;
create policy "Admins can read provider usage logs"
  on public.ai_provider_usage_log
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.role = 'admin'
    )
  );

update storage.buckets
set
  file_size_limit = 262144000,
  allowed_mime_types = array[
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'video/mp4',
    'video/webm',
    'video/quicktime',
    'video/x-msvideo',
    'video/x-matroska'
  ]
where id = 'community';

update storage.buckets
set
  file_size_limit = 52428800,
  allowed_mime_types = array[
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf',
    'text/plain',
    'text/csv',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'audio/mpeg',
    'audio/mp4',
    'audio/webm',
    'video/mp4',
    'video/webm'
  ]
where id = 'chat-attachments';

update storage.buckets
set
  file_size_limit = 10485760,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
where id = 'ai-images';

drop policy if exists "Authenticated users can upload chat attachments" on storage.objects;
create policy "Authenticated users can upload own chat attachments"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'chat-attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create or replace function public.cleanup_cost_control_storage()
returns void
language plpgsql
security definer
set search_path = public, storage
as $$
begin
  delete from storage.objects
  where bucket_id = 'chat-attachments'
    and created_at < now() - interval '14 days';

  delete from storage.objects
  where bucket_id = 'ai-images'
    and created_at < now() - interval '30 days'
    and name like '%/temp/%';

  delete from storage.objects
  where bucket_id = 'community'
    and created_at < now() - interval '7 days'
    and (
      name like 'tmp/%'
      or name like 'failed/%'
      or name like 'rejected/%'
    );
end;
$$;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid)
    from cron.job
    where jobname = 'cost-control-storage-cleanup';

    perform cron.schedule(
      'cost-control-storage-cleanup',
      '17 3 * * *',
      'select public.cleanup_cost_control_storage();'
    );
  end if;
exception
  when invalid_schema_name or undefined_table or undefined_function then
    null;
end;
$$;
