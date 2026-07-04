import type { RequestHandler } from './$types';
import { redirect } from '@sveltejs/kit';
import { createDb } from '$lib/server/db/client';
import { sessions } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { SESSION_COOKIE } from '$lib/server/auth/password';

export const POST: RequestHandler = async ({ locals, cookies, platform }) => {
	if (locals.session && platform?.env?.DB) {
		const db = createDb(platform.env.DB);
		await db.delete(sessions).where(eq(sessions.id, locals.session.id));
	}
	cookies.delete(SESSION_COOKIE, { path: '/' });
	redirect(303, '/admin/login');
};
