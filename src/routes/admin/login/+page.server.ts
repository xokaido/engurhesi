import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { createDb } from '$lib/server/db/client';
import { sessions, users } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import {
	generateCsrfToken,
	generateSessionToken,
	hashToken,
	IDLE_MS,
	ABSOLUTE_MS,
	verifyPassword,
	SESSION_COOKIE
} from '$lib/server/auth/password';
import { verifyOrigin, verifyTurnstile } from '$lib/server/auth/security';
import { logAudit } from '$lib/server/audit';

const MAX_FAILED = 5;
const LOCK_MINUTES = 15;

export const load: PageServerLoad = async ({ locals, platform }) => {
	if (locals.session) redirect(303, '/admin');
	return {
		turnstileSiteKey: platform?.env?.TURNSTILE_SITE_KEY ?? ''
	};
};

export const actions: Actions = {
	login: async ({ request, cookies, platform, url }) => {
		if (!platform?.env?.DB) return fail(503, { error: 'სერვისი მიუწვდომელია' });
		if (!verifyOrigin(request)) return fail(403, { error: 'არასწორი მოთხოვნა' });

		const form = await request.formData();
		const email = String(form.get('email') ?? '')
			.trim()
			.toLowerCase();
		const password = String(form.get('password') ?? '');

		if (platform.env.TURNSTILE_SECRET) {
			const turnstileOk = await verifyTurnstile(
				platform.env.TURNSTILE_SECRET,
				String(form.get('cf-turnstile-response') ?? ''),
				request.headers.get('CF-Connecting-IP') ?? undefined
			);
			if (!turnstileOk) {
				return fail(403, { error: 'უსაფრთხოების შემოწმება ვერ გაიარა' });
			}
		}

		const db = createDb(platform.env.DB);
		const user = await db.select().from(users).where(eq(users.email, email)).get();
		if (!user) return fail(401, { error: 'არასწორი ელფოსტა ან პაროლი' });

		if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) {
			return fail(429, { error: 'ანგარიში დროებით დაბლოკილია. სცადეთ მოგვიანებით.' });
		}

		const passwordOk = await verifyPassword(password, user.passwordSalt, user.passwordHash);
		if (!passwordOk) {
			const failedLogins = user.failedLogins + 1;
			await db
				.update(users)
				.set({
					failedLogins,
					lockedUntil:
						failedLogins >= MAX_FAILED
							? new Date(Date.now() + LOCK_MINUTES * 60_000).toISOString()
							: null
				})
				.where(eq(users.id, user.id));
			await logAudit(db, { actorId: user.id, action: 'login_failed' });
			return fail(401, { error: 'არასწორი ელფოსტა ან პაროლი' });
		}

		const token = generateSessionToken();
		const tokenHash = await hashToken(token, platform.env.SESSION_PEPPER ?? '');
		const now = new Date();

		await db.update(users).set({ failedLogins: 0, lockedUntil: null }).where(eq(users.id, user.id));
		await db.insert(sessions).values({
			id: crypto.randomUUID(),
			userId: user.id,
			tokenHash,
			csrfToken: generateCsrfToken(),
			createdAt: now.toISOString(),
			lastSeenAt: now.toISOString(),
			idleExpiresAt: new Date(now.getTime() + IDLE_MS).toISOString(),
			absoluteExpiresAt: new Date(now.getTime() + ABSOLUTE_MS).toISOString(),
			ip: request.headers.get('CF-Connecting-IP'),
			userAgent: request.headers.get('User-Agent')
		});
		await logAudit(db, { actorId: user.id, action: 'login_success' });

		cookies.set(SESSION_COOKIE, token, {
			path: '/',
			httpOnly: true,
			secure: url.protocol === 'https:',
			sameSite: 'lax',
			maxAge: ABSOLUTE_MS / 1000
		});

		redirect(303, '/admin');
	}
};
