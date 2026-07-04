import type { LayoutServerLoad } from './$types';
import { createDb } from '$lib/server/db/client';
import { getSettingsMap, settingForLocale } from '$lib/server/content/queries';
import type { Locale } from '$lib/i18n';

export const load: LayoutServerLoad = async ({ params, platform }) => {
	const locale = params.locale as Locale;

	let contact = { address: '', phone: '', email: '' };
	if (platform?.env?.DB) {
		try {
			const map = await getSettingsMap(createDb(platform.env.DB));
			contact = {
				address: settingForLocale(map, 'contact_address', locale),
				phone: map.contact_phone ?? '',
				email: map.contact_email ?? ''
			};
		} catch {
			// footer contact block is optional; page still renders
		}
	}

	return { locale, contact };
};
