-- =====================================================================
-- contact_messages
--
-- Persists inbound contact-form submissions. Inserted via the
-- service-role server action (anyone can submit a message, no auth
-- required), readable only by admins.
-- =====================================================================
create table if not exists public.contact_messages (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  email       citext not null,
  subject     text,
  message     text not null,
  user_agent  text,
  ip          inet,
  created_at  timestamptz not null default now()
);

create index if not exists contact_messages_created_at_idx
  on public.contact_messages (created_at desc);

alter table public.contact_messages enable row level security;

-- No public policies: inserts go through the service-role server
-- action (anyone can submit a message), reads happen in the admin
-- dashboard via the service-role client. RLS therefore denies all
-- direct client access by default, which is what we want.
