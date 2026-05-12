-- =====================================================================
-- vote_credit_ledger
--
-- Tracks per-user vote credits. A user earns credits when their entry
-- donation exceeds the $10 entry fee (the overage is converted to
-- credits, 1 cent = 0.01 votes — display rounded to whole votes).
-- A user spends credits by allocating them to an approved pet from
-- /account or /vote.
--
-- The ledger is append-only. Balance is computed as
--   sum(delta_cents) where user_id = $1
-- Positive rows are credit deposits (from donations); negative rows are
-- spends (allocations to a pet).
-- =====================================================================
create table if not exists public.vote_credit_ledger (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users(id) on delete cascade,
  -- Positive = earned (deposit), negative = spent (allocation).
  delta_cents         integer not null check (delta_cents <> 0),
  -- For deposits: the donation that produced these credits.
  source_donation_id  uuid references public.pledge_donations(id) on delete set null,
  -- For spends: the pet the credits were allocated to.
  pet_submission_id   uuid references public.pet_submissions(id) on delete set null,
  reason              text,
  created_at          timestamptz not null default now()
);

create index if not exists vote_credit_ledger_user_idx
  on public.vote_credit_ledger (user_id, created_at desc);

create index if not exists vote_credit_ledger_pet_idx
  on public.vote_credit_ledger (pet_submission_id, created_at desc)
  where pet_submission_id is not null;

alter table public.vote_credit_ledger enable row level security;

drop policy if exists vote_credit_ledger_select_self on public.vote_credit_ledger;
create policy vote_credit_ledger_select_self
  on public.vote_credit_ledger for select
  using (
    auth.role() = 'service_role'
    or (auth.uid() is not null and user_id = auth.uid())
  );

drop policy if exists vote_credit_ledger_service_writes on public.vote_credit_ledger;
create policy vote_credit_ledger_service_writes
  on public.vote_credit_ledger for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

-- ---------------------------------------------------------------------
-- get_vote_credit_balance: convenience helper, sums the ledger.
-- ---------------------------------------------------------------------
create or replace function public.get_vote_credit_balance(p_user_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(delta_cents), 0)::integer
    from public.vote_credit_ledger
   where user_id = p_user_id;
$$;

revoke all on function public.get_vote_credit_balance(uuid) from public;
grant execute on function public.get_vote_credit_balance(uuid)
  to authenticated, service_role;

-- ---------------------------------------------------------------------
-- spend_vote_credits: atomically debit the user's wallet and credit
-- the pet's vote totals. Does NOT bump contest.current_amount_cents —
-- the underlying donation already counted toward "raised" when the
-- webhook first processed it.
--
-- Returns the user's remaining balance in cents.
-- ---------------------------------------------------------------------
create or replace function public.spend_vote_credits(
  p_user_id          uuid,
  p_pet_submission_id uuid,
  p_cents            integer
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance integer;
  v_votes   integer;
  v_pet     public.pet_submissions%rowtype;
begin
  if p_user_id is null then raise exception 'user required'; end if;
  if p_pet_submission_id is null then raise exception 'pet required'; end if;
  if p_cents is null or p_cents <= 0 then
    raise exception 'amount must be > 0';
  end if;
  if (p_cents % 100) <> 0 then
    raise exception 'amount must be a whole number of votes (multiple of 100 cents)';
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
