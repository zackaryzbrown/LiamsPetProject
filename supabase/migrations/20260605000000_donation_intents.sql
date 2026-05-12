-- =====================================================================
-- donation_intents
--
-- Records a user's intent to donate to a specific pet before they
-- bounce out to Pledge.to. The webhook uses these rows as a mapping
-- signal of last resort: when an incoming donation has no
-- submission_id / utm_content / mapping_key / widget_id / campaign_id
-- to bind it to a pet, we look up the most recent unconsumed intent
-- with a matching donor email created within the lookback window.
--
-- Rows expire after 60 minutes by default. Consumed rows are kept for
-- auditability but ignored by future lookups.
-- =====================================================================
create table if not exists public.donation_intents (
  id                  uuid primary key default gen_random_uuid(),
  pet_submission_id   uuid not null references public.pet_submissions(id) on delete cascade,
  -- User who clicked through. May be null for anonymous voters.
  user_id             uuid references auth.users(id) on delete set null,
  -- The email we expect to see on the incoming Pledge donation.
  -- Stored case-insensitively via citext.
  donor_email         citext,
  intent_type         text not null check (intent_type in ('entry', 'vote')),
  created_at          timestamptz not null default now(),
  expires_at          timestamptz not null default (now() + interval '60 minutes'),
  -- Marked when a webhook matches this intent to a Pledge donation.
  consumed_at         timestamptz,
  consumed_donation_id uuid references public.pledge_donations(id) on delete set null
);

create index if not exists donation_intents_email_active_idx
  on public.donation_intents (donor_email, created_at desc)
  where consumed_at is null;

create index if not exists donation_intents_pet_idx
  on public.donation_intents (pet_submission_id, created_at desc);

alter table public.donation_intents enable row level security;

-- Service-role-only writes; reads are needed by the webhook (admin) and
-- optionally by the owner of the intent for a future "we're matching
-- your donation" UI. Anonymous reads are blocked.
drop policy if exists donation_intents_select_self on public.donation_intents;
create policy donation_intents_select_self
  on public.donation_intents for select
  using (
    auth.role() = 'service_role'
    or (auth.uid() is not null and user_id = auth.uid())
  );

drop policy if exists donation_intents_no_public_writes on public.donation_intents;
create policy donation_intents_no_public_writes
  on public.donation_intents for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
