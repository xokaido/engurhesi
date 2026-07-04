import type { D1Database } from '@cloudflare/workers-types';
import type { Env } from '../../../app.d';
import { translateFields } from '../translate/service';

export interface TriValue {
  ka: string;
  en: string;
  ru: string;
  /** true when the locale value came from machine translation this request */
  machineEn: boolean;
  machineRu: boolean;
}

export interface TriInput {
  ka: string;
  en: string;
  ru: string;
}

const WARNING_PREFIX = 'ქართული ვერსია შენახულია, მაგრამ ავტომატური თარგმანი ვერ შესრულდა';

/**
 * Resolve trilingual admin-form fields in one translation request.
 *
 * For every named field the Georgian value is authoritative; empty EN/RU
 * values are machine-translated from it, non-empty ones are kept as typed
 * (human edits). Returns a user-facing warning instead of failing when the
 * translation provider is unavailable.
 */
export async function resolveTrilingual(
  d1: D1Database,
  env: Pick<Env, 'OPENROUTER_API_KEY' | 'OPENROUTER_MODEL' | 'OPENROUTER_FALLBACK_MODEL'>,
  fields: Record<string, TriInput>
): Promise<{ values: Record<string, TriValue>; warning?: string }> {
  const toTranslate: Record<string, string> = {};
  for (const [key, field] of Object.entries(fields)) {
    if (field.ka.trim() && (!field.en.trim() || !field.ru.trim())) {
      toTranslate[key] = field.ka.trim();
    }
  }

  let translated: {
    ok: boolean;
    error?: string;
    en: Record<string, string>;
    ru: Record<string, string>;
  } = {
    ok: true,
    en: {},
    ru: {}
  };
  if (Object.keys(toTranslate).length > 0) {
    translated = await translateFields(d1, env, toTranslate);
  }

  const values: Record<string, TriValue> = {};
  for (const [key, field] of Object.entries(fields)) {
    const en = field.en.trim() || translated.en[key] || '';
    const ru = field.ru.trim() || translated.ru[key] || '';
    values[key] = {
      ka: field.ka.trim(),
      en,
      ru,
      machineEn: !field.en.trim() && !!translated.en[key],
      machineRu: !field.ru.trim() && !!translated.ru[key]
    };
  }

  return {
    values,
    warning: translated.ok ? undefined : `${WARNING_PREFIX}: ${translated.error}`
  };
}

/** Read `<name>_ka` / `<name>_en` / `<name>_ru` inputs from a form. */
export function triFromForm(form: FormData, name: string): TriInput {
  return {
    ka: String(form.get(`${name}_ka`) ?? '').trim(),
    en: String(form.get(`${name}_en`) ?? '').trim(),
    ru: String(form.get(`${name}_ru`) ?? '').trim()
  };
}
