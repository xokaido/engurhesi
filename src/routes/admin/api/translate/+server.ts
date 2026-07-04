import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { requireRole } from '$lib/server/admin/guard';
import { verifyCsrf, verifyOrigin } from '$lib/server/auth/security';
import { loadGlossary } from '$lib/server/translate/service';
import { chunkSegments, translateChunk, type TextSegment } from '$lib/server/translate/openrouter';
import { applySegments, extractSegments } from '$lib/server/render/prosemirror';

interface TranslateRequest {
  /** short named fields, e.g. { title: '…', excerpt: '…' } */
  fields?: Record<string, string>;
  /** ProseMirror document JSON (rich text body) */
  bodyJson?: string | null;
}

/**
 * Translate Georgian content to English AND Russian in a single request.
 * Returns JSON — used by the admin UI to fill fields in place without a
 * page reload.
 */
export const POST: RequestHandler = async ({ request, locals, platform }) => {
  const session = requireRole(locals, 'draft_editor');
  const env = platform?.env;
  if (!env?.DB) return json({ ok: false, error: 'Database unavailable' }, { status: 503 });
  if (!verifyOrigin(request)) return json({ ok: false, error: 'Invalid origin' }, { status: 403 });
  if (!verifyCsrf(session.csrfToken, request.headers.get('x-csrf') ?? '')) {
    return json({ ok: false, error: 'Invalid CSRF token' }, { status: 403 });
  }
  if (!env.OPENROUTER_API_KEY) {
    return json({ ok: false, error: 'OPENROUTER_API_KEY is not configured' }, { status: 503 });
  }

  let payload: TranslateRequest;
  try {
    payload = (await request.json()) as TranslateRequest;
  } catch {
    return json({ ok: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  const segments: TextSegment[] = [];
  for (const [key, value] of Object.entries(payload.fields ?? {})) {
    if (typeof value === 'string' && value.trim()) {
      segments.push({ id: `field:${key}`, text: value.trim().slice(0, 4000) });
    }
  }

  let bodyDoc: unknown = null;
  if (payload.bodyJson) {
    try {
      bodyDoc = JSON.parse(payload.bodyJson);
      segments.push(...extractSegments(bodyDoc).map((s) => ({ id: `body:${s.id}`, text: s.text })));
    } catch {
      return json({ ok: false, error: 'Invalid body JSON' }, { status: 400 });
    }
  }

  if (segments.length === 0) {
    return json({ ok: false, error: 'Nothing to translate' }, { status: 400 });
  }
  if (segments.length > 400) {
    return json({ ok: false, error: 'Content too large' }, { status: 413 });
  }

  const glossary = await loadGlossary(env.DB);
  const enOut: TextSegment[] = [];
  const ruOut: TextSegment[] = [];
  try {
    for (const chunk of chunkSegments(segments)) {
      let result: { en: TextSegment[]; ru: TextSegment[] };
      try {
        result = await translateChunk(
          env.OPENROUTER_API_KEY,
          env.OPENROUTER_MODEL,
          chunk.segments,
          glossary
        );
      } catch {
        result = await translateChunk(
          env.OPENROUTER_API_KEY,
          env.OPENROUTER_FALLBACK_MODEL,
          chunk.segments,
          glossary
        );
      }
      enOut.push(...result.en);
      ruOut.push(...result.ru);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Translation failed';
    return json({ ok: false, error: message }, { status: 502 });
  }

  const build = (out: TextSegment[]) => {
    const fields: Record<string, string> = {};
    for (const s of out) {
      if (s.id.startsWith('field:')) fields[s.id.slice(6)] = s.text;
    }
    let bodyJson: string | null = null;
    if (bodyDoc) {
      const bodySegments = out
        .filter((s) => s.id.startsWith('body:'))
        .map((s) => ({ id: s.id.slice(5), text: s.text }));
      bodyJson = JSON.stringify(applySegments(bodyDoc, bodySegments));
    }
    return { fields, bodyJson };
  };

  return json({ ok: true, en: build(enOut), ru: build(ruOut) });
};
