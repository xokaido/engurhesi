export const IMAGE_PRESETS = {
	thumb: { width: 320, quality: 80, format: 'webp' as const },
	card: { width: 640, quality: 82, format: 'webp' as const },
	content: { width: 960, quality: 85, format: 'webp' as const },
	hero: { width: 1600, quality: 88, format: 'webp' as const },
	original: { width: null, quality: 90, format: 'webp' as const }
} as const;

export type ImagePreset = keyof typeof IMAGE_PRESETS;

export const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
export const MAX_PDF_BYTES = 50 * 1024 * 1024;

const MAGIC: Record<string, number[][]> = {
	'image/jpeg': [[0xff, 0xd8, 0xff]],
	'image/png': [[0x89, 0x50, 0x4e, 0x47]],
	'image/webp': [[0x52, 0x49, 0x46, 0x46]], // RIFF — WebP has WEBP at offset 8
	'application/pdf': [[0x25, 0x50, 0x44, 0x46]],
	'video/mp4': [[0x00, 0x00, 0x00], [0x66, 0x74, 0x79, 0x70]] // ftyp at offset 4
};

export function detectMime(bytes: Uint8Array): string | null {
	for (const [mime, signatures] of Object.entries(MAGIC)) {
		for (const sig of signatures) {
			const offset = mime === 'video/mp4' ? 4 : 0;
			if (sig.every((b, i) => bytes[offset + i] === b)) return mime;
		}
	}
	if (
		bytes.length >= 12 &&
		bytes[0] === 0x52 &&
		bytes[1] === 0x49 &&
		bytes[2] === 0x46 &&
		bytes[3] === 0x46 &&
		bytes[8] === 0x57 &&
		bytes[9] === 0x45 &&
		bytes[10] === 0x42 &&
		bytes[11] === 0x50
	) {
		return 'image/webp';
	}
	return null;
}

export function isPresetAllowed(preset: string): preset is ImagePreset {
	return preset in IMAGE_PRESETS;
}

export async function sha256Hex(data: ArrayBuffer | Uint8Array): Promise<string> {
	const buffer =
		data instanceof Uint8Array
			? data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)
			: data;
	const digest = await crypto.subtle.digest('SHA-256', buffer as ArrayBuffer);
	return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export interface ValidationResult {
	ok: boolean;
	detectedMime: string | null;
	reason?: string;
}

export function validateUpload(
	bytes: Uint8Array,
	declaredMime: string,
	kind: 'image' | 'document' | 'video'
): ValidationResult {
	const detected = detectMime(bytes);
	if (!detected) {
		return { ok: false, detectedMime: null, reason: 'Unknown file type' };
	}

	if (kind === 'image' && !detected.startsWith('image/')) {
		return { ok: false, detectedMime: detected, reason: 'Not an image' };
	}
	if (kind === 'document' && detected !== 'application/pdf') {
		return { ok: false, detectedMime: detected, reason: 'Only PDF documents allowed' };
	}
	if (kind === 'video' && !detected.startsWith('video/')) {
		return { ok: false, detectedMime: detected, reason: 'Not a video' };
	}

	const max =
		kind === 'image' ? MAX_IMAGE_BYTES : kind === 'document' ? MAX_PDF_BYTES : 500 * 1024 * 1024;
	if (bytes.byteLength > max) {
		return { ok: false, detectedMime: detected, reason: 'File too large' };
	}

	if (declaredMime !== detected && kind !== 'video') {
		return { ok: false, detectedMime: detected, reason: 'MIME mismatch' };
	}

	return { ok: true, detectedMime: detected };
}

export function mediaResponseHeaders(
	detectedMime: string,
	filename: string
): Record<string, string> {
	const headers: Record<string, string> = {
		'X-Content-Type-Options': 'nosniff',
		'Content-Type': detectedMime
	};

	if (detectedMime === 'application/pdf') {
		headers['Content-Security-Policy'] = 'sandbox';
		headers['Content-Disposition'] = `inline; filename="${filename}"`;
	} else if (
		detectedMime.startsWith('image/') ||
		detectedMime.startsWith('video/') ||
		detectedMime.startsWith('audio/')
	) {
		headers['Content-Disposition'] = `inline; filename="${filename}"`;
	} else {
		headers['Content-Disposition'] = `attachment; filename="${filename}"`;
	}

	return headers;
}
