import type { Actions, PageServerLoad } from './$types';
import { error, fail } from '@sveltejs/kit';
import { createDb } from '$lib/server/db/client';
import { albumI18n, albumItems, albums, media, videoI18n, videos } from '$lib/server/db/schema';
import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { adminForm, requireRole } from '$lib/server/admin/guard';
import { resolveTrilingual, triFromForm } from '$lib/server/admin/i18n-forms';
import { slugify } from '$lib/server/content/slug';
import { logAudit } from '$lib/server/audit';
import { setPublishStatus } from '$lib/server/admin/publish';

export const load: PageServerLoad = async ({ locals, platform }) => {
  requireRole(locals, 'draft_editor');
  if (!platform?.env?.DB) error(503, 'Database unavailable');
  const db = createDb(platform.env.DB);

  const [albumRows, albumItemRows, videoRows, images, videoMedia, albumTitles, videoTitles] =
    await Promise.all([
      db
        .select({
          id: albums.id,
          slug: albums.slug,
          status: albums.status,
          coverMediaId: albums.coverMediaId,
          title: sql<string>`(SELECT title FROM album_i18n WHERE album_id = ${albums.id} AND locale = 'ka')`
        })
        .from(albums)
        .orderBy(desc(albums.createdAt)),
      db
        .select({ albumId: albumItems.albumId, mediaId: albumItems.mediaId, sort: albumItems.sort })
        .from(albumItems)
        .orderBy(asc(albumItems.sort)),
      db
        .select({
          id: videos.id,
          slug: videos.slug,
          status: videos.status,
          youtubeId: videos.youtubeId,
          mediaId: videos.mediaId,
          title: sql<string>`(SELECT title FROM video_i18n WHERE video_id = ${videos.id} AND locale = 'ka')`
        })
        .from(videos)
        .orderBy(desc(videos.createdAt)),
      db
        .select({ id: media.id, filename: media.originalFilename })
        .from(media)
        .where(and(eq(media.kind, 'image'), eq(media.status, 'active')))
        .orderBy(desc(media.createdAt))
        .limit(300),
      db
        .select({ id: media.id, filename: media.originalFilename })
        .from(media)
        .where(and(eq(media.kind, 'video'), eq(media.status, 'active')))
        .orderBy(desc(media.createdAt)),
      db
        .select({ albumId: albumI18n.albumId, locale: albumI18n.locale, title: albumI18n.title })
        .from(albumI18n),
      db
        .select({ videoId: videoI18n.videoId, locale: videoI18n.locale, title: videoI18n.title })
        .from(videoI18n)
    ]);

  return {
    albums: albumRows,
    albumItems: albumItemRows,
    videos: videoRows,
    images,
    videoMedia,
    albumTitles,
    videoTitles,
    csrf: locals.session!.csrfToken,
    role: locals.session!.role
  };
};

export const actions: Actions = {
  createAlbum: async (event) => {
    const { d1, db, form, session, env } = await adminForm(event, 'editor');
    const title = String(form.get('title') ?? '').trim();
    if (!title) return fail(400, { error: 'სათაური სავალდებულოა' });

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    let slug = slugify(title);
    const existing = await db.select().from(albums).where(eq(albums.slug, slug)).get();
    if (existing) slug = `${slug}-${id.slice(0, 6)}`;

    await db.insert(albums).values({
      id,
      slug,
      status: 'draft',
      createdAt: now,
      updatedAt: now,
      createdBy: session.userId,
      updatedBy: session.userId
    });
    const { values, warning } = await resolveTrilingual(d1, env, {
      title: { ka: title, en: '', ru: '' }
    });
    for (const locale of ['ka', 'en', 'ru'] as const) {
      if (!values.title[locale]) continue;
      await db.insert(albumI18n).values({
        albumId: id,
        locale,
        title: values.title[locale],
        reviewStatus: locale === 'ka' ? 'reviewed' : 'machine'
      });
    }
    await logAudit(db, {
      actorId: session.userId,
      action: 'create',
      entityType: 'album',
      entityId: id
    });
    return { albumCreated: true, warning };
  },

  setAlbumItems: async (event) => {
    const { db, form } = await adminForm(event, 'editor');
    const albumId = String(form.get('album_id') ?? '');
    const album = await db.select().from(albums).where(eq(albums.id, albumId)).get();
    if (!album) return fail(404, { error: 'Not found' });

    const ids = String(form.get('media_ids') ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    await db.delete(albumItems).where(eq(albumItems.albumId, albumId));
    for (const [index, mediaId] of ids.entries()) {
      await db.insert(albumItems).values({ albumId, mediaId, sort: index });
    }
    if (ids.length > 0 && !album.coverMediaId) {
      await db.update(albums).set({ coverMediaId: ids[0] }).where(eq(albums.id, albumId));
    }
    return { albumItemsSaved: true };
  },

  setAlbumTitles: async (event) => {
    const { d1, db, form, env } = await adminForm(event, 'editor');
    const albumId = String(form.get('album_id') ?? '');
    const input = triFromForm(form, 'title');
    if (!input.ka) return fail(400, { error: 'ქართული სათაური სავალდებულოა' });

    const { values, warning } = await resolveTrilingual(d1, env, { title: input });
    for (const locale of ['ka', 'en', 'ru'] as const) {
      const title = values.title[locale];
      if (!title) continue;
      const machine =
        locale === 'en' ? values.title.machineEn : locale === 'ru' ? values.title.machineRu : false;
      const reviewStatus = locale === 'ka' ? 'reviewed' : machine ? 'machine' : 'human_edited';
      const existing = await db
        .select()
        .from(albumI18n)
        .where(sql`${albumI18n.albumId} = ${albumId} AND ${albumI18n.locale} = ${locale}`)
        .get();
      if (existing) {
        await db
          .update(albumI18n)
          .set({ title, reviewStatus })
          .where(sql`${albumI18n.albumId} = ${albumId} AND ${albumI18n.locale} = ${locale}`);
      } else {
        await db.insert(albumI18n).values({ albumId, locale, title, reviewStatus });
      }
    }
    return { albumTitleSaved: true, warning };
  },

  publishAlbum: async (event) => {
    const { d1, form, session, env } = await adminForm(event, 'editor');
    const publish = String(form.get('publish')) === '1';
    await setPublishStatus(d1, env, 'album', String(form.get('album_id')), publish, session.userId);
    return { albumPublished: true };
  },

  deleteAlbum: async (event) => {
    const { db, form, session } = await adminForm(event, 'admin');
    const id = String(form.get('album_id') ?? '');
    await db.delete(albumItems).where(eq(albumItems.albumId, id));
    await db.delete(albumI18n).where(eq(albumI18n.albumId, id));
    await db.delete(albums).where(eq(albums.id, id));
    await logAudit(db, {
      actorId: session.userId,
      action: 'delete',
      entityType: 'album',
      entityId: id
    });
    return { albumDeleted: true };
  },

  createVideo: async (event) => {
    const { d1, db, form, session, env } = await adminForm(event, 'editor');
    const title = String(form.get('title') ?? '').trim();
    const youtubeId = String(form.get('youtube_id') ?? '').trim() || null;
    const mediaId = String(form.get('media_id') ?? '').trim() || null;
    const thumbMediaId = String(form.get('thumb_media_id') ?? '').trim() || null;
    if (!title) return fail(400, { error: 'სათაური სავალდებულოა' });
    if (!youtubeId && !mediaId) {
      return fail(400, { error: 'მიუთითეთ YouTube ID ან ვიდეო ფაილი' });
    }
    if (youtubeId && !/^[\w-]{6,20}$/.test(youtubeId)) {
      return fail(400, { error: 'არასწორი YouTube ID' });
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    let slug = slugify(title);
    const existing = await db.select().from(videos).where(eq(videos.slug, slug)).get();
    if (existing) slug = `${slug}-${id.slice(0, 6)}`;

    await db.insert(videos).values({
      id,
      slug,
      youtubeId,
      mediaId,
      thumbMediaId,
      status: 'draft',
      createdAt: now,
      updatedAt: now,
      createdBy: session.userId,
      updatedBy: session.userId
    });
    const { values, warning } = await resolveTrilingual(d1, env, {
      title: { ka: title, en: '', ru: '' }
    });
    for (const locale of ['ka', 'en', 'ru'] as const) {
      if (!values.title[locale]) continue;
      await db.insert(videoI18n).values({
        videoId: id,
        locale,
        title: values.title[locale],
        reviewStatus: locale === 'ka' ? 'reviewed' : 'machine'
      });
    }
    await logAudit(db, {
      actorId: session.userId,
      action: 'create',
      entityType: 'video',
      entityId: id
    });
    return { videoCreated: true, warning };
  },

  setVideoTitles: async (event) => {
    const { d1, db, form, env } = await adminForm(event, 'editor');
    const videoId = String(form.get('video_id') ?? '');
    const input = triFromForm(form, 'title');
    if (!input.ka) return fail(400, { error: 'ქართული სათაური სავალდებულოა' });

    const { values, warning } = await resolveTrilingual(d1, env, { title: input });
    for (const locale of ['ka', 'en', 'ru'] as const) {
      const title = values.title[locale];
      if (!title) continue;
      const machine =
        locale === 'en' ? values.title.machineEn : locale === 'ru' ? values.title.machineRu : false;
      const reviewStatus = locale === 'ka' ? 'reviewed' : machine ? 'machine' : 'human_edited';
      const existing = await db
        .select()
        .from(videoI18n)
        .where(sql`${videoI18n.videoId} = ${videoId} AND ${videoI18n.locale} = ${locale}`)
        .get();
      if (existing) {
        await db
          .update(videoI18n)
          .set({ title, reviewStatus })
          .where(sql`${videoI18n.videoId} = ${videoId} AND ${videoI18n.locale} = ${locale}`);
      } else {
        await db.insert(videoI18n).values({ videoId, locale, title, reviewStatus });
      }
    }
    return { videoTitleSaved: true, warning };
  },

  publishVideo: async (event) => {
    const { d1, form, session, env } = await adminForm(event, 'editor');
    const publish = String(form.get('publish')) === '1';
    await setPublishStatus(d1, env, 'video', String(form.get('video_id')), publish, session.userId);
    return { videoPublished: true };
  },

  deleteVideo: async (event) => {
    const { db, form, session } = await adminForm(event, 'admin');
    const id = String(form.get('video_id') ?? '');
    await db.delete(videoI18n).where(eq(videoI18n.videoId, id));
    await db.delete(videos).where(eq(videos.id, id));
    await logAudit(db, {
      actorId: session.userId,
      action: 'delete',
      entityType: 'video',
      entityId: id
    });
    return { videoDeleted: true };
  }
};
