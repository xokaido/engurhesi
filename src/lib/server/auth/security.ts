export async function verifyTurnstile(
	secret: string,
	token: string,
	remoteIp?: string
): Promise<boolean> {
	const body = new URLSearchParams({
		secret,
		response: token
	});
	if (remoteIp) body.set('remoteip', remoteIp);

	const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
		method: 'POST',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		body
	});
	if (!res.ok) return false;
	const data = (await res.json()) as { success?: boolean };
	return data.success === true;
}

export function verifyOrigin(request: Request): boolean {
	const origin = request.headers.get('Origin');
	const host = request.headers.get('Host');
	if (!origin || !host) return false;
	try {
		return new URL(origin).host === host;
	} catch {
		return false;
	}
}

export function verifyCsrf(sessionToken: string, submitted: string | null): boolean {
	if (!submitted || !sessionToken) return false;
	if (sessionToken.length !== submitted.length) return false;
	let result = 0;
	for (let i = 0; i < sessionToken.length; i++) {
		result |= sessionToken.charCodeAt(i) ^ submitted.charCodeAt(i);
	}
	return result === 0;
}
