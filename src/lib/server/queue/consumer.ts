import type { D1Database, MessageBatch, Queue } from '@cloudflare/workers-types';
import { eq, sql } from 'drizzle-orm';
import { createDb } from '../db/client';
import { jobItems, jobs } from '../db/schema';
import { translateEntity } from '../translate/service';
import type { RichEntityType } from '../content/save';
import type { Env } from '../../../app.d';

export interface JobMessage {
	jobId: string;
	itemId: string;
	idempotencyKey: string;
	payload: unknown;
}

export interface TranslatePayload {
	kind: 'translate_entity';
	entityType: RichEntityType;
	entityId: string;
	actorId: string | null;
}

export async function enqueueJobItem(queue: Queue, message: JobMessage): Promise<void> {
	await queue.send(message);
}

/**
 * Runs one job item to completion and records the outcome. Shared between the
 * Queues consumer and the inline dev fallback (no queue binding locally).
 */
export async function runJobItem(
	d1: D1Database,
	env: Partial<Env>,
	message: JobMessage
): Promise<{ ok: boolean; error?: string }> {
	const drizzle = createDb(d1);
	const { jobId, itemId, idempotencyKey, payload } = message;

	const existing = await drizzle
		.select()
		.from(jobItems)
		.where(eq(jobItems.idempotencyKey, idempotencyKey))
		.get();
	if (existing?.status === 'done') return { ok: true };

	await drizzle
		.update(jobItems)
		.set({
			status: 'running',
			startedAt: new Date().toISOString(),
			attempts: (existing?.attempts ?? 0) + 1
		})
		.where(eq(jobItems.id, itemId));

	try {
		const result = await handlePayload(d1, env, payload);
		await drizzle
			.update(jobItems)
			.set({
				status: 'done',
				resultJson: JSON.stringify(result),
				finishedAt: new Date().toISOString()
			})
			.where(eq(jobItems.id, itemId));
		await refreshJobStatus(d1, jobId);
		return { ok: true };
	} catch (err) {
		const error = err instanceof Error ? err.message : 'Unknown error';
		const attempts = (existing?.attempts ?? 0) + 1;
		const dead =
			attempts >= 3 ||
			(payload !== null && typeof payload === 'object' && (payload as { poison?: boolean }).poison);
		await drizzle
			.update(jobItems)
			.set({
				status: dead ? 'dead' : 'failed',
				lastError: error,
				attempts,
				finishedAt: dead ? new Date().toISOString() : null
			})
			.where(eq(jobItems.id, itemId));
		await refreshJobStatus(d1, jobId);
		return { ok: false, error };
	}
}

async function refreshJobStatus(d1: D1Database, jobId: string): Promise<void> {
	const drizzle = createDb(d1);
	const counts = await drizzle
		.select({
			total: sql<number>`count(*)`,
			open: sql<number>`sum(CASE WHEN status IN ('queued','running','failed') THEN 1 ELSE 0 END)`,
			dead: sql<number>`sum(CASE WHEN status = 'dead' THEN 1 ELSE 0 END)`
		})
		.from(jobItems)
		.where(eq(jobItems.jobId, jobId))
		.get();
	if (!counts) return;
	const status = counts.open > 0 ? 'running' : counts.dead > 0 ? 'failed' : 'done';
	await drizzle.update(jobs).set({ status }).where(eq(jobs.id, jobId));
}

export async function processJobBatch(
	d1: D1Database,
	env: Partial<Env>,
	batch: MessageBatch<JobMessage>
): Promise<void> {
	for (const message of batch.messages) {
		const result = await runJobItem(d1, env, message.body);
		if (result.ok) {
			message.ack();
			continue;
		}
		const drizzle = createDb(d1);
		const item = await drizzle
			.select()
			.from(jobItems)
			.where(eq(jobItems.id, message.body.itemId))
			.get();
		if (item?.status === 'dead') {
			// poison → acknowledged here, surfaced in admin; DLQ handles transport-level poison
			message.ack();
		} else {
			message.retry();
		}
	}
}

async function handlePayload(
	d1: D1Database,
	env: Partial<Env>,
	payload: unknown
): Promise<unknown> {
	if (payload && typeof payload === 'object' && 'poison' in payload) {
		throw new Error('Poison message — intentional failure');
	}
	const typed = payload as Partial<TranslatePayload> | null;
	if (typed?.kind === 'translate_entity' && typed.entityType && typed.entityId) {
		const result = await translateEntity(
			d1,
			{
				OPENROUTER_API_KEY: env.OPENROUTER_API_KEY,
				OPENROUTER_MODEL: env.OPENROUTER_MODEL ?? 'google/gemini-3.1-pro-preview',
				OPENROUTER_FALLBACK_MODEL:
					env.OPENROUTER_FALLBACK_MODEL ?? 'google/gemini-2.5-pro-preview'
			},
			typed.entityType,
			typed.entityId,
			typed.actorId ?? null
		);
		if (!result.ok) throw new Error(result.error ?? 'Translation failed');
		return result;
	}
	return { ok: true };
}
