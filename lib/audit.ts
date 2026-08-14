import { createAuditLog } from "@/lib/database";

export async function writeAuditLog(params: {
  action: string;
  actorUserId?: string;
  profileId?: string;
  target?: string;
  metadata?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}) {
  await createAuditLog({
    action: params.action,
    actorUserId: params.actorUserId,
    profileId: params.profileId,
    target: params.target,
    metadata: params.metadata,
    ipAddress: params.ipAddress,
    userAgent: params.userAgent,
  });
}
