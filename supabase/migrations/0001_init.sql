-- =====================================================================
-- Soul Dog Rescue Pet Photo Contest — Initial schema
-- Tables, enums, indexes, view, functions, triggers
-- RLS policies live in 0002_rls.sql; storage in 0003_storage.sql
-- =====================================================================

create extension if not exists "pgcrypto";
create extension if not exists "citext";

-- ---------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------
do $$ begin
  create type public.submission_status as enum (
    'pending_payment',  -- row created, awaiting Givebutter entry donation webhook
    'pending_review',   -- entry donation confirmed, awaiting admin review
    'approved',         -- visible publicly, eligible for votes
    'rejected'          -- rejected by admin
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.user_role as enum ('user', 'admin');
exception when duplicate_object then null; end $$;

do $$ begin
  -- 'entry' = $10 minimum entry donation (also counts as votes per spec, $1 = 1 vote)
  -- 'vote'  = post-approval donation routed to a pet's Givebutter member URL
  -- 'manual'= admin-entered correction (no Givebutter transaction)
  create type public.vote_kind as enum ('entry', 'vote', 'manual');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- profiles  (1:1 with auth.users)
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       citext not null,
  full_name   text,
  role        public.user_role not null default 'user',
  created_at  timestamptz not null default now()
);

create index if not exists profiles_email_idx on public.profiles (email);
create index if not exists profiles_role_idx  on public.profiles (role);

-- ---------------------------------------------------------------------
-- pet_submissions
-- Note: total_votes is intentionally NOT denormalized. Use the
-- pet_leaderboard view (sums vote_transactions) as the source of truth.
-- ---------------------------------------------------------------------
create table if not exists public.pet_submissions (
  id                          uuid primary key default gen_random_uuid(),
  user_id                     uuid not null references auth.users(id) on delete restrict,
  owner_name                  text not null,
  owner_email                 citext not null,
  owner_phone                 text,
  pet_name                    text not null,
  -- Storage paths. image_path lives in private bucket; public_image_path
  -- is populated by the approval action after copying into the public bucket.
  image_path                  text not null,                  -- pet-uploads/<user_id>/<submission_id>.<ext>
  public_image_path           text,                           -- pet-public/<submission_id>.<ext>
  consent_public_display      boolean not null default false,
  acknowledged_nonrefundable  boolean not null default false,
  status                      public.submission_status not null default 'pending_payment',
  entry_donation_confirmed    boolean not null default false,
  givebutter_member_url       text,                           -- per-pet peer-to-peer URL
  givebutter_member_id        text,                           -- TODO: confirm Givebutter member identifier shape
  rejection_reason            text,
  created_at                  timestamptz not null default now(),
  approved_at                 timestamptz,
  rejected_at                 timestamptz,
  constraint pet_submissions_pet_name_len check (char_length(pet_name) between 1 and 80),
  constraint pet_submissions_owner_name_len check (char_length(owner_name) between 1 and 120)
);

create index if not exists pet_submissions_user_idx        on public.pet_submissions (user_id);
create index if not exists pet_submissions_status_idx      on public.pet_submissions (status);
create index if not exists pet_submissions_approved_at_idx on public.pet_submissions (approved_at);
create unique index if not exists pet_submissions_member_id_uq
  on public.pet_submissions (givebutter_member_id) where givebutter_member_id is not null;

-- ---------------------------------------------------------------------
-- vote_transactions
-- Single source of truth for votes & donation totals. Idempotent via
-- unique givebutter_transaction_id. Manual adjustments use a synthetic
-- id like 'manual:<uuid>'.
-- ---------------------------------------------------------------------
create table if not exists public.vote_transactions (
  id                        uuid primary key default gen_random_uuid(),
  pet_submission_id         uuid references public.pet_submissions(id) on delete set null,
  givebutter_transaction_id text not null unique,
  kind                      public.vote_kind not null default 'vote',
  donor_name                text,
  donor_email               citext,
  amount_cents              integer not null check (amount_cents >= 0),
  votes                     integer not null check (votes >= 0),
  raw_payload               jsonb not null default '{}'::jsonb,
  created_by_admin          uuid references auth.users(id),  -- non-null only for kind='manual'
  note                      text,
  created_at                timestamptz not null default now()
);

create index if not exists vote_transactions_pet_idx     on public.vote_transactions (pet_submission_id);
create index if not exists vote_transactions_kind_idx    on public.vote_transactions (kind);
create index if not exists vote_transactions_created_idx on public.vote_transactions (created_at desc);

-- ---------------------------------------------------------------------
-- webhook_events_raw
-- Every inbound Givebutter webhook is logged here BEFORE processing
-- for auditing, replay, and reconciliation of unmatched payloads.
-- ---------------------------------------------------------------------
create table if not exists public.webhook_events_raw (
  id                uuid primary key default gen_random_uuid(),
  source            text not null default 'givebutter',
  event_type        text,
  signature_valid   boolean not null,
  matched           boolean not null default false,
  pet_submission_id uuid references public.pet_submissions(id) on delete set null,
  payload           jsonb not null,
  error             text,
  received_at       timestamptz not null default now()
);

create index if not exists webhook_events_unmatched_idx
  on public.webhook_events_raw (received_at desc) where matched = false;

-- ---------------------------------------------------------------------
-- contest_settings (single-row table)
-- ---------------------------------------------------------------------
create table if not exists public.contest_settings (
  id                  smallint primary key default 1,
  contest_open        boolean not null default true,
  submission_deadline timestamptz not null default '2026-11-13 23:59:00-07',
  voting_deadline     timestamptz not null default '2026-11-13 23:59:00-07',
  goal_amount_cents   integer not null default 50000 check (goal_amount_cents >= 0),
  updated_at          timestamptz not null default now(),
  constraint contest_settings_singleton check (id = 1)
);

insert into public.contest_settings (id) values (1) on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- Leaderboard view: approved pets with summed votes, ordered desc.
-- ---------------------------------------------------------------------
create or replace view public.pet_leaderboard
with (security_invoker = true) as
select
  p.id,
  p.pet_name,
  p.owner_name,
  p.public_image_path,
  p.givebutter_member_url,
  p.approved_at,
  coalesce(sum(v.votes), 0)::integer        as total_votes,
  coalesce(sum(v.amount_cents), 0)::integer as total_amount_cents
from public.pet_submissions p
left join public.vote_transactions v on v.pet_submission_id = p.id
where p.status = 'approved'
group by p.id
order by total_votes desc, p.approved_at asc;

-- ---------------------------------------------------------------------
-- Helper: is_admin(uid) — used by RLS policies
-- ---------------------------------------------------------------------
create or replace function public.is_admin(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles where id = uid and role = 'admin'
  );
$$;

revoke all on function public.is_admin(uuid) from public;
grant execute on function public.is_admin(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------
-- Trigger: when a new auth.users row is created, ensure a profiles row
-- exists. Admin promotion is performed by the Next.js auth callback
-- using the ADMIN_EMAILS env allowlist via promote_admin_by_email().
-- ---------------------------------------------------------------------
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

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- promote_admin_by_email — invoked from the server (service role) at
-- sign-in if the email is in ADMIN_EMAILS. Idempotent.
-- ---------------------------------------------------------------------
create or replace function public.promote_admin_by_email(p_email citext)
returns void
language sql
security definer
set search_path = public
as $$
  update public.profiles set role = 'admin' where email = p_email and role <> 'admin';
$$;

revoke all on function public.promote_admin_by_email(citext) from public;
-- Only the service role should call this.
grant execute on function public.promote_admin_by_email(citext) to service_role;

-- ---------------------------------------------------------------------
-- updated_at maintenance for contest_settings
-- ---------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists contest_settings_touch on public.contest_settings;
create trigger contest_settings_touch
  before update on public.contest_settings
  for each row execute function public.touch_updated_at();
