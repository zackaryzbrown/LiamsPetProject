-- =====================================================================
-- One-off: backfill vote-credit wallet for general fundraiser donations
-- (donations with no pet_submission_id) made BEFORE the webhook
-- credited them.
--
-- Matches the donor_email to an auth.users row and inserts the full
-- amount as a positive ledger row. Idempotent via not-exists.
-- =====================================================================

insert into public.vote_credit_ledger (user_id, delta_cents, source_donation_id, reason)
select u.id,
       pd.amount_cents,
       pd.id,
       'general_donation_backfill'
from public.pledge_donations pd
join auth.users u on lower(u.email) = lower(pd.donor_email)
where pd.pet_submission_id is null
  and pd.amount_cents > 0
  and pd.donor_email is not null
  and not exists (
    select 1
    from public.vote_credit_ledger l
    where l.source_donation_id = pd.id
  );
