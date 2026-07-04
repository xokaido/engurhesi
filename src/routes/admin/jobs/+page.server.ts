import type { Actions, PageServerLoad } from './$types';
import { error, fail } from '@sveltejs/kit';
import { createDb } from '$lib/server/db/client';
import { articles, jobItems, jobs } from '$lib/server/db/schema';
import { desc, eq, sql } from 'drizzle-orm';
import { adminForm, requireRole } from '$lib/server/admin/guard';
import { runJobItem, type JobMessage, type TranslatePayload } from '$lib/server/queue/consumer';
import { logAudit } from '$lib/server/audit';

export const load: PageServerLoad = async ({ locals, platform }) => {
	requireRole(locals, 'editor');
	if (!platform?.env?.DB) error(503, 'Database unavailable');
	const db = createDb(platform.env.DB);

	const [jobRows, itemRows] = await Promise.all([
		db.select().from(jobs).orderBy(desc(jobs.createdAt)).limit(30),
		db
			.select({
				id: jobItems.id,
				jobId: jobItems.jobId,
				entityRef: jobItems.entityRef,
				status: jobItems.status,
				attempts: jobItems.attempts,
				lastError: jobItems.lastError
			})
			.from(jobItems)
			.orderBy(desc(jobItems.startedAt))
			.limit(400)
	]);

	return { jobs: jobRows, items: itemRows, csrf: locals.session!.csrfToken };
};

export const actions: Actions = {
	/** Bulk backfill: queue machine translation for every published article
	 * that is missing EN or RU. */
	translateBackfill: async (event) => {
		const { d1, db, session, env } = await adminForm(event, 'admin');

		const candidates = await db
			.select({ id: articles.id })
			.from(articles)
			.where(
				sql`${articles.status} = 'published' AND (
					(SELECT COUNT(*) FROM article_i18n WHERE article_id = ${articles.id}
					 AND locale != 'ka' AND review_status != 'missing') < 2
				)`
			)
			.limit(100);

		if (candidates.length === 0) {
			return fail(400, { error: 'გამოქვეყნებული სტატიები თარგმანის გარეშე ვერ მოიძებნა' });
		}

		const jobId = crypto.randomUUID();
		const now = new Date().toISOString();
		await db.insert(jobs).values({
			id: jobId,
			type: 'translate_backfill',
			status: 'queued',
			payloadJson: JSON.stringify({ count: candidates.length }),
			createdAt: now,
			createdBy: session.userId
		});

		const messages: JobMessage[] = [];
		for (const candidate of candidates) {
			const itemId = crypto.randomUUID();
			const idempotencyKey = `${jobId}:article:${candidate.id}`;
			const payload: TranslatePayload = {
				kind: 'translate_entity',
				entityType: 'article',
				entityId: candidate.id,
				actorId: session.userId
			};
			await db.insert(jobItems).values({
				id: itemId,
				jobId,
				idempotencyKey,
				entityRef: `article:${candidate.id}`,
				status: 'queued'
			});
			messages.push({ jobId, itemId, idempotencyKey, payload });
		}

		await logAudit(db, {
			actorId: session.userId,
			action: 'job_create',
			entityType: 'job',
			entityId: jobId,
			detail: { type: 'translate_backfill', count: candidates.length }
		});

		if (env.JOBS) {
			for (const message of messages) await env.JOBS.send(message);
		} else {
			// no queue binding locally → process inline in the background
			event.platform!.context?.waitUntil?.(
				(async () => {
					for (const message of messages) await runJobItem(d1, env, message);
				})()
			);
		}

		return { queued: candidates.length };
	},

	retryItem: async (event) => {
		const { d1, db, form, session, env } = await adminForm(event, 'admin');
		const itemId = String(form.get('item_id') ?? '');
		const item = await db.select().from(jobItems).where(eq(jobItems.id, itemId)).get();
		if (!item) return fail(404, { error: 'Not found' });

		await db
			.update(jobItems)
			.set({ status: 'queued', attempts: 0, lastError: null })
			.where(eq(jobItems.id, itemId));

		let payload: TranslatePayload | null = null;
		const [entityType, entityId] = item.entityRef.split(':');
		if (
			entityId &&
			(entityType === 'article' ||
				entityType === 'page' ||
				entityType === 'project' ||
				entityType === 'procurement')
		) {
			payload = { kind: 'translate_entity', entityType, entityId, actorId: session.userId };
		}
		const message: JobMessage = {
			jobId: item.jobId,
			itemId: item.id,
			idempotencyKey: item.idempotencyKey,
			payload
		};

		if (env.JOBS) {
			await env.JOBS.send(message);
		} else {
			event.platform!.context?.waitUntil?.(runJobItem(d1, env, message));
		}
		return { retried: true };
	}
};
