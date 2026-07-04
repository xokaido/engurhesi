import type { D1Database } from '@cloudflare/workers-types';
import { lt, or } from 'drizzle-orm';
import { createDb } from './db/client';
import { sessions } from './db/schema';

/**
 * Scheduled maintenance (cron): expire sessions/reset tokens, purge old
 * contact submissions per retention policy, mark orphaned media. Invoked by
 * the worker's scheduled handler; callable manually if needed.
 */
export async function runScheduledMaintenance(env: { DB: D1Database }): Promise<void> {
	const db = createDb(env.DB);
	const now = new Date().toISOString();
	await db
		.delete(sessions)
		.where(or(lt(sessions.idleExpiresAt, now), lt(sessions.absoluteExpiresAt, now)));
	await env.DB.prepare('DELETE FROM reset_tokens WHERE expires_at < ?').bind(now).run();
	await env.DB.prepare('DELETE FROM submissions WHERE purge_after < ?').bind(now).run();
	await env.DB.prepare(
		`UPDATE media SET status = 'orphaned', updated_at = ?
		 WHERE status = 'pending' AND created_at < datetime('now', '-1 day')`
	)
		.bind(now)
		.run();
}
