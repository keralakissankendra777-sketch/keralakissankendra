import { UserRole } from "@prisma/client";
import { auth, currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function resolveRole(email?: string) {
  const configured = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((row) => row.trim().toLowerCase())
    .filter(Boolean);

  if (email && configured.includes(email.toLowerCase())) {
    return UserRole.ADMIN;
  }

  return UserRole.CUSTOMER;
}

export async function requireAuthProfile() {
  const { userId } = await auth();

  if (!userId) {
    return null;
  }

  let profile = await prisma.userProfile.findUnique({
    where: { clerkUserId: userId },
  });

  if (!profile) {
    const user = await currentUser();

    if (!user) {
      return null;
    }

    const primaryEmail = user.emailAddresses.find(
      (email) => email.id === user.primaryEmailAddressId,
    )?.emailAddress;

    profile = await prisma.userProfile.create({
      data: {
        clerkUserId: userId,
        email: normalizeEmail(primaryEmail ?? `${userId}@local.dev`),
        fullName: `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || null,
        phone: user.phoneNumbers[0]?.phoneNumber,
        role: resolveRole(primaryEmail),
      },
    });
  }

  return profile;
}

export async function requireAdminProfile() {
  const profile = await requireAuthProfile();

  if (!profile || profile.role !== UserRole.ADMIN) {
    return null;
  }

  return profile;
}
