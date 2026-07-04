import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ platform }) => {
	return Response.json({
		ok: true,
		environment: platform?.env?.ENVIRONMENT ?? 'unknown',
		phase: 0
	});
};
