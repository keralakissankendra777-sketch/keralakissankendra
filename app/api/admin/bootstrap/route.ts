import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { requireAuthProfile } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getClientIp, isRateLimited, isTrustedOrigin } from "@/lib/security";

export async function POST(request: Request) {
  if (!isTrustedOrigin(request)) {
    return NextResponse.json({ error: "Untrusted origin" }, { status: 403 });
  }

  const profile = await requireAuthProfile();

  if (!profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ip = getClientIp(request.headers);
  if (isRateLimited(`admin:bootstrap:${ip}:${profile.id}`)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const allowed = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((row) => row.trim().toLowerCase())
    .filter(Boolean);

  if (!allowed.includes(profile.email.toLowerCase())) {
    return NextResponse.json({ error: "Email not allowed for bootstrap" }, { status: 403 });
  }

  await prisma.userProfile.update({
    where: { id: profile.id },
    data: { role: UserRole.ADMIN },
  });

  return NextResponse.json({ ok: true, role: UserRole.ADMIN });
}
