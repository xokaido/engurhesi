import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals, url }) => {
	// login page renders without a session; hooks guard everything else
	if (url.pathname.startsWith('/admin/login')) {
		return { session: null };
	}
	return {
		session: locals.session
			? {
					userId: locals.session.userId,
					role: locals.session.role,
					name: locals.session.name,
					csrf: locals.session.csrfToken
				}
			: null
	};
};
