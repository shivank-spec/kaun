-- Who each player currently doubts (live suspicion meter during discussion).
alter table players add column if not exists doubt uuid;
