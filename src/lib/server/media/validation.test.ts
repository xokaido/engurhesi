import { describe, expect, it } from 'vitest';
import { detectMime, validateUpload, isPresetAllowed } from '$lib/server/media/validation';

describe('media validation', () => {
	it('detects JPEG magic bytes', () => {
		const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00]);
		expect(detectMime(bytes)).toBe('image/jpeg');
	});

	it('detects PDF magic bytes', () => {
		const bytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]);
		expect(detectMime(bytes)).toBe('application/pdf');
	});

	it('rejects MIME mismatch on upload', () => {
		const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
		const result = validateUpload(bytes, 'image/png', 'image');
		expect(result.ok).toBe(false);
	});

	it('allows only preset allowlist', () => {
		expect(isPresetAllowed('thumb')).toBe(true);
		expect(isPresetAllowed('999')).toBe(false);
		expect(isPresetAllowed('thumb@2x')).toBe(false);
	});
});
