/** Client for the admin translate API — one request returns EN and RU together. */

export interface TranslatedLocale {
  fields: Record<string, string>;
  bodyJson: string | null;
}

export interface TranslateResponse {
  ok: boolean;
  error?: string;
  en?: TranslatedLocale;
  ru?: TranslatedLocale;
}

export async function requestTranslation(
  csrf: string,
  payload: { fields?: Record<string, string>; bodyJson?: string | null }
): Promise<TranslateResponse> {
  try {
    const res = await fetch('/admin/api/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-csrf': csrf },
      body: JSON.stringify(payload)
    });
    return (await res.json()) as TranslateResponse;
  } catch {
    return { ok: false, error: 'ქსელის შეცდომა — სცადეთ თავიდან' };
  }
}
