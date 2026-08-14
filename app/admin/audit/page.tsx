import Link from "next/link";
import { AuditAction } from "@/lib/types";
import { redirect } from "next/navigation";
import { requireAdminProfile } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { cleanText } from "@/lib/security";

type Metadata = Record<string, unknown> | null;

const PAGE_SIZE = 25;
const AUDIT_ACTIONS = Object.values(AuditAction);

type Props = {
  searchParams: Promise<{
    page?: string;
    q?: string;
    action?: string;
    actorUserId?: string;
    profileId?: string;
    from?: string;
    to?: string;
  }>;
};

function parseAction(value?: string) {
  if (!value || value === "ALL") {
    return null;
  }

  if (AUDIT_ACTIONS.includes(value as AuditAction)) {
    return value as AuditAction;
  }

  return null;
}

function parseDateInput(value: string | undefined, endOfDay = false) {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return null;
  }

  const isoSuffix = endOfDay ? "T23:59:59.999Z" : "T00:00:00.000Z";
  const parsed = new Date(`${trimmed}${isoSuffix}`);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

function formatMetadata(metadata: Metadata) {
  if (metadata === null || metadata === undefined) {
    return "";
  }

  try {
    return JSON.stringify(metadata, null, 2);
  } catch {
    return String(metadata);
  }
}

export default async function AdminAuditPage({ searchParams }: Props) {
  const profile = await requireAdminProfile();

  if (!profile) {
    redirect("/");
  }

  const params = await searchParams;
  const rawPage = Number(params.page ?? "1");
  const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;
  const q = cleanText(params.q ?? "", 100);
  const action = parseAction(params.action);
  const actorUserId = cleanText(params.actorUserId ?? "", 80);
  const profileId = cleanText(params.profileId ?? "", 80);
  const fromDate = parseDateInput(params.from);
  const toDate = parseDateInput(params.to, true);

  // Build Supabase query
  let query = supabase
    .from("audit_logs")
    .select(`
      *,
      profile:user_profiles (id, email, full_name)
    `, { count: "exact" });
  
  // Apply filters
  if (action) {
    query = query.eq("action", action);
  }
  if (actorUserId) {
    query = query.ilike("actor_user_id", `%${actorUserId}%`);
  }
  if (profileId) {
    query = query.ilike("profile_id", `%${profileId}%`);
  }
  if (fromDate) {
    query = query.gte("created_at", fromDate.toISOString());
  }
  if (toDate) {
    query = query.lte("created_at", toDate.toISOString());
  }
  
  // Apply search filters
  if (q) {
    query = query.or(`target.ilike.%${q}%,ip_address.ilike.%${q}%`);
  }
  
  // Apply pagination
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;
  query = query.range(from, to).order("created_at", { ascending: false });
  
  const { data: logsData, error } = await query;
  const logs = logsData ?? [];
  
  // Get total count separately
  let countQuery = supabase.from("audit_logs").select("*", { count: "exact", head: true });
  if (action) {
    countQuery = countQuery.eq("action", action);
  }
  if (actorUserId) {
    countQuery = countQuery.ilike("actor_user_id", `%${actorUserId}%`);
  }
  if (profileId) {
    countQuery = countQuery.ilike("profile_id", `%${profileId}%`);
  }
  if (fromDate) {
    countQuery = countQuery.gte("created_at", fromDate.toISOString());
  }
  if (toDate) {
    countQuery = countQuery.lte("created_at", toDate.toISOString());
  }
  if (q) {
    countQuery = countQuery.or(`target.ilike.%${q}%,ip_address.ilike.%${q}%`);
  }
  
  const { count: totalCount } = await countQuery;
  const total = totalCount ?? 0;

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const previousPage = Math.max(1, page - 1);
  const nextPage = Math.min(totalPages, page + 1);

  const toPageHref = (targetPage: number) => {
    const next = new URLSearchParams();
    if (q) next.set("q", q);
    if (params.action) next.set("action", params.action);
    if (actorUserId) next.set("actorUserId", actorUserId);
    if (profileId) next.set("profileId", profileId);
    if (params.from) next.set("from", params.from);
    if (params.to) next.set("to", params.to);
    next.set("page", String(targetPage));
    return `/admin/audit?${next.toString()}`;
  };

  return (
    <div className="mx-auto max-w-7xl px-4 pb-10 pt-28">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-black text-zinc-900">Audit Logs</h1>
        <Link
          href="/admin"
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-100"
        >
          Back to Admin
        </Link>
      </div>

      <form className="mb-5 grid gap-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-6">
        <label className="text-sm font-semibold text-zinc-700 lg:col-span-2">
          Search
          <input
            name="q"
            defaultValue={q}
            placeholder="Action, actor, target, email..."
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          />
        </label>

        <label className="text-sm font-semibold text-zinc-700">
          Action
          <select name="action" defaultValue={params.action ?? "ALL"} className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm">
            <option value="ALL">All</option>
            {AUDIT_ACTIONS.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm font-semibold text-zinc-700">
          Actor User ID
          <input
            name="actorUserId"
            defaultValue={actorUserId}
            placeholder="clerk user id"
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          />
        </label>

        <label className="text-sm font-semibold text-zinc-700">
          Profile ID
          <input
            name="profileId"
            defaultValue={profileId}
            placeholder="profile id"
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          />
        </label>

        <div className="grid gap-3 sm:grid-cols-2 lg:col-span-6 lg:grid-cols-[1fr_1fr_auto_auto]">
          <label className="text-sm font-semibold text-zinc-700">
            From
            <input name="from" defaultValue={params.from ?? ""} type="date" className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm" />
          </label>
          <label className="text-sm font-semibold text-zinc-700">
            To
            <input name="to" defaultValue={params.to ?? ""} type="date" className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm" />
          </label>
          <button
            type="submit"
            className="h-fit self-end rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            Apply Filters
          </button>
          <Link
            href="/admin/audit"
            className="h-fit self-end rounded-lg border border-zinc-300 px-4 py-2 text-center text-sm font-semibold text-zinc-700 hover:bg-zinc-100"
          >
            Clear
          </Link>
        </div>
      </form>

      <p className="mb-3 text-sm text-zinc-600">
        Showing {logs.length} of {total} entries
      </p>

      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-600">
            <tr>
              <th className="px-3 py-3">Time</th>
              <th className="px-3 py-3">Action</th>
              <th className="px-3 py-3">Actor</th>
              <th className="px-3 py-3">Profile</th>
              <th className="px-3 py-3">Target</th>
              <th className="px-3 py-3">Metadata</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-zinc-500">
                  No audit entries found for current filters.
                </td>
              </tr>
            ) : (
              logs.map((log: any) => {
                const metadata = formatMetadata(log.metadata as Metadata);
                return (
                  <tr key={log.id} className="border-t border-zinc-100 align-top">
                    <td className="whitespace-nowrap px-3 py-3 text-zinc-700">{new Date(log.created_at).toLocaleString()}</td>
                    <td className="px-3 py-3 font-semibold text-zinc-900">{log.action}</td>
                    <td className="px-3 py-3 text-zinc-700">
                      {log.actor_user_id ?? "N/A"}
                      {log.ip_address ? <p className="text-xs text-zinc-500">IP: {log.ip_address}</p> : null}
                    </td>
                    <td className="px-3 py-3 text-zinc-700">
                      {log.profile?.full_name ?? log.profile?.email ?? log.profile_id ?? "N/A"}
                    </td>
                    <td className="px-3 py-3 text-zinc-700">{log.target ?? "N/A"}</td>
                    <td className="px-3 py-3 text-zinc-700">
                      {metadata ? (
                        <details>
                          <summary className="cursor-pointer text-emerald-700">View</summary>
                          <pre className="mt-2 max-w-lg overflow-x-auto whitespace-pre-wrap rounded bg-zinc-100 p-2 text-xs">
                            {metadata}
                          </pre>
                        </details>
                      ) : (
                        "N/A"
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-end gap-2">
        <Link
          href={toPageHref(previousPage)}
          aria-disabled={page <= 1}
          className={`rounded-lg border border-zinc-300 px-3 py-1 text-sm ${page <= 1 ? "pointer-events-none opacity-50" : "hover:bg-zinc-100"}`}
        >
          Previous
        </Link>
        <span className="text-sm text-zinc-600">
          Page {page} / {totalPages}
        </span>
        <Link
          href={toPageHref(nextPage)}
          aria-disabled={page >= totalPages}
          className={`rounded-lg border border-zinc-300 px-3 py-1 text-sm ${page >= totalPages ? "pointer-events-none opacity-50" : "hover:bg-zinc-100"}`}
        >
          Next
        </Link>
      </div>
    </div>
  );
}
