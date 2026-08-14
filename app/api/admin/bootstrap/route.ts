import { NextResponse } from "next/server";
import { UserRole } from "@/lib/types";
import { requireAuthProfile } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
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

  const { error } = await supabase
    .from("user_profiles")
    .update({ role: UserRole.ADMIN })
    .eq("id", profile.id);

  if (error) {
    console.error("Error updating user profile:", error);
    return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, role: UserRole.ADMIN });
}
