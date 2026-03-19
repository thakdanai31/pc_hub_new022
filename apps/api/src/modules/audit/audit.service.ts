import { prisma } from '../../config/database.js';
import type { Prisma } from '../../generated/prisma/client.js';

type TransactionClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

export interface AuditEntry {
  actorUserId: number;
  action: string;
  entityType: string;
  entityId: number | null;
  metadata?: Prisma.InputJsonValue;
}

/**
 * Creates an audit log record inside an existing transaction.
 * If the transaction rolls back, the audit record is also rolled back.
 */
export async function logAction(tx: TransactionClient, entry: AuditEntry): Promise<void> {
  await tx.auditLog.create({
    data: {
      actorUserId: entry.actorUserId,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      metadata: entry.metadata ?? undefined,
    },
  });
}

/**
 * Creates an audit log record on a best-effort basis (fire-and-forget).
 * Failures are logged but never thrown — use only for non-critical actions.
 */
export async function logActionBestEffort(entry: AuditEntry): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorUserId: entry.actorUserId,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        metadata: entry.metadata ?? undefined,
      },
    });
  } catch (error) {
    console.warn('Audit log write failed (best-effort):', error);
  }
}
