import type { Db } from './db/client';
import { auditLog } from './db/schema';

export async function logAudit(
	db: Db,
	entry: {
		actorId?: string | null;
		action: string;
		entityType?: string;
		entityId?: string;
		reason?: string;
		detail?: unknown;
	}
): Promise<void> {
	await db.insert(auditLog).values({
		id: crypto.randomUUID(),
		actorId: entry.actorId ?? null,
		action: entry.action,
		entityType: entry.entityType ?? null,
		entityId: entry.entityId ?? null,
		reason: entry.reason ?? null,
		detailJson: entry.detail === undefined ? null : JSON.stringify(entry.detail),
		createdAt: new Date().toISOString()
	});
}
