-- =====================================================================
-- find_user_id_by_email
--
-- Resolves a (case-insensitive) email to its auth.users.id. Used by the
-- Pledge webhook to credit general donations (donations not tied to a
-- specific pet via a donation_intent) to the donor's vote-credit
-- wallet, when the donor email matches a registered account.
--
-- security-definer so service-role can read auth.users.email without
-- granting blanket access to the table. Returns NULL if no match.
-- =====================================================================

create or replace function public.find_user_id_by_email(p_email text)
returns uuid
language sql
security definer
set search_path = public, auth
as $$
  select id
  from auth.users
  where lower(email) = lower(p_email)
  limit 1;
$$;

revoke all on function public.find_user_id_by_email(text) from public;
grant execute on function public.find_user_id_by_email(text) to service_role;
