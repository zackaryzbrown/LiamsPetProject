-- =====================================================================
-- Centralize Pledge donation processing in one DB transaction
--
-- This replaces the previous multi-step webhook/reconciliation flow
-- where the donation row, wallet ledger, vote totals, entry status, and
-- event log could diverge if any single write failed after the initial
-- upsert.
-- =====================================================================

create or replace function public.process_pledge_donation(
  p_pledge_event_id text,
  p_event_type text,
  p_signature_verified boolean,
  p_raw_payload jsonb,
  p_raw_headers jsonb,
  p_pet_submission_id uuid,
  p_matched_intent_id uuid,
  p_pledge_transaction_id text,
  p_pledge_campaign_id text,
  p_pledge_widget_id text,
  p_pledge_fundraiser_id text,
  p_pledge_mapping_key text,
  p_donor_name text,
  p_donor_email citext,
  p_amount_cents integer,
  p_tip_cents integer,
  p_fee_cents integer,
  p_currency text,
  p_error_message text default null
) returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_now timestamptz := now();
  v_effective_pet_id uuid := p_pet_submission_id;
  v_pet public.pet_submissions%rowtype;
  v_existing public.pledge_donations%rowtype;
  v_donation public.pledge_donations%rowtype;
  v_intent public.donation_intents%rowtype;
  v_has_general_credit boolean := false;
  v_vote_credits integer := 0;
  v_tip_cents integer := greatest(coalesce(p_tip_cents, 0), 0);
  v_fee_cents integer := greatest(coalesce(p_fee_cents, 0), 0);
  v_currency text := coalesce(nullif(btrim(p_currency), ''), 'USD');
  v_donation_type public.pledge_donation_type := 'unknown';
  v_processing_status public.pledge_webhook_status := 'unmapped';
  v_is_entry boolean := false;
  v_intent_user_id uuid := null;
  v_voter_user_id uuid := null;
  v_deduped boolean := false;
begin
  if auth.role() <> 'service_role' then
    raise exception 'service role required';
  end if;
  if p_pledge_event_id is null or btrim(p_pledge_event_id) = '' then
    raise exception 'pledge_event_id required';
  end if;
  if p_amount_cents is null or p_amount_cents < 0 then
    raise exception 'amount_cents must be >= 0';
  end if;

  if v_effective_pet_id is not null then
    select *
      into v_pet
      from public.pet_submissions
     where id = v_effective_pet_id
     for update;
    if v_pet.id is null then
      raise exception 'pet not found';
    end if;
    v_is_entry := not v_pet.entry_donation_confirmed;
  end if;

  if v_is_entry then
    v_donation_type := 'entry';
    v_vote_credits := 0;
  elsif v_effective_pet_id is not null then
    v_donation_type := 'vote';
    v_vote_credits := floor(p_amount_cents / 100.0);
  elsif p_event_type is not null and btrim(p_event_type) <> '' then
    v_donation_type := 'general';
    v_vote_credits := floor(p_amount_cents / 100.0);
  else
    v_donation_type := 'unknown';
    v_vote_credits := 0;
  end if;

  select *
    into v_existing
    from public.pledge_donations
   where pledge_event_id = p_pledge_event_id
      or (
        p_pledge_transaction_id is not null
        and pledge_transaction_id = p_pledge_transaction_id
      )
   limit 1
   for update;

  if v_existing.id is not null then
    if v_existing.pet_submission_id is not null or v_effective_pet_id is null then
      v_donation := v_existing;
      v_deduped := true;
      v_effective_pet_id := coalesce(v_effective_pet_id, v_existing.pet_submission_id);
      v_processing_status := case
        when v_effective_pet_id is null then 'unmapped'
        else 'processed'
      end;
    else
      select exists (
        select 1
          from public.vote_credit_ledger
         where source_donation_id = v_existing.id
           and reason = 'general_donation'
      )
        into v_has_general_credit;
      if v_has_general_credit then
        raise exception
          'cannot reconcile donation that was already credited as a general donation';
      end if;

      update public.pledge_donations
         set pet_submission_id     = v_effective_pet_id,
             pledge_transaction_id = coalesce(p_pledge_transaction_id, pledge_transaction_id),
             pledge_campaign_id    = coalesce(p_pledge_campaign_id, pledge_campaign_id),
             pledge_widget_id      = coalesce(p_pledge_widget_id, pledge_widget_id),
             pledge_fundraiser_id  = coalesce(p_pledge_fundraiser_id, pledge_fundraiser_id),
             pledge_mapping_key    = coalesce(p_pledge_mapping_key, pledge_mapping_key),
             donor_name            = coalesce(p_donor_name, donor_name),
             donor_email           = coalesce(p_donor_email, donor_email),
             amount_cents          = p_amount_cents,
             tip_cents             = v_tip_cents,
             fee_cents             = v_fee_cents,
             currency              = upper(v_currency),
             vote_credits          = v_vote_credits,
             donation_type         = v_donation_type,
             raw_payload           = coalesce(p_raw_payload, raw_payload),
             processed_at          = v_now
       where id = v_existing.id
       returning * into v_donation;
    end if;
  end if;

  if v_donation.id is null then
    insert into public.pledge_donations (
      pet_submission_id,
      pledge_event_id,
      pledge_transaction_id,
      pledge_campaign_id,
      pledge_widget_id,
      pledge_fundraiser_id,
      pledge_mapping_key,
      donor_name,
      donor_email,
      amount_cents,
      tip_cents,
      fee_cents,
      currency,
      vote_credits,
      donation_type,
      raw_payload,
      processed_at
    ) values (
      v_effective_pet_id,
      p_pledge_event_id,
      p_pledge_transaction_id,
      p_pledge_campaign_id,
      p_pledge_widget_id,
      p_pledge_fundraiser_id,
      p_pledge_mapping_key,
      p_donor_name,
      p_donor_email,
      p_amount_cents,
      v_tip_cents,
      v_fee_cents,
      upper(v_currency),
      v_vote_credits,
      v_donation_type,
      coalesce(p_raw_payload, '{}'::jsonb),
      v_now
    )
    on conflict (pledge_event_id) do nothing
    returning * into v_donation;

    if v_donation.id is null then
      select *
        into v_donation
        from public.pledge_donations
       where pledge_event_id = p_pledge_event_id
          or (
            p_pledge_transaction_id is not null
            and pledge_transaction_id = p_pledge_transaction_id
          )
       limit 1
       for update;
      v_deduped := true;
      v_effective_pet_id := coalesce(v_effective_pet_id, v_donation.pet_submission_id);
      v_processing_status := case
        when v_effective_pet_id is null then 'unmapped'
        else 'processed'
      end;
    end if;
  end if;

  if not v_deduped then
    if p_matched_intent_id is not null then
      update public.donation_intents
         set consumed_at = v_now,
             consumed_donation_id = v_donation.id
       where id = p_matched_intent_id
         and consumed_at is null
         and expires_at > v_now
         and (v_effective_pet_id is null or pet_submission_id = v_effective_pet_id)
       returning * into v_intent;
      v_intent_user_id := v_intent.user_id;
    end if;

    if v_intent_user_id is null and v_is_entry and v_effective_pet_id is not null then
      update public.donation_intents
         set consumed_at = coalesce(consumed_at, v_now),
             consumed_donation_id = coalesce(consumed_donation_id, v_donation.id)
       where id = (
         select di.id
           from public.donation_intents di
          where di.pet_submission_id = v_effective_pet_id
            and di.intent_type = 'entry'
            and di.user_id is not null
          order by di.created_at desc
          limit 1
       )
       returning * into v_intent;
      v_intent_user_id := v_intent.user_id;
    end if;

    if v_intent_user_id is not null then
      v_voter_user_id := v_intent_user_id;
    elsif p_donor_email is not null then
      select id
        into v_voter_user_id
        from auth.users
       where lower(email) = lower(p_donor_email::text)
       limit 1;
    end if;

    if v_is_entry and v_intent_user_id is not null and p_amount_cents > 1000 then
      insert into public.vote_credit_ledger (
        user_id,
        delta_cents,
        source_donation_id,
        reason
      ) values (
        v_intent_user_id,
        p_amount_cents - 1000,
        v_donation.id,
        'entry_overage'
      );
    end if;

    if v_effective_pet_id is null and p_amount_cents > 0 and v_voter_user_id is not null then
      insert into public.vote_credit_ledger (
        user_id,
        delta_cents,
        source_donation_id,
        reason
      ) values (
        v_voter_user_id,
        p_amount_cents,
        v_donation.id,
        'general_donation'
      );
    end if;

    if v_effective_pet_id is not null and p_amount_cents > 0 then
      if not v_is_entry and v_voter_user_id is not null then
        insert into public.vote_credit_ledger (
          user_id,
          delta_cents,
          source_donation_id,
          reason
        ) values (
          v_voter_user_id,
          p_amount_cents,
          v_donation.id,
          'donation_vote'
        );

        insert into public.vote_credit_ledger (
          user_id,
          delta_cents,
          source_donation_id,
          pet_submission_id,
          reason
        ) values (
          v_voter_user_id,
          -p_amount_cents,
          v_donation.id,
          v_effective_pet_id,
          'auto_spend'
        );
      end if;

      update public.pet_submissions
         set total_votes = greatest(
               0,
               total_votes + case when v_is_entry then 0 else v_vote_credits end
             ),
             total_donated_cents = greatest(0, total_donated_cents + p_amount_cents)
       where id = v_effective_pet_id;

      if v_is_entry then
        update public.pet_submissions
           set entry_donation_confirmed   = true,
               entry_pledge_transaction_id = coalesce(
                 p_pledge_transaction_id,
                 p_pledge_event_id
               ),
               status = case
                 when status = 'pending_payment' then 'pending_review'
                 else status
               end
         where id = v_effective_pet_id;
      end if;
    end if;
  end if;

  v_processing_status := case
    when v_effective_pet_id is null then 'unmapped'
    else 'processed'
  end;

  insert into public.pledge_webhook_events (
    pledge_event_id,
    event_type,
    signature_verified,
    processing_status,
    pet_submission_id,
    donation_id,
    error_message,
    raw_payload,
    raw_headers,
    processed_at
  ) values (
    p_pledge_event_id,
    p_event_type,
    coalesce(p_signature_verified, false),
    v_processing_status,
    v_effective_pet_id,
    v_donation.id,
    p_error_message,
    coalesce(p_raw_payload, '{}'::jsonb),
    coalesce(p_raw_headers, '{}'::jsonb),
    v_now
  )
  on conflict (pledge_event_id) do update
    set event_type = excluded.event_type,
        signature_verified = excluded.signature_verified,
        processing_status = excluded.processing_status,
        pet_submission_id = excluded.pet_submission_id,
        donation_id = excluded.donation_id,
        error_message = excluded.error_message,
        raw_payload = excluded.raw_payload,
        raw_headers = excluded.raw_headers,
        processed_at = excluded.processed_at;

  return jsonb_build_object(
    'donation_id', v_donation.id,
    'pet_submission_id', v_effective_pet_id,
    'processing_status', v_processing_status,
    'donation_type', v_donation.donation_type,
    'vote_credits', v_donation.vote_credits,
    'deduped', v_deduped
  );
end;
$$;

revoke all on function public.process_pledge_donation(
  text,
  text,
  boolean,
  jsonb,
  jsonb,
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  citext,
  integer,
  integer,
  integer,
  text,
  text
) from public;

grant execute on function public.process_pledge_donation(
  text,
  text,
  boolean,
  jsonb,
  jsonb,
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  citext,
  integer,
  integer,
  integer,
  text,
  text
) to service_role;

