-- =====================================================================
-- Enforce voting window inside spend_vote_credits
--
-- Server actions already gate by contest settings, but authenticated
-- users can call RPCs directly. This hardens the DB path so credits
-- cannot be spent once voting is closed or the deadline has passed.
-- =====================================================================

create or replace function public.spend_vote_credits(
  p_user_id           uuid,
  p_pet_submission_id uuid,
  p_cents             integer
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance         integer;
  v_votes           integer;
  v_pet             public.pet_submissions%rowtype;
  v_voting_open     boolean;
  v_voting_deadline timestamptz;
begin
  if p_user_id is null then raise exception 'user required'; end if;
  if p_pet_submission_id is null then raise exception 'pet required'; end if;
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

  select * into v_pet from public.pet_submissions
   where id = p_pet_submission_id for update;
  if v_pet.id is null then
    raise exception 'pet not found';
  end if;
  if v_pet.status <> 'approved' then
    raise exception 'pet is not approved';
  end if;

  -- Lock the user's wallet rows so concurrent spends can't
  -- both pass the balance check.
  perform 1 from public.vote_credit_ledger
   where user_id = p_user_id for update;

  select coalesce(sum(delta_cents), 0)::integer into v_balance
    from public.vote_credit_ledger
   where user_id = p_user_id;
  if v_balance < p_cents then
    raise exception 'insufficient vote credits (balance %, requested %)',
      v_balance, p_cents;
  end if;

  v_votes := p_cents / 100;

  insert into public.vote_credit_ledger
    (user_id, delta_cents, pet_submission_id, reason)
  values
    (p_user_id, -p_cents, p_pet_submission_id, 'spend');

  update public.pet_submissions
     set total_votes = greatest(0, total_votes + v_votes)
   where id = p_pet_submission_id;

  return v_balance - p_cents;
end;
$$;

revoke all on function public.spend_vote_credits(uuid, uuid, integer) from public;
grant execute on function public.spend_vote_credits(uuid, uuid, integer)
  to authenticated, service_role;
