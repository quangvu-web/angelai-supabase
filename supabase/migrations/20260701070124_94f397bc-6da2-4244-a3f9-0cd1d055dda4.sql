
create extension if not exists vector;

-- Cột embedding + metadata cho chunks
alter table public.knowledge_chunks
  add column if not exists embedding vector(1536),
  add column if not exists doc_title text,
  add column if not exists folder_name text,
  add column if not exists token_count int,
  add column if not exists embed_model text default 'openai/text-embedding-3-small',
  add column if not exists embedded_at timestamptz;

-- HNSW index cho tìm cosine nhanh
create index if not exists knowledge_chunks_embedding_idx
  on public.knowledge_chunks
  using hnsw (embedding vector_cosine_ops);

create index if not exists knowledge_chunks_document_id_idx
  on public.knowledge_chunks (document_id);

-- Cột trạng thái ingest cho documents
alter table public.knowledge_documents
  add column if not exists ingest_status text default 'pending',
  add column if not exists ingest_error text,
  add column if not exists ingested_at timestamptz,
  add column if not exists chunk_count int default 0;

create index if not exists knowledge_documents_ingest_status_idx
  on public.knowledge_documents (ingest_status);

-- Trigger đánh dấu pending khi content đổi
create or replace function public.tg_mark_doc_pending()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.extracted_content is not null and (new.ingest_status is null) then
      new.ingest_status := 'pending';
    end if;
    return new;
  end if;
  if new.extracted_content is not null
     and (old.extracted_content is distinct from new.extracted_content) then
    new.ingest_status := 'pending';
    new.ingested_at := null;
    new.ingest_error := null;
  end if;
  return new;
end $$;

drop trigger if exists trg_mark_doc_pending on public.knowledge_documents;
create trigger trg_mark_doc_pending
  before insert or update on public.knowledge_documents
  for each row execute function public.tg_mark_doc_pending();

-- RPC semantic search
create or replace function public.match_knowledge_chunks(
  query_embedding vector(1536),
  match_count int default 6,
  min_similarity float default 0.55
)
returns table (
  chunk_id uuid,
  document_id uuid,
  doc_title text,
  folder_name text,
  chunk_text text,
  similarity float
)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.id,
    c.document_id,
    coalesce(c.doc_title, d.title) as doc_title,
    c.folder_name,
    c.chunk_text,
    1 - (c.embedding <=> query_embedding) as similarity
  from public.knowledge_chunks c
  left join public.knowledge_documents d on d.id = c.document_id
  where c.embedding is not null
    and (1 - (c.embedding <=> query_embedding)) >= min_similarity
  order by c.embedding <=> query_embedding
  limit match_count
$$;

grant execute on function public.match_knowledge_chunks(vector, int, float)
  to authenticated, service_role;

-- Đảm bảo grants đủ cho service_role trên chunks
grant all on public.knowledge_chunks to service_role;
