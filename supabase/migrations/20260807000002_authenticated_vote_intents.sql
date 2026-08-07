-- =====================================================================
-- Authenticated vote-intent inserts
--
-- Vote donations now start from a signed internal redirect flow so the
-- app can mint a short-lived mapping token and bind the intent to a
-- verified account email. Entry intents are also inserted under the
-- owner's authenticated session.
-- =====================================================================

drop policy if exists donation_intents_insert_authenticated on public.donation_intents;
create policy donation_intents_insert_authenticated
  on public.donation_intents
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and donor_email is not null
    and intent_type in ('entry', 'vote')
  );
