-- An entry may only be confirmed after a qualifying $10 donation. This
-- protects the contest rule even if the checkout amount is altered upstream.
create or replace function public.enforce_entry_donation_minimum()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.entry_donation_confirmed
     and not coalesce(old.entry_donation_confirmed, false)
     and not exists (
       select 1
         from public.pledge_donations
        where pet_submission_id = new.id
          and donation_type = 'entry'
          and amount_cents >= 1000
     ) then
    raise exception 'a $10.00 minimum donation is required to confirm an entry';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_entry_donation_minimum on public.pet_submissions;
create trigger enforce_entry_donation_minimum
  before update of entry_donation_confirmed on public.pet_submissions
  for each row execute function public.enforce_entry_donation_minimum();

revoke all on function public.enforce_entry_donation_minimum() from public;