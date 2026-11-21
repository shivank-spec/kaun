-- A question one player fires at another during the discussion.
alter table players add column if not exists poke jsonb;
