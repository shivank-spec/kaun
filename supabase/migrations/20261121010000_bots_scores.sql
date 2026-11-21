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
