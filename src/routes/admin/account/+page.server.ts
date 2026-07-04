import type { Actions, PageServerLoad } from './$types';
import { error, fail } from '@sveltejs/kit';
import { createDb } from '$lib/server/db/client';
import { sessions, users } from '$lib/server/db/schema';
import { desc, eq, sql } from 'drizzle-orm';
import { adminForm, requireRole } from '$lib/server/admin/guard';
import { generateSalt, hashPassword, verifyPassword } from '$lib/server/auth/password';
import { logAudit } from '$lib/server/audit';

export const load: PageServerLoad = async ({ locals, platform }) => {
	const session = requireRole(locals, 'draft_editor');
	if (!platform?.env?.DB) error(503, 'Database unavailable');
	const db = createDb(platform.env.DB);

	const [user, activeSessions] = await Promise.all([
		db
			.select({ email: users.email, name: users.name, role: users.role })
			.from(users)
			.where(eq(users.id, session.userId))
			.get(),
		db
			.select({
				id: sessions.id,
				createdAt: sessions.createdAt,
				lastSeenAt: sessions.lastSeenAt,
				ip: sessions.ip,
				userAgent: sessions.userAgent
			})
			.from(sessions)
			.where(
				sql`${sessions.userId} = ${session.userId} AND ${sessions.idleExpiresAt} > ${new Date().toISOString()}`
			)
			.orderBy(desc(sessions.lastSeenAt))
	]);
	if (!user) error(404, 'Not found');

	return { user, sessions: activeSessions, csrf: session.csrfToken };
};

export const actions: Actions = {
	changePassword: async (event) => {
		const { db, form, session } = await adminForm(event, 'draft_editor');
		const current = String(form.get('current') ?? '');
		const next = String(form.get('next') ?? '');
		const confirm = String(form.get('confirm') ?? '');

		if (next.length < 12) {
			return fail(400, { error: 'ახალი პაროლი უნდა იყოს მინიმუმ 12 სიმბოლო' });
		}
		if (next !== confirm) return fail(400, { error: 'პაროლები არ ემთხვევა' });

		const user = await db.select().from(users).where(eq(users.id, session.userId)).get();
		if (!user) return fail(404, { error: 'Not found' });
		const valid = await verifyPassword(current, user.passwordSalt, user.passwordHash);
		if (!valid) return fail(400, { error: 'მიმდინარე პაროლი არასწორია' });

		const salt = generateSalt();
		const { hash } = await hashPassword(next, salt);
		await db
			.update(users)
			.set({ passwordHash: hash, passwordSalt: salt, updatedAt: new Date().toISOString() })
			.where(eq(users.id, session.userId));
		// revoke every other session; the current one stays valid
		await db
			.delete(sessions)
			.where(sql`${sessions.userId} = ${session.userId} AND ${sessions.id} != ${session.id}`);
		await logAudit(db, {
			actorId: session.userId,
			action: 'password_change',
			entityType: 'user',
			entityId: session.userId
		});
		return { passwordChanged: true };
	},

	revokeOtherSessions: async (event) => {
		const { db, session } = await adminForm(event, 'draft_editor');
		await db
			.delete(sessions)
			.where(sql`${sessions.userId} = ${session.userId} AND ${sessions.id} != ${session.id}`);
		await logAudit(db, {
			actorId: session.userId,
			action: 'sessions_revoked',
			entityType: 'user',
			entityId: session.userId
		});
		return { revoked: true };
	}
};
