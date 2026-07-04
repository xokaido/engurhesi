import { describe, expect, it } from 'vitest';
import { generateSalt, hashPassword, verifyPassword, benchmarkPbkdf2Ms } from '$lib/server/auth/password';
import { verifyCsrf } from '$lib/server/auth/security';

describe('auth', () => {
	it('hashes and verifies password', async () => {
		const salt = generateSalt();
		const { hash } = await hashPassword('test-password', salt);
		expect(await verifyPassword('test-password', salt, hash)).toBe(true);
		expect(await verifyPassword('wrong', salt, hash)).toBe(false);
	});

	it('benchmarks PBKDF2 under reasonable time', async () => {
		const ms = await benchmarkPbkdf2Ms();
		expect(ms).toBeGreaterThan(20);
		expect(ms).toBeLessThan(5000);
	});

	it('compares CSRF tokens in constant time semantics', () => {
		expect(verifyCsrf('abc', 'abc')).toBe(true);
		expect(verifyCsrf('abc', 'abd')).toBe(false);
	});
});
