import { AuditAction, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function writeAuditLog(params: {
  action: AuditAction;
  actorUserId?: string;
  profileId?: string;
  target?: string;
  metadata?: Prisma.InputJsonValue;
  ipAddress?: string | null;
  userAgent?: string | null;
}) {
  try {
    await prisma.auditLog.create({
      data: {
        action: params.action,
        actorUserId: params.actorUserId,
        profileId: params.profileId,
        target: params.target,
        metadata: params.metadata,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
      },
    });
  } catch (error) {
    console.error("audit-log-write-failed", error);
  }
}
