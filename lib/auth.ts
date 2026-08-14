import { UserRole } from "./types";
import { auth, currentUser } from "@clerk/nextjs/server";
import { getUserProfileByClerkId, getUserProfileByEmail, createUserProfile, updateUserProfile } from "@/lib/database";

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

function resolveFullName(
  user: Awaited<ReturnType<typeof currentUser>>,
  existing?: string | null,
) {
  if (!user) {
    return existing ?? null;
  }

  const direct = user.fullName?.trim();
  if (direct) {
    return direct;
  }

  const metadataName =
    typeof user.unsafeMetadata?.fullName === "string"
      ? user.unsafeMetadata.fullName.trim()
      : null;
  if (metadataName) {
    return metadataName;
  }

  return existing ?? null;
}

export async function requireAuthProfile() {
  const { userId } = await auth();

  if (!userId) {
    return null;
  }

  let profile = await getUserProfileByClerkId(userId);

  if (!profile) {
    const user = await currentUser();

    if (!user) {
      return null;
    }

    const primaryEmail = user.emailAddresses.find(
      (email) => email.id === user.primaryEmailAddressId,
    )?.emailAddress;
    const normalizedEmail = normalizeEmail(primaryEmail ?? `${userId}@local.dev`);

    // If the email already exists, link that profile to this Clerk user instead of creating a duplicate.
    const existingByEmail = await getUserProfileByEmail(normalizedEmail);

    if (existingByEmail) {
      profile = await updateUserProfile(existingByEmail.id, {
        clerkUserId: userId,
        fullName: resolveFullName(user, existingByEmail.full_name),
        phone: user.phoneNumbers[0]?.phoneNumber ?? existingByEmail.phone,
        role: existingByEmail.role ?? resolveRole(primaryEmail),
      });
    } else {
      profile = await createUserProfile({
        clerkUserId: userId,
        email: normalizedEmail,
        fullName: resolveFullName(user),
        phone: user.phoneNumbers[0]?.phoneNumber,
        role: resolveRole(primaryEmail),
      });
    }
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
