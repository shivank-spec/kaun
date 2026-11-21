-- Narration audio is cached so four phones in one room cost one voice call, not four.
create table if not exists tts_cache (
  hash text primary key,
  audio_b64 text not null,
  created_at timestamptz not null default now()
);
alter table tts_cache enable row level security;
