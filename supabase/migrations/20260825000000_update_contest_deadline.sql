-- Move the live contest deadline to September 26, 2026.
update public.contest_settings
set
  submission_deadline = '2026-09-26 23:59:00-06',
  voting_deadline = '2026-09-26 23:59:00-06',
  updated_at = now()
where id = 1;