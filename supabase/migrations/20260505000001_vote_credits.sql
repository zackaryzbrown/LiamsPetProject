-- =====================================================================
-- Vote credits + allocations
--
-- Adds two columns to vote_transactions so a single donation can produce
-- a "credit pool" attributed to a user (pet_submission_id = NULL) which
-- the user later splits into per-pet allocation rows whose
-- parent_transaction_id points back at the original credit.
--
-- Existing direct-to-pet rows (pet_submission_id set, parent_transaction_id
-- NULL) are unchanged and still count for that pet's leaderboard.
--
-- Cardinality model:
--   credit row:      pet_submission_id IS NULL, parent_transaction_id IS NULL,
--                    donor_user_id = the supporter
--   direct-to-pet:   pet_submission_id = pet, parent_transaction_id IS NULL
--   allocation row:  pet_submission_id = pet, parent_transaction_id = credit row
--
-- Total raised = sum(amount_cents) where parent_transaction_id IS NULL
-- Pet votes/$ = sum(votes/amount) where pet_submission_id = pet
-- =====================================================================

alter table public.vote_transactions
  add column if not exists donor_user_id        uuid references auth.users(id) on delete set null,
  add column if not exists parent_transaction_id uuid references public.vote_transactions(id) on delete cascade;

create index if not exists vote_transactions_donor_user_idx
  on public.vote_transactions (donor_user_id)
  where donor_user_id is not null;

create index if not exists vote_transactions_parent_idx
  on public.vote_transactions (parent_transaction_id)
  where parent_transaction_id is not null;

-- Retro-fix: existing 'entry' transactions were written as votes-on-the-pet.
-- The new model stores them as CREDITS to the owner so they decide which pet
-- (theirs or someone else's) the votes go toward. Convert in place.
update public.vote_transactions vt
set
  donor_user_id = ps.user_id,
  pet_submission_id = null
from public.pet_submissions ps
where vt.kind = 'entry'
  and vt.pet_submission_id = ps.id
  and vt.parent_transaction_id is null;

