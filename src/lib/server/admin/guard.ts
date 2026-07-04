import { error, fail, type RequestEvent } from '@sveltejs/kit';
import { createDb, type Db } from '../db/client';
import { verifyCsrf, verifyOrigin } from '../auth/security';
import type { D1Database } from '@cloudflare/workers-types';

export type Role = 'admin' | 'editor' | 'draft_editor';

const ROLE_RANK: Record<Role, number> = { admin: 3, editor: 2, draft_editor: 1 };

export function hasRole(actual: Role, required: Role): boolean {
	return ROLE_RANK[actual] >= ROLE_RANK[required];
}

export function requireRole(
	locals: App.Locals,
	required: Role
): NonNullable<App.Locals['session']> {
	const session = locals.session;
	if (!session) error(401, 'Not authenticated');
	if (!hasRole(session.role, required)) error(403, 'Insufficient permissions');
	return session;
}

export interface AdminFormContext {
	db: Db;
	d1: D1Database;
	form: FormData;
	session: NonNullable<App.Locals['session']>;
	env: import('../../../app.d').Env;
}

/**
 * Standard admin action preamble: platform check, role check, origin check,
 * CSRF double-submit check. Throws SvelteKit error()/fail() on violation.
 */
export async function adminForm(
	event: RequestEvent,
	required: Role = 'editor'
): Promise<AdminFormContext> {
	const session = requireRole(event.locals, required);
	if (!event.platform?.env?.DB) error(503, 'Database unavailable');
	if (!verifyOrigin(event.request)) error(403, 'Invalid origin');

	const form = await event.request.formData();
	if (!verifyCsrf(session.csrfToken, String(form.get('csrf') ?? ''))) {
		error(403, 'Invalid CSRF token');
	}

	return {
		db: createDb(event.platform.env.DB),
		d1: event.platform.env.DB,
		form,
		session,
		env: event.platform.env
	};
}

export function requiredString(form: FormData, key: string, maxLength = 500): string {
	const value = String(form.get(key) ?? '').trim();
	if (!value) throw fail(400, { error: `${key} is required` });
	return value.slice(0, maxLength);
}

export function optionalString(form: FormData, key: string, maxLength = 100_000): string | null {
	const value = String(form.get(key) ?? '').trim();
	return value ? value.slice(0, maxLength) : null;
}

/** datetime-local input (interpreted as Asia/Tbilisi, UTC+4) → UTC ISO */
export function tbilisiToUtcIso(value: string): string | null {
	if (!value) return null;
	const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value);
	if (!match) return null;
	const [, y, m, d, h, min] = match;
	const utcMs = Date.UTC(Number(y), Number(m) - 1, Number(d), Number(h) - 4, Number(min));
	return new Date(utcMs).toISOString();
}

/** UTC ISO → value for a datetime-local input in Tbilisi time */
export function utcIsoToTbilisi(iso: string | null): string {
	if (!iso) return '';
	const date = new Date(new Date(iso).getTime() + 4 * 60 * 60 * 1000);
	return date.toISOString().slice(0, 16);
}
