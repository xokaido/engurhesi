import type { Actions, PageServerLoad } from './$types';
import { error, fail } from '@sveltejs/kit';
import { createDb } from '$lib/server/db/client';
import { sessions, users } from '$lib/server/db/schema';
import { asc, eq } from 'drizzle-orm';
import { adminForm, requireRole } from '$lib/server/admin/guard';
import { generateSalt, generateSessionToken, hashPassword } from '$lib/server/auth/password';
import { logAudit } from '$lib/server/audit';

export const load: PageServerLoad = async ({ locals, platform }) => {
	requireRole(locals, 'admin');
	if (!platform?.env?.DB) error(503, 'Database unavailable');
	const db = createDb(platform.env.DB);

	const rows = await db
		.select({
			id: users.id,
			email: users.email,
			name: users.name,
			role: users.role,
			lockedUntil: users.lockedUntil,
			failedLogins: users.failedLogins,
			createdAt: users.createdAt
		})
		.from(users)
		.orderBy(asc(users.email));

	return { items: rows, selfId: locals.session!.userId, csrf: locals.session!.csrfToken };
};

export const actions: Actions = {
	create: async (event) => {
		const { db, form, session } = await adminForm(event, 'admin');
		const email = String(form.get('email') ?? '').trim().toLowerCase();
		const name = String(form.get('name') ?? '').trim();
		const role = String(form.get('role') ?? 'draft_editor');
		if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
			return fail(400, { error: 'არასწორი ელფოსტა' });
		}
		if (!name) return fail(400, { error: 'სახელი სავალდებულოა' });
		if (!['admin', 'editor', 'draft_editor'].includes(role)) {
			return fail(400, { error: 'Invalid role' });
		}

		const existing = await db.select().from(users).where(eq(users.email, email)).get();
		if (existing) return fail(400, { error: 'ეს ელფოსტა უკვე გამოიყენება' });

		// generated one-time password shown once to the admin
		const tempPassword = generateSessionToken().slice(0, 16);
		const salt = generateSalt();
		const { hash } = await hashPassword(tempPassword, salt);
		const now = new Date().toISOString();
		const id = crypto.randomUUID();

		await db.insert(users).values({
			id,
			email,
			name,
			role: role as 'admin' | 'editor' | 'draft_editor',
			passwordHash: hash,
			passwordSalt: salt,
			createdAt: now,
			updatedAt: now
		});
		await logAudit(db, {
			actorId: session.userId,
			action: 'user_create',
			entityType: 'user',
			entityId: id,
			detail: { email, role }
		});
		return { created: true, tempPassword, email };
	},

	setRole: async (event) => {
		const { db, form, session } = await adminForm(event, 'admin');
		const userId = String(form.get('user_id') ?? '');
		const role = String(form.get('role') ?? '');
		if (!['admin', 'editor', 'draft_editor'].includes(role)) {
			return fail(400, { error: 'Invalid role' });
		}
		if (userId === session.userId) {
			return fail(400, { error: 'საკუთარი როლის შეცვლა შეუძლებელია' });
		}

		await db
			.update(users)
			.set({ role: role as 'admin' | 'editor' | 'draft_editor', updatedAt: new Date().toISOString() })
			.where(eq(users.id, userId));
		await logAudit(db, {
			actorId: session.userId,
			action: 'user_role_change',
			entityType: 'user',
			entityId: userId,
			detail: { role }
		});
		return { roleSaved: true };
	},

	resetPassword: async (event) => {
		const { db, form, session } = await adminForm(event, 'admin');
		const userId = String(form.get('user_id') ?? '');
		const target = await db.select().from(users).where(eq(users.id, userId)).get();
		if (!target) return fail(404, { error: 'Not found' });

		const tempPassword = generateSessionToken().slice(0, 16);
		const salt = generateSalt();
		const { hash } = await hashPassword(tempPassword, salt);

		await db
			.update(users)
			.set({
				passwordHash: hash,
				passwordSalt: salt,
				failedLogins: 0,
				lockedUntil: null,
				updatedAt: new Date().toISOString()
			})
			.where(eq(users.id, userId));
		// revoke all sessions server-side
		await db.delete(sessions).where(eq(sessions.userId, userId));
		await logAudit(db, {
			actorId: session.userId,
			action: 'user_password_reset',
			entityType: 'user',
			entityId: userId
		});
		return { passwordReset: true, tempPassword, email: target.email };
	},

	unlock: async (event) => {
		const { db, form, session } = await adminForm(event, 'admin');
		const userId = String(form.get('user_id') ?? '');
		await db
			.update(users)
			.set({ failedLogins: 0, lockedUntil: null, updatedAt: new Date().toISOString() })
			.where(eq(users.id, userId));
		await logAudit(db, {
			actorId: session.userId,
			action: 'user_unlock',
			entityType: 'user',
			entityId: userId
		});
		return { unlocked: true };
	},

	delete: async (event) => {
		const { db, form, session } = await adminForm(event, 'admin');
		const userId = String(form.get('user_id') ?? '');
		if (userId === session.userId) {
			return fail(400, { error: 'საკუთარი ანგარიშის წაშლა შეუძლებელია' });
		}
		await db.delete(sessions).where(eq(sessions.userId, userId));
		await db.delete(users).where(eq(users.id, userId));
		await logAudit(db, {
			actorId: session.userId,
			action: 'user_delete',
			entityType: 'user',
			entityId: userId
		});
		return { deleted: true };
	}
};
