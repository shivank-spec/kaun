-- Kaun? multiplayer tables. Accessed only by the server (service role key).
create table if not exists rooms (
  code text primary key,
  status text not null default 'lobby',
  settings jsonb not null default '{}'::jsonb,
  case_file jsonb,
  phase_ends_at timestamptz,
  reveal jsonb,
  created_at timestamptz not null default now()
);
create table if not exists players (
  id uuid primary key,
  room_code text not null references rooms(code) on delete cascade,
  name text not null,
  is_host boolean not null default false,
  card jsonb,
  vote uuid,
  joined_at timestamptz not null default now()
);
create index if not exists players_room_idx on players(room_code);
-- No policies: with RLS on, browsers get nothing; only the server key can read.
alter table rooms enable row level security;
alter table players enable row level security;
alter table players add column if not exists is_bot boolean not null default false;

create table if not exists scores (
  id bigserial primary key,
  name text not null,
  score int not null,
  correct boolean not null,
  case_title text not null,
  created_at timestamptz not null default now()
);
create index if not exists scores_recent_idx on scores(created_at desc, score desc);
alter table scores enable row level security;
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
