-- =====================================================================
-- Row Level Security policies
-- Principles:
--   * anon role:        can read approved pets + leaderboard + contest_settings
--   * authenticated:    can read/insert own submissions; read own profile
--   * admin (profiles.role='admin'): full read/write across content tables
--   * service_role:     bypasses RLS — used by the Next.js webhook + server actions
-- =====================================================================

alter table public.profiles          enable row level security;
alter table public.pet_submissions   enable row level security;
alter table public.vote_transactions enable row level security;
alter table public.webhook_events_raw enable row level security;
alter table public.contest_settings  enable row level security;

-- ---------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------
drop policy if exists profiles_select_self        on public.profiles;
drop policy if exists profiles_select_admin       on public.profiles;
drop policy if exists profiles_update_self_name   on public.profiles;

create policy profiles_select_self on public.profiles
  for select to authenticated
  using (id = auth.uid());

create policy profiles_select_admin on public.profiles
  for select to authenticated
  using (public.is_admin(auth.uid()));

-- Users can update their own full_name; role changes go through service role.
create policy profiles_update_self_name on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid() and role = (select role from public.profiles where id = auth.uid()));

-- ---------------------------------------------------------------------
-- pet_submissions
-- ---------------------------------------------------------------------
drop policy if exists pet_submissions_select_public on public.pet_submissions;
drop policy if exists pet_submissions_select_owner  on public.pet_submissions;
drop policy if exists pet_submissions_select_admin  on public.pet_submissions;
drop policy if exists pet_submissions_insert_owner  on public.pet_submissions;
drop policy if exists pet_submissions_update_admin  on public.pet_submissions;
drop policy if exists pet_submissions_delete_admin  on public.pet_submissions;

-- Anonymous + authenticated visitors can read approved pets only.
create policy pet_submissions_select_public on public.pet_submissions
  for select to anon, authenticated
  using (status = 'approved');

-- Owners can read their own submissions in any status.
create policy pet_submissions_select_owner on public.pet_submissions
  for select to authenticated
  using (user_id = auth.uid());

-- Admins can read everything.
create policy pet_submissions_select_admin on public.pet_submissions
  for select to authenticated
  using (public.is_admin(auth.uid()));

-- Owners may insert a row for themselves; status MUST start as pending_payment
-- and approval-only fields must remain null. Status transitions to
-- 'approved'/'rejected' are performed via service role from server actions.
create policy pet_submissions_insert_owner on public.pet_submissions
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and status = 'pending_payment'
    and entry_donation_confirmed = false
    and approved_at is null
    and rejected_at is null
    and public_image_path is null
    and givebutter_member_url is null
    and givebutter_member_id  is null
  );

-- Admins can update / delete any submission.
create policy pet_submissions_update_admin on public.pet_submissions
  for update to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

create policy pet_submissions_delete_admin on public.pet_submissions
  for delete to authenticated
  using (public.is_admin(auth.uid()));

-- ---------------------------------------------------------------------
-- vote_transactions
-- All writes are server-side (service role) via webhook or admin actions.
-- ---------------------------------------------------------------------
drop policy if exists vote_transactions_select_admin on public.vote_transactions;

create policy vote_transactions_select_admin on public.vote_transactions
  for select to authenticated
  using (public.is_admin(auth.uid()));

-- (No insert/update/delete policies → only service_role can write.)

-- ---------------------------------------------------------------------
-- webhook_events_raw
-- ---------------------------------------------------------------------
drop policy if exists webhook_events_raw_select_admin on public.webhook_events_raw;

create policy webhook_events_raw_select_admin on public.webhook_events_raw
  for select to authenticated
  using (public.is_admin(auth.uid()));

-- (Writes performed exclusively by service_role.)

-- ---------------------------------------------------------------------
-- contest_settings — public read, admin write.
-- ---------------------------------------------------------------------
drop policy if exists contest_settings_select_public on public.contest_settings;
drop policy if exists contest_settings_update_admin  on public.contest_settings;

create policy contest_settings_select_public on public.contest_settings
  for select to anon, authenticated
  using (true);

create policy contest_settings_update_admin on public.contest_settings
  for update to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- ---------------------------------------------------------------------
-- Grants — RLS still applies; these just expose the relations to PostgREST.
-- ---------------------------------------------------------------------
grant usage on schema public to anon, authenticated;

grant select on public.pet_submissions, public.contest_settings, public.pet_leaderboard to anon, authenticated;
grant insert on public.pet_submissions to authenticated;
grant select on public.profiles, public.vote_transactions, public.webhook_events_raw to authenticated;
grant update on public.profiles, public.pet_submissions, public.contest_settings to authenticated;
grant delete on public.pet_submissions to authenticated;
