-- =====================================================================
-- Harden callable public functions and user-scoped wallet access
--
-- Goals:
--   * prevent authenticated callers from reading/spending another
--     user's wallet by passing an arbitrary UUID to RPCs
--   * require explicit caller roles inside SECURITY DEFINER helpers so
--     grant drift cannot silently turn them into privilege escalations
--   * revoke direct execute on trigger-only functions
--   * grant the minimum relation privileges needed for authenticated
--     wallet reads and vote-intent inserts under RLS
-- =====================================================================

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function public.touch_updated_at() from public;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name')
  )
  on conflict (id) do update
    set email     = excluded.email,
        full_name = coalesce(excluded.full_name, public.profiles.full_name);
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public;

create or replace function public.promote_admin_by_email(p_email citext)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if auth.role() <> 'service_role' then
    raise exception 'service role required';
  end if;

  update public.profiles
     set role = 'admin'
   where email = p_email
     and role <> 'admin';
end;
$$;

revoke all on function public.promote_admin_by_email(citext) from public;
grant execute on function public.promote_admin_by_email(citext) to service_role;

create or replace function public.increment_pet_votes(
  p_pet_id uuid,
  p_votes integer,
  p_cents integer
) returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if auth.role() <> 'service_role' then
    raise exception 'service role required';
  end if;

  if p_pet_id is null then
    return;
  end if;

  update public.pet_submissions
     set total_votes         = greatest(0, total_votes + coalesce(p_votes, 0)),
         total_donated_cents = greatest(0, total_donated_cents + coalesce(p_cents, 0))
   where id = p_pet_id;
end;
$$;

revoke all on function public.increment_pet_votes(uuid, integer, integer) from public;
grant execute on function public.increment_pet_votes(uuid, integer, integer) to service_role;

create or replace function public.apply_manual_vote_adjustment(
  p_pet_id uuid,
  p_admin_id uuid,
  p_cents_delta integer,
  p_reason text
) returns public.manual_vote_audit
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_votes_delta integer;
  v_prev integer;
  v_new integer;
  v_audit public.manual_vote_audit;
begin
  if auth.role() <> 'service_role'
     and (auth.uid() is null or not public.is_admin(auth.uid())) then
    raise exception 'admin required';
  end if;

  if p_pet_id is null then
    raise exception 'pet_submission_id is required';
  end if;
  if p_cents_delta is null or p_cents_delta = 0 then
    raise exception 'non-zero amount required';
  end if;

  v_votes_delta := sign(p_cents_delta) * (abs(p_cents_delta) / 100);

  select total_votes into v_prev
    from public.pet_submissions
   where id = p_pet_id
   for update;
  if v_prev is null then
    raise exception 'pet not found';
  end if;

  v_new := greatest(0, v_prev + v_votes_delta);

  update public.pet_submissions
     set total_votes            = v_new,
         manual_vote_adjustment = manual_vote_adjustment + v_votes_delta,
         total_donated_cents    = greatest(0, total_donated_cents + p_cents_delta)
   where id = p_pet_id;

  insert into public.manual_vote_audit (
    pet_submission_id,
    admin_user_id,
    amount_cents_delta,
    votes_delta,
    previous_total,
    new_total,
    reason
  ) values (
    p_pet_id,
    p_admin_id,
    p_cents_delta,
    v_votes_delta,
    v_prev,
    v_new,
    p_reason
  )
  returning * into v_audit;

  return v_audit;
end;
$$;

revoke all on function public.apply_manual_vote_adjustment(uuid, uuid, integer, text) from public;
grant execute on function public.apply_manual_vote_adjustment(uuid, uuid, integer, text)
  to service_role;

create or replace function public.find_user_id_by_email(p_email text)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid;
begin
  if auth.role() <> 'service_role' then
    raise exception 'service role required';
  end if;

  if p_email is null or btrim(p_email) = '' then
    return null;
  end if;

  select id
    into v_user_id
    from auth.users
   where lower(email) = lower(p_email)
   limit 1;

  return v_user_id;
end;
$$;

revoke all on function public.find_user_id_by_email(text) from public;
grant execute on function public.find_user_id_by_email(text) to service_role;

create or replace function public.get_vote_credit_balance(p_user_id uuid)
returns integer
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  v_effective_user uuid;
begin
  if auth.role() = 'service_role' then
    v_effective_user := p_user_id;
  else
    if auth.uid() is null then
      raise exception 'auth required';
    end if;
    if p_user_id is null or p_user_id <> auth.uid() then
      raise exception 'cannot read another user''s vote credits';
    end if;
    v_effective_user := auth.uid();
  end if;

  if v_effective_user is null then
    raise exception 'user required';
  end if;

  return (
    select coalesce(sum(delta_cents), 0)::integer
      from public.vote_credit_ledger
     where user_id = v_effective_user
  );
end;
$$;

revoke all on function public.get_vote_credit_balance(uuid) from public;
grant execute on function public.get_vote_credit_balance(uuid)
  to authenticated, service_role;

create or replace function public.spend_vote_credits(
  p_user_id uuid,
  p_pet_submission_id uuid,
  p_cents integer
) returns integer
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_effective_user uuid;
  v_balance integer;
  v_votes integer;
  v_pet public.pet_submissions%rowtype;
  v_voting_open boolean;
  v_voting_deadline timestamptz;
begin
  if auth.role() = 'service_role' then
    v_effective_user := p_user_id;
  else
    if auth.uid() is null then
      raise exception 'auth required';
    end if;
    if p_user_id is null or p_user_id <> auth.uid() then
      raise exception 'cannot spend another user''s vote credits';
    end if;
    v_effective_user := auth.uid();
  end if;

  if v_effective_user is null then
    raise exception 'user required';
  end if;
  if p_pet_submission_id is null then
    raise exception 'pet required';
  end if;
  if p_cents is null or p_cents <= 0 then
    raise exception 'amount must be > 0';
  end if;
  if (p_cents % 100) <> 0 then
    raise exception 'amount must be a whole number of votes (multiple of 100 cents)';
  end if;

  select voting_open, voting_deadline
    into v_voting_open, v_voting_deadline
    from public.contest_settings
   where id = 1;
  if coalesce(v_voting_open, false) = false then
    raise exception 'voting is currently closed';
  end if;
  if v_voting_deadline is not null and now() >= v_voting_deadline then
    raise exception 'voting deadline has passed';
  end if;

  select * into v_pet
    from public.pet_submissions
   where id = p_pet_submission_id
   for update;
  if v_pet.id is null then
    raise exception 'pet not found';
  end if;
  if v_pet.status <> 'approved' then
    raise exception 'pet is not approved';
  end if;

  perform 1
    from public.vote_credit_ledger
   where user_id = v_effective_user
   for update;

  select coalesce(sum(delta_cents), 0)::integer
    into v_balance
    from public.vote_credit_ledger
   where user_id = v_effective_user;
  if v_balance < p_cents then
    raise exception 'insufficient vote credits (balance %, requested %)',
      v_balance, p_cents;
  end if;

  v_votes := p_cents / 100;

  insert into public.vote_credit_ledger (
    user_id,
    delta_cents,
    pet_submission_id,
    reason
  ) values (
    v_effective_user,
    -p_cents,
    p_pet_submission_id,
    'spend'
  );

  update public.pet_submissions
     set total_votes = greatest(0, total_votes + v_votes)
   where id = p_pet_submission_id;

  return v_balance - p_cents;
end;
$$;

revoke all on function public.spend_vote_credits(uuid, uuid, integer) from public;
grant execute on function public.spend_vote_credits(uuid, uuid, integer)
  to authenticated, service_role;

grant select on public.vote_credit_ledger to authenticated;
grant insert on public.donation_intents to authenticated;
