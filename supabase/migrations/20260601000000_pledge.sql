-- =====================================================================
-- Pledge.to migration
--
-- Replaces the previous Givebutter integration entirely.
--   * drops pet_leaderboard view, vote_transactions table,
--     webhook_events_raw table, vote_kind enum
--   * drops the per-user vote-credit / allocation model
--   * drops givebutter_* columns on pet_submissions
--   * adds Pledge.to columns on pet_submissions
--   * adds total_votes (denormalized; incremented by webhook + manual audit)
--   * adds pledge_donations, pledge_webhook_events, manual_vote_audit tables
--   * adds submissions_open / voting_open / current_amount_cents on
--     contest_settings (keeps legacy contest_open for compatibility)
--   * RLS: only service_role writes pledge_donations + pledge_webhook_events
-- =====================================================================

-- ---------------------------------------------------------------------
-- Drop legacy objects (Givebutter + credit-pool model)
-- ---------------------------------------------------------------------
drop view if exists public.pet_leaderboard;
drop table if exists public.vote_transactions cascade;
drop table if exists public.webhook_events_raw cascade;
drop type if exists public.vote_kind;

-- ---------------------------------------------------------------------
-- pet_submissions: drop Givebutter, add Pledge + denormalized totals
-- ---------------------------------------------------------------------
alter table public.pet_submissions
  drop column if exists givebutter_member_url,
  drop column if exists givebutter_member_id;

alter table public.pet_submissions
  add column if not exists total_votes              integer not null default 0
    check (total_votes >= 0),
  add column if not exists manual_vote_adjustment   integer not null default 0,
  add column if not exists total_donated_cents      integer not null default 0
    check (total_donated_cents >= 0),
  -- Per-pet Pledge.to surface that admins configure after approval.
  add column if not exists pledge_donation_url      text,
  add column if not exists pledge_widget_id         text,
  add column if not exists pledge_campaign_id       text,
  -- Identifier we attach to a Pledge donation that maps the donation
  -- back to a pet (e.g. campaign UTM, widget mapping key, etc).
  add column if not exists pledge_mapping_key       text,
  -- Set when an entry donation has been matched via webhook.
  add column if not exists entry_pledge_transaction_id text;

create unique index if not exists pet_submissions_pledge_mapping_key_uq
  on public.pet_submissions (pledge_mapping_key)
  where pledge_mapping_key is not null;

create unique index if not exists pet_submissions_pledge_widget_id_uq
  on public.pet_submissions (pledge_widget_id)
  where pledge_widget_id is not null;

create index if not exists pet_submissions_total_votes_idx
  on public.pet_submissions (total_votes desc)
  where status = 'approved';

-- ---------------------------------------------------------------------
-- pledge_donations
--
-- One row per processed Pledge.to donation. Idempotent on
-- pledge_event_id (unique). Money stored in cents; tips/fees not counted
-- toward votes. $1 = 1 vote via floor(amount_cents / 100).
-- ---------------------------------------------------------------------
do $$ begin
  create type public.pledge_donation_type as enum (
    'entry',    -- pet entry donation ($10 minimum) — promotes pending_payment -> pending_review
    'vote',     -- post-approval donation routed to a specific pet
    'general',  -- general fundraiser donation not bound to a pet
    'unknown'   -- received but could not be classified
  );
exception when duplicate_object then null; end $$;

create table if not exists public.pledge_donations (
  id                          uuid primary key default gen_random_uuid(),
  pet_submission_id           uuid references public.pet_submissions(id) on delete set null,
  -- Pledge.to event id (top-level webhook id). Unique → idempotent receive.
  pledge_event_id             text not null unique,
  -- The underlying donation/transaction id from Pledge.to (may equal
  -- pledge_event_id depending on payload shape — keep both for safety).
  pledge_transaction_id       text,
  pledge_campaign_id          text,
  pledge_widget_id            text,
  pledge_fundraiser_id        text,
  pledge_mapping_key          text,
  donor_name                  text,
  donor_email                 citext,
  -- Money in cents. amount_cents excludes tips/fees per spec.
  amount_cents                integer not null check (amount_cents >= 0),
  tip_cents                   integer not null default 0 check (tip_cents >= 0),
  fee_cents                   integer not null default 0 check (fee_cents >= 0),
  currency                    text not null default 'USD',
  -- Derived: floor(amount_cents / 100). Stored for auditability.
  vote_credits                integer not null check (vote_credits >= 0),
  donation_type               public.pledge_donation_type not null default 'unknown',
  raw_payload                 jsonb not null,
  processed_at                timestamptz,
  created_at                  timestamptz not null default now(),
  constraint pledge_donations_transaction_id_uq unique (pledge_transaction_id)
);

create index if not exists pledge_donations_pet_idx
  on public.pledge_donations (pet_submission_id);
create index if not exists pledge_donations_type_idx
  on public.pledge_donations (donation_type);
create index if not exists pledge_donations_created_idx
  on public.pledge_donations (created_at desc);

-- ---------------------------------------------------------------------
-- pledge_webhook_events
--
-- Audit log of every inbound webhook attempt (signature ok or not).
-- ---------------------------------------------------------------------
do $$ begin
  create type public.pledge_webhook_status as enum (
    'received',
    'verified',
    'processed',
    'unmapped',
    'failed'
  );
exception when duplicate_object then null; end $$;

create table if not exists public.pledge_webhook_events (
  id                  uuid primary key default gen_random_uuid(),
  pledge_event_id     text unique,
  event_type          text,
  signature_verified  boolean not null default false,
  processing_status   public.pledge_webhook_status not null default 'received',
  pet_submission_id   uuid references public.pet_submissions(id) on delete set null,
  donation_id         uuid references public.pledge_donations(id) on delete set null,
  error_message       text,
  raw_payload         jsonb not null,
  raw_headers         jsonb not null default '{}'::jsonb,
  processed_at        timestamptz,
  created_at          timestamptz not null default now()
);

create index if not exists pledge_webhook_events_status_idx
  on public.pledge_webhook_events (processing_status);
create index if not exists pledge_webhook_events_created_idx
  on public.pledge_webhook_events (created_at desc);
create index if not exists pledge_webhook_events_unmapped_idx
  on public.pledge_webhook_events (created_at desc)
  where processing_status = 'unmapped';

-- ---------------------------------------------------------------------
-- manual_vote_audit
--
-- Admins may add/subtract votes outside the Pledge.to flow (cash, check,
-- corrections). Every change is logged here AND mirrored on
-- pet_submissions.manual_vote_adjustment via the apply_manual_vote
-- function below. Votes are always $1 = 1 vote; admins enter dollars,
-- the function computes vote delta.
-- ---------------------------------------------------------------------
create table if not exists public.manual_vote_audit (
  id                  uuid primary key default gen_random_uuid(),
  pet_submission_id   uuid not null references public.pet_submissions(id) on delete cascade,
  admin_user_id       uuid references auth.users(id) on delete set null,
  amount_cents_delta  integer not null,
  votes_delta         integer not null,
  previous_total      integer not null,
  new_total           integer not null,
  reason              text not null,
  created_at          timestamptz not null default now()
);

create index if not exists manual_vote_audit_pet_idx
  on public.manual_vote_audit (pet_submission_id, created_at desc);

-- ---------------------------------------------------------------------
-- Functions: increment_pet_votes + apply_manual_vote_adjustment
-- ---------------------------------------------------------------------

-- Increments total_votes + total_donated_cents atomically. Used by the
-- webhook after inserting a pledge_donations row.
create or replace function public.increment_pet_votes(
  p_pet_id     uuid,
  p_votes      integer,
  p_cents      integer
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_pet_id is null then return; end if;
  update public.pet_submissions
     set total_votes         = greatest(0, total_votes + coalesce(p_votes, 0)),
         total_donated_cents = greatest(0, total_donated_cents + coalesce(p_cents, 0))
   where id = p_pet_id;
end;
$$;

revoke all on function public.increment_pet_votes(uuid, integer, integer) from public;
grant execute on function public.increment_pet_votes(uuid, integer, integer) to service_role;

-- Records a manual vote adjustment + audit row in one transaction.
-- Admin supplies dollars; votes_delta = floor(|cents|/100) with same sign.
create or replace function public.apply_manual_vote_adjustment(
  p_pet_id      uuid,
  p_admin_id    uuid,
  p_cents_delta integer,
  p_reason      text
) returns public.manual_vote_audit
language plpgsql
security definer
set search_path = public
as $$
declare
  v_votes_delta  integer;
  v_prev         integer;
  v_new          integer;
  v_audit        public.manual_vote_audit;
begin
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
     set total_votes              = v_new,
         manual_vote_adjustment   = manual_vote_adjustment + v_votes_delta,
         total_donated_cents      = greatest(0, total_donated_cents + p_cents_delta)
   where id = p_pet_id;

  insert into public.manual_vote_audit (
    pet_submission_id, admin_user_id, amount_cents_delta,
    votes_delta, previous_total, new_total, reason
  ) values (
    p_pet_id, p_admin_id, p_cents_delta,
    v_votes_delta, v_prev, v_new, p_reason
  ) returning * into v_audit;

  return v_audit;
end;
$$;

revoke all on function public.apply_manual_vote_adjustment(uuid, uuid, integer, text) from public;
grant execute on function public.apply_manual_vote_adjustment(uuid, uuid, integer, text) to service_role;

-- ---------------------------------------------------------------------
-- contest_settings: add Pledge-aware flags + running total
-- (Keep legacy contest_open for compatibility; new code reads
-- submissions_open / voting_open independently.)
-- ---------------------------------------------------------------------
alter table public.contest_settings
  add column if not exists submissions_open    boolean not null default true,
  add column if not exists voting_open         boolean not null default true,
  add column if not exists current_amount_cents integer not null default 0
    check (current_amount_cents >= 0);

-- ---------------------------------------------------------------------
-- RLS: lock down new tables
-- ---------------------------------------------------------------------
alter table public.pledge_donations         enable row level security;
alter table public.pledge_webhook_events    enable row level security;
alter table public.manual_vote_audit        enable row level security;

drop policy if exists pledge_donations_select_admin on public.pledge_donations;
create policy pledge_donations_select_admin on public.pledge_donations
  for select to authenticated
  using (public.is_admin(auth.uid()));

drop policy if exists pledge_webhook_events_select_admin on public.pledge_webhook_events;
create policy pledge_webhook_events_select_admin on public.pledge_webhook_events
  for select to authenticated
  using (public.is_admin(auth.uid()));

drop policy if exists manual_vote_audit_select_admin on public.manual_vote_audit;
create policy manual_vote_audit_select_admin on public.manual_vote_audit
  for select to authenticated
  using (public.is_admin(auth.uid()));

-- Service-role writes only (no policies → only service_role bypasses RLS).
grant select on public.pledge_donations, public.pledge_webhook_events, public.manual_vote_audit
  to authenticated;

-- ---------------------------------------------------------------------
-- Rewrite the pet_submissions insert policy: drop the obsolete
-- givebutter_* checks since those columns no longer exist.
-- ---------------------------------------------------------------------
drop policy if exists pet_submissions_insert_owner on public.pet_submissions;
create policy pet_submissions_insert_owner on public.pet_submissions
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and status = 'pending_payment'
    and entry_donation_confirmed = false
    and approved_at is null
    and rejected_at is null
    and public_image_path is null
    and pledge_donation_url is null
    and pledge_widget_id is null
    and pledge_mapping_key is null
    and total_votes = 0
    and manual_vote_adjustment = 0
  );
