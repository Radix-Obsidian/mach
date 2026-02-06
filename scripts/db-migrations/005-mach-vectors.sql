-- 005: Mach-Trace Vector Store
-- Run in Supabase Dashboard SQL Editor
-- Requires pgvector extension

-- Enable pgvector extension
create extension if not exists vector;

-- Mach-Trace vector store
create table mach_vectors (
  id uuid primary key default gen_random_uuid(),
  content text not null,
  metadata jsonb not null default '{}',
  embedding vector(1536),
  created_at timestamptz default now()
);

-- Index for similarity search
create index on mach_vectors using ivfflat (embedding vector_cosine_ops) with (lists = 100);

-- RLS: service key only (no user-facing access)
alter table mach_vectors enable row level security;

-- Match function for LangChain SupabaseVectorStore
create or replace function match_mach_vectors(
  query_embedding vector(1536),
  match_count int default 6,
  filter jsonb default '{}'
) returns table (
  id uuid,
  content text,
  metadata jsonb,
  similarity float
) language plpgsql as $$
begin
  return query
  select
    mv.id,
    mv.content,
    mv.metadata,
    1 - (mv.embedding <=> query_embedding) as similarity
  from mach_vectors mv
  where mv.metadata @> filter
  order by mv.embedding <=> query_embedding
  limit match_count;
end;
$$;
