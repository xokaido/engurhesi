import type { ParamMatcher } from '@sveltejs/kit';

export const match: ParamMatcher = (param) => {
	return param === 'ka' || param === 'en' || param === 'ru';
};
