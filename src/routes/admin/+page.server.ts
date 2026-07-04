import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { createDb } from '$lib/server/db/client';
import { articles, jobs, procurements, submissions } from '$lib/server/db/schema';
import { and, desc, eq, gt, inArray, lt, sql } from 'drizzle-orm';

export const load: PageServerLoad = async ({ locals, platform }) => {
	if (!platform?.env?.DB) error(503, 'Database unavailable');
	const db = createDb(platform.env.DB);

	const soon = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
	const now = new Date().toISOString();

	const [drafts, deadlines, unhandled, runningJobs] = await Promise.all([
		db
			.select({ id: articles.id, slug: articles.slug, updatedAt: articles.updatedAt })
			.from(articles)
			.where(eq(articles.status, 'draft'))
			.orderBy(desc(articles.updatedAt))
			.limit(8),
		db
			.select({
				id: procurements.id,
				slug: procurements.slug,
				kind: procurements.kind,
				deadlineAt: procurements.deadlineAt,
				status: procurements.status
			})
			.from(procurements)
			.where(
				and(
					inArray(procurements.status, ['published', 'amended']),
					lt(procurements.deadlineAt, soon),
					gt(procurements.deadlineAt, now)
				)
			)
			.orderBy(procurements.deadlineAt),
		db
			.select({ count: sql<number>`count(*)` })
			.from(submissions)
			.where(eq(submissions.handled, 0))
			.get(),
		db
			.select()
			.from(jobs)
			.where(inArray(jobs.status, ['queued', 'running', 'failed']))
			.orderBy(desc(jobs.createdAt))
			.limit(5)
	]);

	return {
		role: locals.session!.role,
		drafts,
		deadlines,
		unhandledCount: unhandled?.count ?? 0,
		runningJobs
	};
};
