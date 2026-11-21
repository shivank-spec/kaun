-- A bank of AI-written solo cases, refilled whenever the AI has spare quota.
create table if not exists case_pool (
  id bigserial primary key,
  bucket text not null,          -- 'kolkata' | 'hackathon'
  tone text not null,            -- 'desi' | 'noir'
  title text not null,
  case_file jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists case_pool_bucket_idx on case_pool(bucket, tone);
alter table case_pool enable row level security;
