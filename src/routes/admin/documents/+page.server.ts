import type { Actions, PageServerLoad } from './$types';
import { error, fail } from '@sveltejs/kit';
import { createDb } from '$lib/server/db/client';
import { documentFiles, documentI18n, documents, media } from '$lib/server/db/schema';
import { desc, eq, sql } from 'drizzle-orm';
import { adminForm, requireRole } from '$lib/server/admin/guard';
import { slugify } from '$lib/server/content/slug';
import { logAudit } from '$lib/server/audit';
import { processUpload } from '$lib/server/media/upload';
import { setPublishStatus } from '$lib/server/admin/publish';
import { reindexEntity, removeEntityFromIndex } from '$lib/server/content/save';
import type { Locale } from '$lib/i18n';

export const load: PageServerLoad = async ({ locals, platform }) => {
	requireRole(locals, 'draft_editor');
	if (!platform?.env?.DB) error(503, 'Database unavailable');
	const db = createDb(platform.env.DB);

	const [rows, files] = await Promise.all([
		db
			.select({
				id: documents.id,
				slug: documents.slug,
				category: documents.category,
				year: documents.year,
				status: documents.status,
				title: sql<string>`(SELECT title FROM document_i18n WHERE document_id = ${documents.id} AND locale = 'ka')`
			})
			.from(documents)
			.orderBy(desc(documents.year), desc(documents.createdAt)),
		db
			.select({
				documentId: documentFiles.documentId,
				locale: documentFiles.locale,
				mediaId: documentFiles.mediaId,
				filename: media.originalFilename
			})
			.from(documentFiles)
			.innerJoin(media, eq(documentFiles.mediaId, media.id))
	]);

	return { items: rows, files, csrf: locals.session!.csrfToken, role: locals.session!.role };
};

export const actions: Actions = {
	create: async (event) => {
		const { d1, db, form, session, env } = await adminForm(event, 'editor');
		const title = String(form.get('title') ?? '').trim();
		const category = String(form.get('category') ?? 'other');
		const year = Number(form.get('year')) || null;
		const file = form.get('file');
		if (!title) return fail(400, { error: 'სათაური სავალდებულოა' });
		if (!['financial', 'legal', 'other'].includes(category)) {
			return fail(400, { error: 'Invalid category' });
		}
		if (!(file instanceof File) || file.size === 0) {
			return fail(400, { error: 'PDF ფაილი სავალდებულოა' });
		}

		const upload = await processUpload(d1, env.R2, file, 'document', session.userId);
		if (!upload.ok) return fail(400, { error: `ფაილი უარყოფილია: ${upload.error}` });

		const id = crypto.randomUUID();
		const now = new Date().toISOString();
		let slug = slugify(title);
		const existing = await db.select().from(documents).where(eq(documents.slug, slug)).get();
		if (existing) slug = `${slug}-${id.slice(0, 6)}`;

		await db.insert(documents).values({
			id,
			slug,
			category: category as 'financial' | 'legal' | 'other',
			year,
			status: 'draft',
			createdAt: now,
			updatedAt: now,
			createdBy: session.userId,
			updatedBy: session.userId
		});
		await db
			.insert(documentI18n)
			.values({ documentId: id, locale: 'ka', title, reviewStatus: 'reviewed' });
		await db.insert(documentFiles).values({
			id: crypto.randomUUID(),
			documentId: id,
			locale: 'ka',
			mediaId: upload.mediaId!
		});
		await logAudit(db, { actorId: session.userId, action: 'create', entityType: 'document', entityId: id });
		return { created: true };
	},

	addFile: async (event) => {
		const { d1, db, form, session, env } = await adminForm(event, 'editor');
		const documentId = String(form.get('document_id') ?? '');
		const locale = String(form.get('locale') ?? '') as Locale;
		const file = form.get('file');
		if (!['ka', 'en', 'ru'].includes(locale)) return fail(400, { error: 'Invalid locale' });
		if (!(file instanceof File) || file.size === 0) {
			return fail(400, { error: 'ფაილი სავალდებულოა' });
		}
		const doc = await db.select().from(documents).where(eq(documents.id, documentId)).get();
		if (!doc) return fail(404, { error: 'Not found' });

		const upload = await processUpload(d1, env.R2, file, 'document', session.userId);
		if (!upload.ok) return fail(400, { error: `ფაილი უარყოფილია: ${upload.error}` });

		// replace existing variant for this locale
		await db
			.delete(documentFiles)
			.where(sql`${documentFiles.documentId} = ${documentId} AND ${documentFiles.locale} = ${locale}`);
		await db.insert(documentFiles).values({
			id: crypto.randomUUID(),
			documentId,
			locale,
			mediaId: upload.mediaId!
		});
		return { fileAdded: true };
	},

	setTitle: async (event) => {
		const { d1, db, form, session } = await adminForm(event, 'editor');
		const documentId = String(form.get('document_id') ?? '');
		const locale = String(form.get('locale') ?? '') as Locale;
		const title = String(form.get('title') ?? '').trim();
		if (!['ka', 'en', 'ru'].includes(locale)) return fail(400, { error: 'Invalid locale' });
		if (!title) return fail(400, { error: 'სათაური სავალდებულოა' });

		const existing = await db
			.select()
			.from(documentI18n)
			.where(
				sql`${documentI18n.documentId} = ${documentId} AND ${documentI18n.locale} = ${locale}`
			)
			.get();
		if (existing) {
			await db
				.update(documentI18n)
				.set({ title, reviewStatus: locale === 'ka' ? 'reviewed' : 'human_edited' })
				.where(
					sql`${documentI18n.documentId} = ${documentId} AND ${documentI18n.locale} = ${locale}`
				);
		} else {
			await db.insert(documentI18n).values({
				documentId,
				locale,
				title,
				reviewStatus: locale === 'ka' ? 'reviewed' : 'human_edited'
			});
		}
		await reindexEntity(d1, 'document', documentId);
		await logAudit(db, {
			actorId: session.userId,
			action: 'update',
			entityType: 'document',
			entityId: documentId
		});
		return { titleSaved: true };
	},

	publish: async (event) => {
		const { d1, form, session, env } = await adminForm(event, 'editor');
		await setPublishStatus(d1, env, 'document', String(form.get('document_id')), true, session.userId);
		return { published: true };
	},

	unpublish: async (event) => {
		const { d1, form, session, env } = await adminForm(event, 'editor');
		await setPublishStatus(d1, env, 'document', String(form.get('document_id')), false, session.userId);
		return { unpublished: true };
	},

	delete: async (event) => {
		const { d1, db, form, session } = await adminForm(event, 'admin');
		const id = String(form.get('document_id') ?? '');
		await removeEntityFromIndex(d1, 'document', id);
		await db.delete(documentFiles).where(eq(documentFiles.documentId, id));
		await db.delete(documentI18n).where(eq(documentI18n.documentId, id));
		await db.delete(documents).where(eq(documents.id, id));
		await logAudit(db, { actorId: session.userId, action: 'delete', entityType: 'document', entityId: id });
		return { deleted: true };
	}
};
