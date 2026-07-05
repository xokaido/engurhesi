// Cloudflare Workers caps WebCrypto PBKDF2 at 100k iterations — the platform maximum.
const PBKDF2_ITERATIONS = 100_000;

export async function hashPassword(
  password: string,
  saltB64: string
): Promise<{ hash: string; salt: string }> {
  const salt = Uint8Array.from(atob(saltB64), (c) => c.charCodeAt(0));
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const derived = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256'
    },
    keyMaterial,
    256
  );
  const hash = btoa(String.fromCharCode(...new Uint8Array(derived)));
  return { hash, salt: saltB64 };
}

export function generateSalt(): string {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode(...salt));
}

export async function verifyPassword(
  password: string,
  saltB64: string,
  expectedHash: string
): Promise<boolean> {
  const { hash } = await hashPassword(password, saltB64);
  return timingSafeEqual(hash, expectedHash);
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

export function generateSessionToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export async function hashToken(token: string, pepper = ''): Promise<string> {
  const data = new TextEncoder().encode(token + pepper);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function generateCsrfToken(): string {
  return generateSessionToken();
}

export const SESSION_COOKIE = 'eh_session';
export const IDLE_MS = 12 * 60 * 60 * 1000;
export const ABSOLUTE_MS = 7 * 24 * 60 * 60 * 1000;

export function sessionCookieOptions(maxAgeSeconds: number): string {
  return `Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAgeSeconds}`;
}

export async function benchmarkPbkdf2Ms(): Promise<number> {
  const salt = generateSalt();
  const start = performance.now();
  await hashPassword('benchmark-password', salt);
  return performance.now() - start;
}
