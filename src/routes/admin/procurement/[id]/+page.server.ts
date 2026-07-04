import type { Actions, PageServerLoad } from './$types';
import { error, fail, redirect } from '@sveltejs/kit';
import { createDb } from '$lib/server/db/client';
import {
	media,
	procurementDocs,
	procurementDocsI18n,
	procurementI18n,
	procurementStatusHistory,
	procurements
} from '$lib/server/db/schema';
import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { adminForm, requireRole, tbilisiToUtcIso, utcIsoToTbilisi } from '$lib/server/admin/guard';
import { saveEntityI18n, reindexEntity } from '$lib/server/content/save';
import { setPublishStatus, purgeForEntity } from '$lib/server/admin/publish';
import { logAudit } from '$lib/server/audit';
import { translateEntity } from '$lib/server/translate/service';
import { processUpload } from '$lib/server/media/upload';
import { slugify } from '$lib/server/content/slug';
import type { Locale } from '$lib/i18n';

const VALID_TRANSITIONS: Record<string, string[]> = {
	draft: ['published'],
	published: ['closed', 'canceled', 'awarded', 'amended'],
	amended: ['closed', 'canceled', 'awarded'],
	closed: ['awarded', 'archived'],
	awarded: ['archived'],
	canceled: ['archived'],
	archived: []
};

export const load: PageServerLoad = async ({ locals, params, platform }) => {
	requireRole(locals, 'editor');
	if (!platform?.env?.DB) error(503, 'Database unavailable');
	const db = createDb(platform.env.DB);

	const item = await db.select().from(procurements).where(eq(procurements.id, params.id)).get();
	if (!item) error(404, 'Not found');

	const [i18nRows, docs, docTitles, history, amendments] = await Promise.all([
		db.select().from(procurementI18n).where(eq(procurementI18n.procurementId, item.id)),
		db
			.select({
				id: procurementDocs.id,
				mediaId: procurementDocs.mediaId,
				locale: procurementDocs.locale,
				revision: procurementDocs.revision,
				sort: procurementDocs.sort,
				filename: media.originalFilename,
				size: media.size,
				status: media.status
			})
			.from(procurementDocs)
			.innerJoin(media, eq(procurementDocs.mediaId, media.id))
			.where(eq(procurementDocs.procurementId, item.id))
			.orderBy(asc(procurementDocs.sort), asc(procurementDocs.revision)),
		db
			.select()
			.from(procurementDocsI18n)
			.where(
				sql`${procurementDocsI18n.docId} IN (SELECT id FROM procurement_docs WHERE procurement_id = ${item.id})`
			),
		db
			.select()
			.from(procurementStatusHistory)
			.where(eq(procurementStatusHistory.procurementId, item.id))
			.orderBy(desc(procurementStatusHistory.createdAt)),
		db
			.select({
				id: procurements.id,
				slug: procurements.slug,
				status: procurements.status
			})
			.from(procurements)
			.where(eq(procurements.amendsId, item.id))
	]);

	return {
		item,
		deadlineLocal: utcIsoToTbilisi(item.deadlineAt),
		i18n: i18nRows,
		docs,
		docTitles,
		history,
		amendments,
		validTransitions: VALID_TRANSITIONS[item.status] ?? [],
		csrf: locals.session!.csrfToken,
		role: locals.session!.role,
		hasOpenRouter: !!platform.env.OPENROUTER_API_KEY
	};
};

export const actions: Actions = {
	save: async (event) => {
		const { d1, db, form, session } = await adminForm(event, 'editor');
		const id = event.params.id;
		const locale = String(form.get('locale') ?? 'ka') as Locale;
		if (!['ka', 'en', 'ru'].includes(locale)) return fail(400, { error: 'Invalid locale' });

		const item = await db.select().from(procurements).where(eq(procurements.id, id)).get();
		if (!item) return fail(404, { error: 'Not found' });

		const title = String(form.get('title') ?? '').trim();
		if (!title && locale === 'ka') return fail(400, { error: 'სათაური სავალდებულოა' });

		const result = await saveEntityI18n(
			d1,
			'procurement',
			id,
			locale,
			{
				title,
				bodyJson: String(form.get('body') ?? '') || null,
				extras: {
					amendment_summary: String(form.get('amendment_summary') ?? '').trim() || null
				}
			},
			session.userId
		);
		if (!result.ok) return fail(400, { error: result.error });

		if (locale === 'ka') {
			const kind = String(form.get('kind') ?? item.kind);
			const newDeadline = tbilisiToUtcIso(String(form.get('deadline') ?? ''));

			// deadline changes on live notices require an audited reason
			if (item.status !== 'draft' && newDeadline !== item.deadlineAt) {
				const reason = String(form.get('deadline_reason') ?? '').trim();
				if (!reason) {
					return fail(400, { error: 'ვადის შეცვლას სჭირდება მიზეზი (deadline_reason)' });
				}
				await logAudit(db, {
					actorId: session.userId,
					action: 'deadline_change',
					entityType: 'procurement',
					entityId: id,
					reason,
					detail: { from: item.deadlineAt, to: newDeadline }
				});
				await db
					.update(procurements)
					.set({ previousDeadlineAt: item.deadlineAt })
					.where(eq(procurements.id, id));
			}

			await db
				.update(procurements)
				.set({ kind: kind as 'tender' | 'auction', deadlineAt: newDeadline })
				.where(eq(procurements.id, id));
		}

		return { saved: true, locale };
	},

	publish: async (event) => {
		const { d1, session, env } = await adminForm(event, 'editor');
		await setPublishStatus(d1, env, 'procurement', event.params.id, true, session.userId);
		const db = createDb(d1);
		await db.insert(procurementStatusHistory).values({
			id: crypto.randomUUID(),
			procurementId: event.params.id,
			fromStatus: 'draft',
			toStatus: 'published',
			actorId: session.userId,
			reason: 'Initial publication',
			createdAt: new Date().toISOString()
		});
		return { published: true };
	},

	transition: async (event) => {
		const { d1, db, form, session, env } = await adminForm(event, 'editor');
		const id = event.params.id;
		const toStatus = String(form.get('to_status') ?? '');
		const reason = String(form.get('reason') ?? '').trim();
		if (!reason) return fail(400, { error: 'მიზეზი სავალდებულოა' });

		const item = await db.select().from(procurements).where(eq(procurements.id, id)).get();
		if (!item) return fail(404, { error: 'Not found' });
		if (!(VALID_TRANSITIONS[item.status] ?? []).includes(toStatus)) {
			return fail(400, { error: `გადასვლა ${item.status} → ${toStatus} დაუშვებელია` });
		}

		await db
			.update(procurements)
			.set({
				status: toStatus as typeof item.status,
				updatedAt: new Date().toISOString(),
				updatedBy: session.userId
			})
			.where(eq(procurements.id, id));
		await db.insert(procurementStatusHistory).values({
			id: crypto.randomUUID(),
			procurementId: id,
			fromStatus: item.status,
			toStatus,
			actorId: session.userId,
			reason,
			createdAt: new Date().toISOString()
		});
		await logAudit(db, {
			actorId: session.userId,
			action: 'status_transition',
			entityType: 'procurement',
			entityId: id,
			reason,
			detail: { from: item.status, to: toStatus }
		});
		await reindexEntity(d1, 'procurement', id);
		await purgeForEntity(env, 'procurement');
		return { transitioned: true };
	},

	uploadDoc: async (event) => {
		const { d1, db, form, session, env } = await adminForm(event, 'editor');
		const id = event.params.id;
		const file = form.get('file');
		if (!(file instanceof File) || file.size === 0) {
			return fail(400, { error: 'ფაილი სავალდებულოა' });
		}
		const titleKa = String(form.get('doc_title') ?? '').trim() || file.name;
		const docLocale = String(form.get('doc_locale') ?? '');

		const upload = await processUpload(d1, env.R2, file, 'document', session.userId);
		if (!upload.ok) return fail(400, { error: `ფაილი უარყოფილია: ${upload.error}` });

		// append-only revisions: same title → next revision number
		const prior = await db
			.select({ max: sql<number>`COALESCE(MAX(revision), 0)` })
			.from(procurementDocs)
			.where(eq(procurementDocs.procurementId, id))
			.get();

		const docId = crypto.randomUUID();
		await db.insert(procurementDocs).values({
			id: docId,
			procurementId: id,
			mediaId: upload.mediaId!,
			locale: docLocale === 'ka' || docLocale === 'en' || docLocale === 'ru' ? docLocale : null,
			sort: (prior?.max ?? 0) + 1,
			revision: 1,
			createdAt: new Date().toISOString()
		});
		await db.insert(procurementDocsI18n).values({ docId, locale: 'ka', title: titleKa });
		await purgeForEntity(env, 'procurement');
		return { docUploaded: true };
	},

	amend: async (event) => {
		const { db, form, session } = await adminForm(event, 'editor');
		const id = event.params.id;
		const summary = String(form.get('summary') ?? '').trim();
		if (!summary) return fail(400, { error: 'ცვლილების აღწერა სავალდებულოა' });

		const item = await db.select().from(procurements).where(eq(procurements.id, id)).get();
		if (!item) return fail(404, { error: 'Not found' });
		const i18nRows = await db
			.select()
			.from(procurementI18n)
			.where(and(eq(procurementI18n.procurementId, id), eq(procurementI18n.locale, 'ka')));
		const kaTitle = i18nRows[0]?.title ?? item.slug;

		const newId = crypto.randomUUID();
		const now = new Date().toISOString();
		const newSlug = `${slugify(kaTitle)}-amended-${newId.slice(0, 6)}`;

		await db.insert(procurements).values({
			id: newId,
			slug: newSlug,
			kind: item.kind,
			status: 'draft',
			deadlineAt: item.deadlineAt,
			previousDeadlineAt: item.deadlineAt,
			amendsId: item.id,
			createdAt: now,
			updatedAt: now,
			createdBy: session.userId,
			updatedBy: session.userId
		});
		await db.insert(procurementI18n).values({
			procurementId: newId,
			locale: 'ka',
			title: kaTitle,
			amendmentSummary: summary,
			bodyJson: i18nRows[0]?.bodyJson ?? null,
			bodyHtml: i18nRows[0]?.bodyHtml ?? null,
			bodyText: i18nRows[0]?.bodyText ?? null,
			reviewStatus: 'reviewed'
		});
		await logAudit(db, {
			actorId: session.userId,
			action: 'amend',
			entityType: 'procurement',
			entityId: item.id,
			reason: summary,
			detail: { amendmentId: newId }
		});
		redirect(303, `/admin/procurement/${newId}`);
	},

	translate: async (event) => {
		const { d1, session, env } = await adminForm(event, 'editor');
		const result = await translateEntity(d1, env, 'procurement', event.params.id, session.userId);
		if (!result.ok) return fail(502, { error: result.error });
		return { translated: true };
	}
};
