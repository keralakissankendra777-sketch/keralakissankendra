import { NextResponse } from "next/server";
import { AuditAction } from "@prisma/client";
import { requireAuthProfile } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { getClientIp, isRateLimited, isTrustedOrigin } from "@/lib/security";

const allowedActions = new Set<AuditAction>([AuditAction.SIGN_IN, AuditAction.SIGN_UP]);

export async function POST(request: Request) {
  if (!isTrustedOrigin(request)) {
    return NextResponse.json({ error: "Untrusted origin" }, { status: 403 });
  }

  const profile = await requireAuthProfile();

  if (!profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ip = getClientIp(request.headers);
  if (isRateLimited(`audit:${ip}:${profile.id}`)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const body = (await request.json()) as { action?: AuditAction };
  if (!body.action || !allowedActions.has(body.action)) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  await writeAuditLog({
    action: body.action,
    actorUserId: profile.clerkUserId,
    profileId: profile.id,
    ipAddress: ip,
    userAgent: request.headers.get("user-agent"),
  });

  return NextResponse.json({ ok: true });
}
