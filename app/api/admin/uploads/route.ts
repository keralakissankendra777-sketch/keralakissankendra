import { NextResponse } from "next/server";
import { requireAdminProfile } from "@/lib/auth";
import { getClientIp, isRateLimited, isTrustedOrigin } from "@/lib/security";
import { uploadProductImage } from "@/lib/storage";

export async function POST(request: Request) {
  if (!isTrustedOrigin(request)) {
    return NextResponse.json({ error: "Untrusted origin" }, { status: 403 });
  }

  const profile = await requireAdminProfile();

  if (!profile) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const ip = getClientIp(request.headers);
  if (isRateLimited(`admin:uploads:${ip}:${profile.id}`)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const formData = await request.formData();
  const rawFiles = formData.getAll("files");
  const files = rawFiles.filter((entry): entry is File => entry instanceof File);

  if (files.length === 0) {
    return NextResponse.json({ error: "No files uploaded" }, { status: 400 });
  }

  if (files.length > 8) {
    return NextResponse.json({ error: "Maximum 8 images per upload" }, { status: 400 });
  }

  let uploaded: Array<{ name: string; url: string }>;
  try {
    uploaded = await Promise.all(
      files.map(async (file) => {
        if (file.size > 5 * 1024 * 1024) {
          throw new Error(`File ${file.name} exceeds 5MB limit`);
        }

        const url = await uploadProductImage(file);
        return { name: file.name, url };
      }),
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Upload failed",
      },
      { status: 400 },
    );
  }

  return NextResponse.json({ uploaded });
}
