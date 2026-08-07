-- =====================================================================
-- Explicitly revoke stale function EXECUTE grants from exposed API roles
--
-- Older Supabase projects may have default ACLs that grant EXECUTE on new
-- public-schema functions to anon/authenticated/service_role. Revoking from
-- PUBLIC alone does not remove those explicit role grants, so we revoke from
-- each exposed role and then grant back only the minimum required access.
-- =====================================================================

-- Trigger-only helpers: no direct RPC access.
revoke all on function public.touch_updated_at() from public, anon, authenticated, service_role;
revoke all on function public.handle_new_user() from public, anon, authenticated, service_role;

-- Service-role-only helpers.
revoke all on function public.promote_admin_by_email(citext) from public, anon, authenticated, service_role;
grant execute on function public.promote_admin_by_email(citext) to service_role;

revoke all on function public.increment_pet_votes(uuid, integer, integer) from public, anon, authenticated, service_role;
grant execute on function public.increment_pet_votes(uuid, integer, integer) to service_role;

revoke all on function public.apply_manual_vote_adjustment(uuid, uuid, integer, text) from public, anon, authenticated, service_role;
grant execute on function public.apply_manual_vote_adjustment(uuid, uuid, integer, text) to service_role;

revoke all on function public.find_user_id_by_email(text) from public, anon, authenticated, service_role;
grant execute on function public.find_user_id_by_email(text) to service_role;

revoke all on function public.process_pledge_donation(
  text,
  text,
  boolean,
  jsonb,
  jsonb,
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  citext,
  integer,
  integer,
  integer,
  text,
  text
) from public, anon, authenticated, service_role;
grant execute on function public.process_pledge_donation(
  text,
  text,
  boolean,
  jsonb,
  jsonb,
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  citext,
  integer,
  integer,
  integer,
  text,
  text
) to service_role;

-- Authenticated-only helpers used by RLS or signed-in user actions.
revoke all on function public.is_admin(uuid) from public, anon, authenticated, service_role;
grant execute on function public.is_admin(uuid) to authenticated;

revoke all on function public.get_vote_credit_balance(uuid) from public, anon, authenticated, service_role;
grant execute on function public.get_vote_credit_balance(uuid) to authenticated, service_role;

revoke all on function public.spend_vote_credits(uuid, uuid, integer) from public, anon, authenticated, service_role;
grant execute on function public.spend_vote_credits(uuid, uuid, integer) to authenticated, service_role;

-- Future-proof: new public-schema functions should be private until granted.
alter default privileges for role postgres in schema public
  revoke execute on functions from anon, authenticated, service_role;

alter default privileges for role postgres in schema public
  revoke execute on functions from public;
