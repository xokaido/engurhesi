import type { D1Database } from '@cloudflare/workers-types';
import type { Env } from '../../../app.d';
import { chunkSegments, translateChunk, type TextSegment } from './openrouter';
import { RICH_ENTITIES, saveEntityI18n, type RichEntityType } from '../content/save';
import { applySegments, extractSegments, sourceHashOf } from '../render/prosemirror';

export const PROMPT_VERSION = 'v1';

interface KaSource {
  title: string;
  bodyJson: string | null;
  extras: Record<string, string | null>;
}

async function loadKaSource(
  d1: D1Database,
  entityType: RichEntityType,
  entityId: string
): Promise<KaSource | null> {
  const cfg = RICH_ENTITIES[entityType];
  const extraCols = cfg.extras.length ? `, ${cfg.extras.join(', ')}` : '';
  const row = await d1
    .prepare(
      `SELECT title, body_json${extraCols} FROM ${cfg.i18nTable} WHERE ${cfg.fk} = ? AND locale = 'ka'`
    )
    .bind(entityId)
    .first<Record<string, string | null>>();
  if (!row || !row.title) return null;
  const extras: Record<string, string | null> = {};
  for (const col of cfg.extras) extras[col] = (row[col] as string | null) ?? null;
  return { title: row.title as string, bodyJson: (row.body_json as string | null) ?? null, extras };
}

export async function loadGlossary(d1: D1Database) {
  const rows = await d1
    .prepare('SELECT term_ka, term_en, term_ru FROM glossary')
    .all<{ term_ka: string; term_en: string; term_ru: string }>();
  return (rows.results ?? []).map((r) => ({
    termKa: r.term_ka,
    termEn: r.term_en,
    termRu: r.term_ru
  }));
}

export interface TranslateEntityResult {
  ok: boolean;
  error?: string;
  locales?: string[];
}

export interface TranslateFieldsResult {
  ok: boolean;
  error?: string;
  en: Record<string, string>;
  ru: Record<string, string>;
}

/**
 * Translate a map of short Georgian fields to EN + RU in one request.
 * Used by simple admin forms (partner names, stat labels, alt texts …)
 * so that saving the Georgian value fills the other locales automatically.
 */
export async function translateFields(
  d1: D1Database,
  env: Pick<Env, 'OPENROUTER_API_KEY' | 'OPENROUTER_MODEL' | 'OPENROUTER_FALLBACK_MODEL'>,
  fields: Record<string, string>
): Promise<TranslateFieldsResult> {
  if (!env.OPENROUTER_API_KEY) {
    return { ok: false, error: 'OPENROUTER_API_KEY is not configured', en: {}, ru: {} };
  }

  const segments: TextSegment[] = Object.entries(fields)
    .filter(([, text]) => text && text.trim())
    .map(([id, text]) => ({ id, text }));
  if (segments.length === 0) return { ok: true, en: {}, ru: {} };

  const glossaryTerms = await loadGlossary(d1);
  let result: { en: TextSegment[]; ru: TextSegment[] };
  try {
    result = await translateChunk(
      env.OPENROUTER_API_KEY,
      env.OPENROUTER_MODEL,
      segments,
      glossaryTerms
    );
  } catch {
    try {
      result = await translateChunk(
        env.OPENROUTER_API_KEY,
        env.OPENROUTER_FALLBACK_MODEL,
        segments,
        glossaryTerms
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Translation failed';
      return { ok: false, error: message, en: {}, ru: {} };
    }
  }

  const toMap = (out: TextSegment[]) =>
    Object.fromEntries(out.map((s) => [s.id, s.text])) as Record<string, string>;
  return { ok: true, en: toMap(result.en), ru: toMap(result.ru) };
}

/**
 * Translate one entity KA → EN + RU in a single structured-output request per
 * chunk. Existing human_edited/reviewed target locales are left untouched.
 */
export async function translateEntity(
  d1: D1Database,
  env: Pick<Env, 'OPENROUTER_API_KEY' | 'OPENROUTER_MODEL' | 'OPENROUTER_FALLBACK_MODEL'>,
  entityType: RichEntityType,
  entityId: string,
  actorId: string | null
): Promise<TranslateEntityResult> {
  if (!env.OPENROUTER_API_KEY) {
    return { ok: false, error: 'OPENROUTER_API_KEY is not configured' };
  }

  const source = await loadKaSource(d1, entityType, entityId);
  if (!source) return { ok: false, error: 'Georgian source content not found' };

  // Build segments: title + extras + body text leaves (stable ids)
  const segments: TextSegment[] = [{ id: 'title', text: source.title }];
  for (const [col, value] of Object.entries(source.extras)) {
    if (value && value.trim()) segments.push({ id: `extra:${col}`, text: value });
  }
  let bodyDoc: unknown = null;
  if (source.bodyJson) {
    try {
      bodyDoc = JSON.parse(source.bodyJson);
      segments.push(...extractSegments(bodyDoc).map((s) => ({ id: `body:${s.id}`, text: s.text })));
    } catch {
      return { ok: false, error: 'Georgian body JSON is invalid' };
    }
  }

  const glossaryTerms = await loadGlossary(d1);
  const chunks = chunkSegments(segments);
  const enOut: TextSegment[] = [];
  const ruOut: TextSegment[] = [];

  for (const chunk of chunks) {
    let result: { en: TextSegment[]; ru: TextSegment[] };
    try {
      result = await translateChunk(
        env.OPENROUTER_API_KEY,
        env.OPENROUTER_MODEL,
        chunk.segments,
        glossaryTerms
      );
    } catch {
      // fallback model, one retry
      result = await translateChunk(
        env.OPENROUTER_API_KEY,
        env.OPENROUTER_FALLBACK_MODEL,
        chunk.segments,
        glossaryTerms
      );
    }
    enOut.push(...result.en);
    ruOut.push(...result.ru);
  }

  const srcHash = await sourceHashOf(source.title, source.bodyJson);
  const model = env.OPENROUTER_MODEL;
  const savedLocales: string[] = [];

  for (const [locale, out] of [
    ['en', enOut],
    ['ru', ruOut]
  ] as const) {
    const title = out.find((s) => s.id === 'title')?.text ?? source.title;
    const extras: Record<string, string | null> = {};
    for (const col of Object.keys(source.extras)) {
      extras[col] = out.find((s) => s.id === `extra:${col}`)?.text ?? source.extras[col];
    }
    let bodyJson: string | null = null;
    if (bodyDoc) {
      const bodySegments = out
        .filter((s) => s.id.startsWith('body:'))
        .map((s) => ({ id: s.id.slice(5), text: s.text }));
      bodyJson = JSON.stringify(applySegments(bodyDoc, bodySegments));
    }

    const saved = await saveEntityI18n(
      d1,
      entityType,
      entityId,
      locale,
      {
        title,
        bodyJson,
        extras,
        machine: {
          model,
          provider: 'openrouter',
          promptVersion: PROMPT_VERSION,
          sourceHash: srcHash
        }
      },
      actorId
    );
    if (saved.ok) savedLocales.push(locale);
    // "Human-edited translation would be overwritten" is an expected skip
  }

  return { ok: true, locales: savedLocales };
}
