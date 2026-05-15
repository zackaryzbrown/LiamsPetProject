import { createAdminClient } from "@/lib/supabase/admin";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export default async function AdminMessagesPage() {
  const admin = createAdminClient();
  const { data: messages, error } = await admin
    .from("contact_messages")
    .select("id, name, email, subject, message, user_agent, ip, created_at, read_at")
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) {
    return (
      <section className="grid gap-3">
        <h1 className="font-display text-3xl font-black">Messages</h1>
        <p className="rounded-xl border-2 border-ember-500 bg-ember-50 px-4 py-3 text-sm text-ember-700">
          {error.message}
          {error.message.toLowerCase().includes("relation") && (
            <>
              {" "}
              — the <code>contact_messages</code> table doesn&apos;t exist yet.
              Apply the migration <code>20260615000000_contact_messages.sql</code>
              {" "}in Supabase.
            </>
          )}
        </p>
      </section>
    );
  }

  const rows = messages ?? [];
  const unreadIds = rows.filter((m) => !m.read_at).map((m) => m.id);

  // Auto-mark everything visible as read. Fire-and-forget: render the
  // page with the *current* read state (so the user can still see which
  // rows were unread when they landed), but clear the badge for next
  // navigation.
  if (unreadIds.length > 0) {
    await admin
      .from("contact_messages")
      .update({ read_at: new Date().toISOString() })
      .in("id", unreadIds);
  }

  return (
    <section className="grid gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow text-royal-700">Admin</p>
          <h1 className="font-display text-3xl md:text-4xl font-black tracking-tight">
            Messages
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            Inbound contact-form submissions. Newest first.
          </p>
        </div>
        <Badge tone="cream">
          {rows.length} {rows.length === 1 ? "message" : "messages"}
        </Badge>
      </header>

      {rows.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-ink bg-cream-100 p-8 text-center">
          <p className="font-display text-xl font-black">No messages yet.</p>
          <p className="mt-1 text-sm text-ink-muted">
            Anything submitted at <code>/contact</code> will show up here.
          </p>
        </div>
      ) : (
        <ul className="grid gap-3">
          {rows.map((m) => {
            const when = m.created_at
              ? new Date(m.created_at).toLocaleString()
              : "—";
            const wasUnread = !m.read_at;
            return (
              <li
                key={m.id}
                className={
                  "rounded-2xl border-2 border-ink bg-white p-5 shadow-card-sm" +
                  (wasUnread ? " ring-2 ring-ember-500/60" : "")
                }
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div>
                    <p className="font-display text-lg font-black flex items-center gap-2">
                      {wasUnread && (
                        <span
                          aria-label="Unread"
                          className="inline-block h-2 w-2 rounded-full bg-ember-500"
                        />
                      )}
                      {m.subject?.trim() || "(no subject)"}
                    </p>
                    <p className="text-sm text-ink-muted">
                      <span className="font-semibold text-ink">{m.name}</span>{" "}
                      &middot;{" "}
                      <a
                        className="underline decoration-dotted underline-offset-2"
                        href={`mailto:${m.email}?subject=Re:%20${encodeURIComponent(
                          m.subject || "your message",
                        )}`}
                      >
                        {m.email}
                      </a>
                    </p>
                  </div>
                  <p className="text-xs text-ink-muted whitespace-nowrap">
                    {when}
                  </p>
                </div>
                <p className="mt-3 whitespace-pre-wrap text-sm">{m.message}</p>
                {(m.user_agent || m.ip) && (
                  <details className="mt-3 text-xs text-ink-muted">
                    <summary className="cursor-pointer select-none">
                      Metadata
                    </summary>
                    <dl className="mt-2 grid gap-1">
                      {m.ip && (
                        <div>
                          <dt className="inline font-semibold">IP: </dt>
                          <dd className="inline">{String(m.ip)}</dd>
                        </div>
                      )}
                      {m.user_agent && (
                        <div>
                          <dt className="inline font-semibold">User agent: </dt>
                          <dd className="inline break-all">{m.user_agent}</dd>
                        </div>
                      )}
                    </dl>
                  </details>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
