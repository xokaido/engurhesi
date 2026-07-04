import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { createDb } from '$lib/server/db/client';
import { auditLog, users } from '$lib/server/db/schema';
import { desc, eq, sql } from 'drizzle-orm';
import { requireRole } from '$lib/server/admin/guard';

export const load: PageServerLoad = async ({ locals, platform, url }) => {
	requireRole(locals, 'admin');
	if (!platform?.env?.DB) error(503, 'Database unavailable');
	const db = createDb(platform.env.DB);

	const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
	const perPage = 50;

	const rows = await db
		.select({
			id: auditLog.id,
			action: auditLog.action,
			entityType: auditLog.entityType,
			entityId: auditLog.entityId,
			reason: auditLog.reason,
			detailJson: auditLog.detailJson,
			createdAt: auditLog.createdAt,
			actorEmail: users.email
		})
		.from(auditLog)
		.leftJoin(users, eq(auditLog.actorId, users.id))
		.orderBy(desc(auditLog.createdAt))
		.limit(perPage)
		.offset((page - 1) * perPage);

	const total = await db
		.select({ count: sql<number>`COUNT(*)` })
		.from(auditLog)
		.get();

	return {
		items: rows,
		page,
		totalPages: Math.max(1, Math.ceil((total?.count ?? 0) / perPage))
	};
};
