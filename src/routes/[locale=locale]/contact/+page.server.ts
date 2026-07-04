import type { Actions, PageServerLoad } from './$types';
import { error, fail } from '@sveltejs/kit';
import { createDb } from '$lib/server/db/client';
import { submissions } from '$lib/server/db/schema';
import { getSettingsMap, settingForLocale } from '$lib/server/content/queries';
import { verifyOrigin, verifyTurnstile } from '$lib/server/auth/security';
import { hashToken } from '$lib/server/auth/password';
import type { Locale } from '$lib/i18n';

export const load: PageServerLoad = async ({ params, platform }) => {
	if (!platform?.env?.DB) error(503, 'Database unavailable');
	const db = createDb(platform.env.DB);
	const locale = params.locale as Locale;
	const map = await getSettingsMap(db);

	return {
		locale,
		contact: {
			address: settingForLocale(map, 'contact_address', locale),
			phone: map.contact_phone ?? '',
			email: map.contact_email ?? '',
			mapUrl: map.map_url ?? ''
		},
		turnstileSiteKey: platform.env.TURNSTILE_SITE_KEY ?? ''
	};
};

export const actions: Actions = {
	default: async ({ request, platform }) => {
		if (!platform?.env?.DB) {
			return fail(503, { error: true, name: '', email: '', subject: '', message: '' });
		}
		if (!verifyOrigin(request)) {
			return fail(403, { error: true, name: '', email: '', subject: '', message: '' });
		}

		const form = await request.formData();
		const name = String(form.get('name') ?? '').trim();
		const email = String(form.get('email') ?? '').trim();
		const subject = String(form.get('subject') ?? '').trim();
		const message = String(form.get('message') ?? '').trim();
		// honeypot
		if (String(form.get('website') ?? '') !== '') return { success: true };

		if (!name || !email || !subject || !message || message.length > 10_000) {
			return fail(400, { error: true, name, email, subject, message });
		}

		if (platform.env.TURNSTILE_SECRET) {
			const ok = await verifyTurnstile(
				platform.env.TURNSTILE_SECRET,
				String(form.get('cf-turnstile-response') ?? ''),
				request.headers.get('CF-Connecting-IP') ?? undefined
			);
			if (!ok) return fail(403, { error: true, name, email, subject, message });
		}

		const db = createDb(platform.env.DB);
		const pepper = platform.env.SESSION_PEPPER ?? '';
		const ip = request.headers.get('CF-Connecting-IP') ?? '';
		const ua = request.headers.get('User-Agent') ?? '';
		const purgeAfter = new Date();
		purgeAfter.setMonth(purgeAfter.getMonth() + 12);

		await db.insert(submissions).values({
			id: crypto.randomUUID(),
			name,
			email,
			subject,
			message,
			ipHash: ip ? await hashToken(ip, pepper) : null,
			uaHash: ua ? await hashToken(ua, pepper) : null,
			createdAt: new Date().toISOString(),
			handled: 0,
			purgeAfter: purgeAfter.toISOString()
		});

		return { success: true };
	}
};
