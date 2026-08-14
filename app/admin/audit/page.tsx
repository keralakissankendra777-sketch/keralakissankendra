import Link from "next/link";
import { AuditAction, Prisma } from "@/lib/types";
import { redirect } from "next/navigation";
import { requireAdminProfile } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { cleanText } from "@/lib/security";

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

function formatMetadata(metadata: Prisma.JsonValue | null) {
  if (metadata === null) {
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

  const where: Prisma.AuditLogWhereInput = {};

  if (action) {
    where.action = action;
  }

  if (actorUserId) {
    where.actorUserId = {
      contains: actorUserId,
      mode: "insensitive",
    };
  }

  if (profileId) {
    where.profileId = {
      contains: profileId,
      mode: "insensitive",
    };
  }

  if (fromDate || toDate) {
    where.createdAt = {};
    if (fromDate) {
      where.createdAt.gte = fromDate;
    }
    if (toDate) {
      where.createdAt.lte = toDate;
    }
  }

  if (q) {
    const searchFilters: Prisma.AuditLogWhereInput[] = [
      {
        actorUserId: {
          contains: q,
          mode: "insensitive",
        },
      },
      {
        target: {
          contains: q,
          mode: "insensitive",
        },
      },
      {
        profileId: {
          contains: q,
          mode: "insensitive",
        },
      },
      {
        profile: {
          email: {
            contains: q,
            mode: "insensitive",
          },
        },
      },
      {
        profile: {
          fullName: {
            contains: q,
            mode: "insensitive",
          },
        },
      },
    ];

    const parsedActionFromQuery = parseAction(q);
    if (parsedActionFromQuery) {
      searchFilters.push({
        action: parsedActionFromQuery,
      });
    }

    where.OR = searchFilters;
  }

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: {
        profile: {
          select: {
            id: true,
            email: true,
            fullName: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.auditLog.count({ where }),
  ]);

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
              logs.map((log) => {
                const metadata = formatMetadata(log.metadata as Prisma.JsonValue | null);
                return (
                  <tr key={log.id} className="border-t border-zinc-100 align-top">
                    <td className="whitespace-nowrap px-3 py-3 text-zinc-700">{new Date(log.createdAt).toLocaleString()}</td>
                    <td className="px-3 py-3 font-semibold text-zinc-900">{log.action}</td>
                    <td className="px-3 py-3 text-zinc-700">
                      {log.actorUserId ?? "N/A"}
                      {log.ipAddress ? <p className="text-xs text-zinc-500">IP: {log.ipAddress}</p> : null}
                    </td>
                    <td className="px-3 py-3 text-zinc-700">
                      {log.profile?.fullName ?? log.profile?.email ?? log.profileId ?? "N/A"}
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
