import type { Actions, PageServerLoad } from './$types';
import { error, fail } from '@sveltejs/kit';
import { createDb } from '$lib/server/db/client';
import { media, mediaI18n } from '$lib/server/db/schema';
import { desc, eq, sql } from 'drizzle-orm';
import { adminForm, requireRole } from '$lib/server/admin/guard';
import { resolveTrilingual, triFromForm } from '$lib/server/admin/i18n-forms';
import { processUpload } from '$lib/server/media/upload';
import { logAudit } from '$lib/server/audit';

async function upsertAlt(
  db: ReturnType<typeof createDb>,
  mediaId: string,
  locale: 'ka' | 'en' | 'ru',
  alt: string
) {
  const existing = await db
    .select()
    .from(mediaI18n)
    .where(sql`${mediaI18n.mediaId} = ${mediaId} AND ${mediaI18n.locale} = ${locale}`)
    .get();
  if (existing) {
    await db
      .update(mediaI18n)
      .set({ alt })
      .where(sql`${mediaI18n.mediaId} = ${mediaId} AND ${mediaI18n.locale} = ${locale}`);
  } else {
    await db.insert(mediaI18n).values({ mediaId, locale, alt });
  }
}

export const load: PageServerLoad = async ({ locals, platform, url }) => {
  requireRole(locals, 'draft_editor');
  if (!platform?.env?.DB) error(503, 'Database unavailable');
  const db = createDb(platform.env.DB);

  const kind = url.searchParams.get('kind');
  const kindFilter = kind === 'image' || kind === 'document' || kind === 'video' ? kind : null;

  const rows = await db
    .select({
      id: media.id,
      kind: media.kind,
      status: media.status,
      size: media.size,
      width: media.width,
      height: media.height,
      filename: media.originalFilename,
      detectedMime: media.detectedMime,
      createdAt: media.createdAt,
      altKa: sql<
        string | null
      >`(SELECT alt FROM media_i18n WHERE media_id = ${media.id} AND locale = 'ka')`,
      altEn: sql<
        string | null
      >`(SELECT alt FROM media_i18n WHERE media_id = ${media.id} AND locale = 'en')`,
      altRu: sql<
        string | null
      >`(SELECT alt FROM media_i18n WHERE media_id = ${media.id} AND locale = 'ru')`
    })
    .from(media)
    .where(kindFilter ? eq(media.kind, kindFilter) : sql`1 = 1`)
    .orderBy(desc(media.createdAt))
    .limit(300);

  return {
    items: rows,
    kind: kindFilter,
    csrf: locals.session!.csrfToken,
    role: locals.session!.role
  };
};

export const actions: Actions = {
  // draft_editor cannot upload public files (AGENTS.md §5)
  upload: async (event) => {
    const { d1, form, session, env } = await adminForm(event, 'editor');
    const file = form.get('file');
    const kind = String(form.get('kind') ?? 'image');
    if (!(file instanceof File) || file.size === 0) {
      return fail(400, { error: 'ფაილი სავალდებულოა' });
    }
    if (!['image', 'document', 'video'].includes(kind)) {
      return fail(400, { error: 'Invalid kind' });
    }

    const result = await processUpload(
      d1,
      env.R2,
      file,
      kind as 'image' | 'document' | 'video',
      session.userId
    );
    if (!result.ok) return fail(400, { error: `ფაილი უარყოფილია: ${result.error}` });

    const alt = String(form.get('alt') ?? '').trim();
    let warning: string | undefined;
    if (alt) {
      const db = createDb(d1);
      const resolved = await resolveTrilingual(d1, env, { alt: { ka: alt, en: '', ru: '' } });
      warning = resolved.warning;
      for (const locale of ['ka', 'en', 'ru'] as const) {
        if (resolved.values.alt[locale]) {
          await upsertAlt(db, result.mediaId!, locale, resolved.values.alt[locale]);
        }
      }
    }
    return { uploaded: true, warning };
  },

  setAlt: async (event) => {
    const { d1, db, form, env } = await adminForm(event, 'draft_editor');
    const mediaId = String(form.get('media_id') ?? '');
    const input = triFromForm(form, 'alt');
    if (!input.ka) return fail(400, { error: 'ქართული ალტ-ტექსტი სავალდებულოა' });

    const { values, warning } = await resolveTrilingual(d1, env, { alt: input });
    for (const locale of ['ka', 'en', 'ru'] as const) {
      if (values.alt[locale]) await upsertAlt(db, mediaId, locale, values.alt[locale]);
    }
    return { altSaved: true, warning };
  },

  delete: async (event) => {
    const { db, form, session, env } = await adminForm(event, 'admin');
    const mediaId = String(form.get('media_id') ?? '');
    const row = await db.select().from(media).where(eq(media.id, mediaId)).get();
    if (!row) return fail(404, { error: 'Not found' });

    await env.R2.delete(row.r2Key);
    await db.delete(mediaI18n).where(eq(mediaI18n.mediaId, mediaId));
    await db.delete(media).where(eq(media.id, mediaId));
    await logAudit(db, {
      actorId: session.userId,
      action: 'delete',
      entityType: 'media',
      entityId: mediaId,
      detail: { filename: row.originalFilename }
    });
    return { deleted: true };
  }
};
