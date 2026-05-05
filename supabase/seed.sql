-- Local dev seed. Safe to re-run.
insert into public.contest_settings (id, contest_open, submission_deadline, voting_deadline, goal_amount_cents)
values (1, true, '2026-11-13 23:59:00-07', '2026-11-13 23:59:00-07', 50000)
on conflict (id) do update set
  contest_open        = excluded.contest_open,
  submission_deadline = excluded.submission_deadline,
  voting_deadline     = excluded.voting_deadline,
  goal_amount_cents   = excluded.goal_amount_cents;
