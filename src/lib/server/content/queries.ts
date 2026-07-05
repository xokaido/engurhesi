import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import type { Db } from '../db/client';
import {
  albumI18n,
  albumItems,
  albums,
  articleI18n,
  articles,
  documentFiles,
  documentI18n,
  documents,
  media,
  mediaI18n,
  orgUnitI18n,
  orgUnits,
  pageI18n,
  pages,
  partnerI18n,
  partners,
  procurementDocs,
  procurementDocsI18n,
  procurementI18n,
  procurements,
  projectI18n,
  projects,
  settings,
  statI18n,
  stats,
  videoI18n,
  videos
} from '../db/schema';
import type { Locale } from '$lib/i18n';

// ---------------------------------------------------------------------------
// Locale fallback: pick requested locale if present & non-empty, else KA.
// ---------------------------------------------------------------------------

export interface LocalePick<T> {
  value: T;
  /** true when we fell back to Georgian */
  fallback: boolean;
  /** true when content is an unreviewed machine translation */
  machine: boolean;
}

function pickI18n<T extends { locale: string; title?: string; reviewStatus?: string }>(
  rows: T[],
  locale: Locale
): LocalePick<T> | null {
  const exact = rows.find((r) => r.locale === locale && (r.title ?? '').trim() !== '');
  if (exact) {
    return {
      value: exact,
      fallback: false,
      machine: locale !== 'ka' && exact.reviewStatus === 'machine'
    };
  }
  const ka = rows.find((r) => r.locale === 'ka');
  if (ka) return { value: ka, fallback: locale !== 'ka', machine: false };
  return null;
}

function localesFor(locale: Locale): Locale[] {
  return locale === 'ka' ? ['ka'] : [locale, 'ka'];
}

// ---------------------------------------------------------------------------
// Media helpers
// ---------------------------------------------------------------------------

export interface MediaRef {
  id: string;
  r2Key: string;
  width: number | null;
  height: number | null;
  placeholderColor: string | null;
  alt: string;
}

export async function getMediaRefs(
  db: Db,
  ids: string[],
  locale: Locale
): Promise<Map<string, MediaRef>> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return new Map();
  const rows = await db
    .select()
    .from(media)
    .where(and(inArray(media.id, unique), eq(media.status, 'active')));
  const i18nRows = await db
    .select()
    .from(mediaI18n)
    .where(and(inArray(mediaI18n.mediaId, unique), inArray(mediaI18n.locale, localesFor(locale))));

  const out = new Map<string, MediaRef>();
  for (const row of rows) {
    const alts = i18nRows.filter((r) => r.mediaId === row.id);
    const alt =
      alts.find((r) => r.locale === locale)?.alt ?? alts.find((r) => r.locale === 'ka')?.alt ?? '';
    out.set(row.id, {
      id: row.id,
      r2Key: row.r2Key,
      width: row.width,
      height: row.height,
      placeholderColor: row.placeholderColor,
      alt: alt ?? ''
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Articles (news)
// ---------------------------------------------------------------------------

export interface ArticleCard {
  slug: string;
  category: string;
  publishedAt: string | null;
  title: string;
  excerpt: string | null;
  cover: MediaRef | null;
  fallback: boolean;
  machine: boolean;
}

export async function listArticles(
  db: Db,
  locale: Locale,
  opts: { category?: string; page?: number; perPage?: number } = {}
): Promise<{ items: ArticleCard[]; total: number; page: number; pages: number }> {
  const perPage = opts.perPage ?? 9;
  const page = Math.max(1, opts.page ?? 1);

  const where = opts.category
    ? and(
        eq(articles.status, 'published'),
        eq(articles.category, opts.category as 'news' | 'announcement' | 'publication')
      )
    : eq(articles.status, 'published');

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(articles)
    .where(where);

  const rows = await db
    .select()
    .from(articles)
    .where(where)
    .orderBy(desc(articles.publishedAt))
    .limit(perPage)
    .offset((page - 1) * perPage);

  const ids = rows.map((r) => r.id);
  const i18nRows = ids.length
    ? await db
        .select()
        .from(articleI18n)
        .where(
          and(inArray(articleI18n.articleId, ids), inArray(articleI18n.locale, localesFor(locale)))
        )
    : [];
  const covers = await getMediaRefs(
    db,
    rows.map((r) => r.coverMediaId ?? ''),
    locale
  );

  const items: ArticleCard[] = [];
  for (const row of rows) {
    const pick = pickI18n(
      i18nRows.filter((r) => r.articleId === row.id),
      locale
    );
    if (!pick) continue;
    items.push({
      slug: row.slug,
      category: row.category,
      publishedAt: row.publishedAt,
      title: pick.value.title,
      excerpt: pick.value.excerpt,
      cover: row.coverMediaId ? (covers.get(row.coverMediaId) ?? null) : null,
      fallback: pick.fallback,
      machine: pick.machine
    });
  }
  return { items, total: count, page, pages: Math.max(1, Math.ceil(count / perPage)) };
}

export async function getArticle(db: Db, locale: Locale, slug: string) {
  const row = await db
    .select()
    .from(articles)
    .where(and(eq(articles.slug, slug), eq(articles.status, 'published')))
    .get();
  if (!row) return null;

  const i18nRows = await db
    .select()
    .from(articleI18n)
    .where(and(eq(articleI18n.articleId, row.id), inArray(articleI18n.locale, localesFor(locale))));
  const pick = pickI18n(i18nRows, locale);
  if (!pick) return null;

  const covers = await getMediaRefs(db, [row.coverMediaId ?? ''], locale);
  return {
    id: row.id,
    slug: row.slug,
    category: row.category,
    publishedAt: row.publishedAt,
    title: pick.value.title,
    excerpt: pick.value.excerpt,
    seoDescription: pick.value.seoDescription,
    bodyHtml: pick.value.bodyHtml ?? '',
    cover: row.coverMediaId ? (covers.get(row.coverMediaId) ?? null) : null,
    fallback: pick.fallback,
    machine: pick.machine
  };
}

// ---------------------------------------------------------------------------
// Procurement
// ---------------------------------------------------------------------------

const CLOSED_STATUSES = ['closed', 'canceled', 'awarded', 'archived'] as const;

export interface ProcurementRow {
  slug: string;
  kind: string;
  status: string;
  publishedAt: string | null;
  deadlineAt: string | null;
  deadlinePassed: boolean;
  isOpen: boolean;
  title: string;
  fallback: boolean;
  machine: boolean;
}

function toProcurementRow(
  row: typeof procurements.$inferSelect,
  pick: LocalePick<typeof procurementI18n.$inferSelect>
): ProcurementRow {
  const deadlinePassed = !!row.deadlineAt && new Date(row.deadlineAt).getTime() < Date.now();
  const isOpen = (row.status === 'published' || row.status === 'amended') && !deadlinePassed;
  return {
    slug: row.slug,
    kind: row.kind,
    status: row.status,
    publishedAt: row.publishedAt,
    deadlineAt: row.deadlineAt,
    deadlinePassed,
    isOpen,
    title: pick.value.title,
    fallback: pick.fallback,
    machine: pick.machine
  };
}

export async function listProcurements(
  db: Db,
  locale: Locale,
  opts: { kind?: 'tender' | 'auction'; open?: boolean } = {}
): Promise<ProcurementRow[]> {
  const notDraft = inArray(procurements.status, ['published', 'amended', ...CLOSED_STATUSES]);
  const where = opts.kind ? and(notDraft, eq(procurements.kind, opts.kind)) : notDraft;

  const rows = await db
    .select()
    .from(procurements)
    .where(where)
    .orderBy(desc(procurements.publishedAt));

  const ids = rows.map((r) => r.id);
  const i18nRows = ids.length
    ? await db
        .select()
        .from(procurementI18n)
        .where(
          and(
            inArray(procurementI18n.procurementId, ids),
            inArray(procurementI18n.locale, localesFor(locale))
          )
        )
    : [];

  const out: ProcurementRow[] = [];
  for (const row of rows) {
    const pick = pickI18n(
      i18nRows.filter((r) => r.procurementId === row.id),
      locale
    );
    if (!pick) continue;
    const item = toProcurementRow(row, pick);
    if (opts.open !== undefined && item.isOpen !== opts.open) continue;
    out.push(item);
  }
  return out;
}

export async function getProcurement(db: Db, locale: Locale, slug: string) {
  const row = await db.select().from(procurements).where(eq(procurements.slug, slug)).get();
  if (!row || row.status === 'draft') return null;

  const i18nRows = await db
    .select()
    .from(procurementI18n)
    .where(
      and(
        eq(procurementI18n.procurementId, row.id),
        inArray(procurementI18n.locale, localesFor(locale))
      )
    );
  const pick = pickI18n(i18nRows, locale);
  if (!pick) return null;

  const docRows = await db
    .select({
      id: procurementDocs.id,
      mediaId: procurementDocs.mediaId,
      locale: procurementDocs.locale,
      sort: procurementDocs.sort,
      revision: procurementDocs.revision,
      r2Key: media.r2Key,
      size: media.size,
      filename: media.originalFilename
    })
    .from(procurementDocs)
    .innerJoin(media, eq(procurementDocs.mediaId, media.id))
    .where(and(eq(procurementDocs.procurementId, row.id), eq(media.status, 'active')))
    .orderBy(asc(procurementDocs.sort), asc(procurementDocs.revision));

  const docIds = docRows.map((d) => d.id);
  const docTitles = docIds.length
    ? await db.select().from(procurementDocsI18n).where(inArray(procurementDocsI18n.docId, docIds))
    : [];

  const docs = docRows
    .filter((d) => !d.locale || d.locale === locale)
    .map((d) => {
      const titles = docTitles.filter((tr) => tr.docId === d.id);
      const title =
        titles.find((tr) => tr.locale === locale)?.title ||
        titles.find((tr) => tr.locale === 'ka')?.title ||
        d.filename;
      return { mediaId: d.mediaId, title, size: d.size, revision: d.revision };
    });

  // amendment lineage
  const amends = row.amendsId
    ? await db.select().from(procurements).where(eq(procurements.id, row.amendsId)).get()
    : null;

  return {
    ...toProcurementRow(row, pick),
    bodyHtml: pick.value.bodyHtml ?? '',
    amendmentSummary: pick.value.amendmentSummary,
    previousDeadlineAt: row.previousDeadlineAt,
    tenderNumber: row.tenderNumber,
    tenderUrl: row.tenderUrl,
    amendsSlug: amends?.slug ?? null,
    docs
  };
}

// ---------------------------------------------------------------------------
// Pages
// ---------------------------------------------------------------------------

export async function listAboutPages(db: Db, locale: Locale) {
  const rows = await db
    .select()
    .from(pages)
    .where(and(eq(pages.section, 'about'), eq(pages.status, 'published')))
    .orderBy(asc(pages.sort));
  const ids = rows.map((r) => r.id);
  const i18nRows = ids.length
    ? await db
        .select()
        .from(pageI18n)
        .where(and(inArray(pageI18n.pageId, ids), inArray(pageI18n.locale, localesFor(locale))))
    : [];

  return rows.flatMap((row) => {
    const pick = pickI18n(
      i18nRows.filter((r) => r.pageId === row.id),
      locale
    );
    if (!pick) return [];
    return [{ slug: row.slug, title: pick.value.title, fallback: pick.fallback }];
  });
}

export async function getPage(db: Db, locale: Locale, slug: string) {
  const row = await db
    .select()
    .from(pages)
    .where(and(eq(pages.slug, slug), eq(pages.status, 'published')))
    .get();
  if (!row) return null;
  const i18nRows = await db
    .select()
    .from(pageI18n)
    .where(and(eq(pageI18n.pageId, row.id), inArray(pageI18n.locale, localesFor(locale))));
  const pick = pickI18n(i18nRows, locale);
  if (!pick) return null;
  return {
    id: row.id,
    slug: row.slug,
    title: pick.value.title,
    seoTitle: pick.value.seoTitle,
    seoDescription: pick.value.seoDescription,
    bodyHtml: pick.value.bodyHtml ?? '',
    fallback: pick.fallback,
    machine: pick.machine
  };
}

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

export async function listProjects(db: Db, locale: Locale) {
  const rows = await db
    .select()
    .from(projects)
    .where(eq(projects.status, 'published'))
    .orderBy(asc(projects.sort));
  const ids = rows.map((r) => r.id);
  const i18nRows = ids.length
    ? await db
        .select()
        .from(projectI18n)
        .where(
          and(inArray(projectI18n.projectId, ids), inArray(projectI18n.locale, localesFor(locale)))
        )
    : [];
  const covers = await getMediaRefs(
    db,
    rows.map((r) => r.coverMediaId ?? ''),
    locale
  );

  return rows.flatMap((row) => {
    const pick = pickI18n(
      i18nRows.filter((r) => r.projectId === row.id),
      locale
    );
    if (!pick) return [];
    return [
      {
        slug: row.slug,
        title: pick.value.title,
        summary: pick.value.summary,
        cover: row.coverMediaId ? (covers.get(row.coverMediaId) ?? null) : null,
        fallback: pick.fallback,
        machine: pick.machine
      }
    ];
  });
}

export async function getProject(db: Db, locale: Locale, slug: string) {
  const row = await db
    .select()
    .from(projects)
    .where(and(eq(projects.slug, slug), eq(projects.status, 'published')))
    .get();
  if (!row) return null;
  const i18nRows = await db
    .select()
    .from(projectI18n)
    .where(and(eq(projectI18n.projectId, row.id), inArray(projectI18n.locale, localesFor(locale))));
  const pick = pickI18n(i18nRows, locale);
  if (!pick) return null;
  const covers = await getMediaRefs(db, [row.coverMediaId ?? ''], locale);

  let facts: Array<{ label: string; value: string }> = [];
  if (row.factsJson) {
    try {
      const parsed = JSON.parse(row.factsJson) as Record<
        string,
        Array<{ label: string; value: string }>
      >;
      facts = parsed[locale] ?? parsed.ka ?? [];
    } catch {
      facts = [];
    }
  }

  return {
    slug: row.slug,
    title: pick.value.title,
    summary: pick.value.summary,
    bodyHtml: pick.value.bodyHtml ?? '',
    facts,
    cover: row.coverMediaId ? (covers.get(row.coverMediaId) ?? null) : null,
    fallback: pick.fallback,
    machine: pick.machine
  };
}

// ---------------------------------------------------------------------------
// Documents (report library)
// ---------------------------------------------------------------------------

export async function listDocuments(db: Db, locale: Locale) {
  const rows = await db
    .select()
    .from(documents)
    .where(eq(documents.status, 'published'))
    .orderBy(desc(documents.year), asc(documents.sort));
  const ids = rows.map((r) => r.id);
  const i18nRows = ids.length
    ? await db
        .select()
        .from(documentI18n)
        .where(
          and(
            inArray(documentI18n.documentId, ids),
            inArray(documentI18n.locale, localesFor(locale))
          )
        )
    : [];
  const files = ids.length
    ? await db
        .select({
          documentId: documentFiles.documentId,
          locale: documentFiles.locale,
          mediaId: documentFiles.mediaId,
          size: media.size
        })
        .from(documentFiles)
        .innerJoin(media, eq(documentFiles.mediaId, media.id))
        .where(and(inArray(documentFiles.documentId, ids), eq(media.status, 'active')))
    : [];

  return rows.flatMap((row) => {
    const pick = pickI18n(
      i18nRows.filter((r) => r.documentId === row.id),
      locale
    );
    if (!pick) return [];
    return [
      {
        slug: row.slug,
        category: row.category,
        year: row.year,
        title: pick.value.title,
        description: pick.value.description,
        files: files
          .filter((f) => f.documentId === row.id)
          .map((f) => ({ locale: f.locale, mediaId: f.mediaId, size: f.size })),
        fallback: pick.fallback
      }
    ];
  });
}

// ---------------------------------------------------------------------------
// Albums & videos
// ---------------------------------------------------------------------------

export async function listAlbums(db: Db, locale: Locale) {
  const rows = await db
    .select()
    .from(albums)
    .where(eq(albums.status, 'published'))
    .orderBy(asc(albums.sort), desc(albums.publishedAt));
  const ids = rows.map((r) => r.id);
  const i18nRows = ids.length
    ? await db
        .select()
        .from(albumI18n)
        .where(and(inArray(albumI18n.albumId, ids), inArray(albumI18n.locale, localesFor(locale))))
    : [];
  const covers = await getMediaRefs(
    db,
    rows.map((r) => r.coverMediaId ?? ''),
    locale
  );
  const counts = ids.length
    ? await db
        .select({ albumId: albumItems.albumId, count: sql<number>`count(*)` })
        .from(albumItems)
        .where(inArray(albumItems.albumId, ids))
        .groupBy(albumItems.albumId)
    : [];

  return rows.flatMap((row) => {
    const pick = pickI18n(
      i18nRows.filter((r) => r.albumId === row.id),
      locale
    );
    if (!pick) return [];
    return [
      {
        slug: row.slug,
        title: pick.value.title,
        cover: row.coverMediaId ? (covers.get(row.coverMediaId) ?? null) : null,
        count: counts.find((c) => c.albumId === row.id)?.count ?? 0,
        fallback: pick.fallback
      }
    ];
  });
}

export async function getAlbum(db: Db, locale: Locale, slug: string) {
  const row = await db
    .select()
    .from(albums)
    .where(and(eq(albums.slug, slug), eq(albums.status, 'published')))
    .get();
  if (!row) return null;
  const i18nRows = await db
    .select()
    .from(albumI18n)
    .where(and(eq(albumI18n.albumId, row.id), inArray(albumI18n.locale, localesFor(locale))));
  const pick = pickI18n(i18nRows, locale);
  if (!pick) return null;

  const items = await db
    .select({ mediaId: albumItems.mediaId })
    .from(albumItems)
    .where(eq(albumItems.albumId, row.id))
    .orderBy(asc(albumItems.sort));
  const refs = await getMediaRefs(
    db,
    items.map((i) => i.mediaId),
    locale
  );

  return {
    slug: row.slug,
    title: pick.value.title,
    description: pick.value.description,
    items: items.flatMap((i) => {
      const ref = refs.get(i.mediaId);
      return ref ? [ref] : [];
    }),
    fallback: pick.fallback
  };
}

export async function listVideos(db: Db, locale: Locale) {
  const rows = await db
    .select()
    .from(videos)
    .where(eq(videos.status, 'published'))
    .orderBy(asc(videos.sort), desc(videos.publishedAt));
  const ids = rows.map((r) => r.id);
  const i18nRows = ids.length
    ? await db
        .select()
        .from(videoI18n)
        .where(and(inArray(videoI18n.videoId, ids), inArray(videoI18n.locale, localesFor(locale))))
    : [];
  const thumbs = await getMediaRefs(
    db,
    rows.map((r) => r.thumbMediaId ?? ''),
    locale
  );

  return rows.flatMap((row) => {
    const pick = pickI18n(
      i18nRows.filter((r) => r.videoId === row.id),
      locale
    );
    if (!pick) return [];
    return [
      {
        slug: row.slug,
        title: pick.value.title,
        description: pick.value.description,
        videoMediaId: row.mediaId,
        youtubeId: row.youtubeId,
        thumb: row.thumbMediaId ? (thumbs.get(row.thumbMediaId) ?? null) : null,
        fallback: pick.fallback
      }
    ];
  });
}

// ---------------------------------------------------------------------------
// Partners / org / stats / settings
// ---------------------------------------------------------------------------

export async function listPartners(db: Db, locale: Locale) {
  const rows = await db.select().from(partners).orderBy(asc(partners.sort));
  const ids = rows.map((r) => r.id);
  const names = ids.length
    ? await db
        .select()
        .from(partnerI18n)
        .where(
          and(inArray(partnerI18n.partnerId, ids), inArray(partnerI18n.locale, localesFor(locale)))
        )
    : [];
  const logos = await getMediaRefs(
    db,
    rows.map((r) => r.logoMediaId ?? ''),
    locale
  );
  return rows.map((row) => {
    const n = names.filter((x) => x.partnerId === row.id);
    return {
      name:
        n.find((x) => x.locale === locale)?.name || n.find((x) => x.locale === 'ka')?.name || '',
      url: row.url,
      logo: row.logoMediaId ? (logos.get(row.logoMediaId) ?? null) : null
    };
  });
}

export interface OrgNode {
  id: string;
  title: string;
  personName: string | null;
  children: OrgNode[];
}

export async function listOrgTree(db: Db, locale: Locale): Promise<OrgNode[]> {
  const rows = await db.select().from(orgUnits).orderBy(asc(orgUnits.sort));
  const ids = rows.map((r) => r.id);
  const i18nRows = ids.length
    ? await db
        .select()
        .from(orgUnitI18n)
        .where(
          and(inArray(orgUnitI18n.orgUnitId, ids), inArray(orgUnitI18n.locale, localesFor(locale)))
        )
    : [];

  const nodes = new Map<string, OrgNode>();
  for (const row of rows) {
    const i18n = i18nRows.filter((r) => r.orgUnitId === row.id);
    const exact = i18n.find((r) => r.locale === locale && r.title.trim() !== '');
    const ka = i18n.find((r) => r.locale === 'ka');
    const chosen = exact ?? ka;
    nodes.set(row.id, {
      id: row.id,
      title: chosen?.title ?? '',
      personName: chosen?.personName ?? null,
      children: []
    });
  }
  const roots: OrgNode[] = [];
  for (const row of rows) {
    const node = nodes.get(row.id)!;
    if (row.parentId && nodes.has(row.parentId)) {
      nodes.get(row.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

export async function listStats(db: Db, locale: Locale) {
  const rows = await db.select().from(stats).orderBy(asc(stats.sort));
  const ids = rows.map((r) => r.id);
  const labels = ids.length
    ? await db
        .select()
        .from(statI18n)
        .where(and(inArray(statI18n.statId, ids), inArray(statI18n.locale, localesFor(locale))))
    : [];
  return rows.map((row) => {
    const l = labels.filter((x) => x.statId === row.id);
    return {
      key: row.key,
      value: row.value,
      unit: row.unit,
      label:
        l.find((x) => x.locale === locale)?.label || l.find((x) => x.locale === 'ka')?.label || ''
    };
  });
}

export async function getSettingsMap(db: Db): Promise<Record<string, string>> {
  const rows = await db.select().from(settings);
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

export function settingForLocale(map: Record<string, string>, key: string, locale: Locale): string {
  return map[`${key}_${locale}`] ?? map[`${key}_ka`] ?? map[key] ?? '';
}
