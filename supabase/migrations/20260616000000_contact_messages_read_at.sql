-- =====================================================================
-- contact_messages.read_at
--
-- Tracks when an admin has viewed inbound messages. Used to badge the
-- admin nav with an unread count. Marked automatically when the
-- /admin/messages page loads.
-- =====================================================================
alter table public.contact_messages
  add column if not exists read_at timestamptz;

create index if not exists contact_messages_read_at_idx
  on public.contact_messages (read_at)
  where read_at is null;
