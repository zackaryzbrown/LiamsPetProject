-- =====================================================================
-- One-off: backfill vote-credit wallet for entry donations that
-- processed BEFORE the vote_credit_ledger table existed.
--
-- Rule: every entry donation over $10 should have left the donor with
-- (amount - 1000) cents of spendable credit. The webhook does this
-- going forward; this migration covers the historical rows.
--
-- Safe to re-run thanks to the not-exists guard.
-- =====================================================================

insert into public.vote_credit_ledger (user_id, delta_cents, source_donation_id, reason)
select di.user_id,
       pd.amount_cents - 1000,
       pd.id,
       'entry_overage_backfill'
from public.pledge_donations pd
join public.donation_intents di
  on di.consumed_donation_id = pd.id
where pd.donation_type = 'entry'
  and pd.amount_cents > 1000
  and di.user_id is not null
  and not exists (
    select 1
    from public.vote_credit_ledger l
    where l.source_donation_id = pd.id
  );
