import type { D1Database, R2Bucket } from '@cloudflare/workers-types';
import { eq } from 'drizzle-orm';
import { createDb } from '../db/client';
import { media } from '../db/schema';
import { logAudit } from '../audit';
import { sha256Hex, validateUpload } from './validation';

/** Best-effort intrinsic dimensions for PNG / JPEG / WebP. */
export function imageDimensions(
	bytes: Uint8Array
): { width: number; height: number } | null {
	// PNG: IHDR at fixed offset
	if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes.length > 24) {
		const dv = new DataView(bytes.buffer, bytes.byteOffset);
		return { width: dv.getUint32(16), height: dv.getUint32(20) };
	}
	// JPEG: scan for SOFn markers
	if (bytes[0] === 0xff && bytes[1] === 0xd8) {
		let offset = 2;
		while (offset + 9 < bytes.length) {
			if (bytes[offset] !== 0xff) {
				offset++;
				continue;
			}
			const marker = bytes[offset + 1];
			if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
				const dv = new DataView(bytes.buffer, bytes.byteOffset + offset + 5);
				return { height: dv.getUint16(0), width: dv.getUint16(2) };
			}
			const dv = new DataView(bytes.buffer, bytes.byteOffset + offset + 2);
			offset += 2 + dv.getUint16(0);
		}
		return null;
	}
	// WebP VP8X extended header
	if (
		bytes.length > 30 &&
		bytes[12] === 0x56 &&
		bytes[13] === 0x50 &&
		bytes[14] === 0x38 &&
		bytes[15] === 0x58
	) {
		const width = 1 + (bytes[24] | (bytes[25] << 8) | (bytes[26] << 16));
		const height = 1 + (bytes[27] | (bytes[28] << 8) | (bytes[29] << 16));
		return { width, height };
	}
	return null;
}

export interface UploadResult {
	ok: boolean;
	mediaId?: string;
	error?: string;
}

/**
 * Quarantine upload path: create row as pending, validate magic bytes / size /
 * declared type, store in R2, then flip to active or rejected (AGENTS.md §7.1).
 */
export async function processUpload(
	d1: D1Database,
	r2: R2Bucket,
	file: File,
	kind: 'image' | 'document' | 'video',
	actorId: string
): Promise<UploadResult> {
	if (file.size === 0) return { ok: false, error: 'Empty file' };

	const bytes = new Uint8Array(await file.arrayBuffer());
	const db = createDb(d1);
	const id = crypto.randomUUID();
	const now = new Date().toISOString();
	const checksum = await sha256Hex(bytes);
	const safeName = file.name.replace(/[^\w.\-() ]+/g, '_').slice(0, 180) || 'file';
	const r2Key = `${kind}s/${checksum.slice(0, 12)}-${safeName}`;

	await db.insert(media).values({
		id,
		r2Key,
		kind,
		declaredMime: file.type || 'application/octet-stream',
		size: bytes.byteLength,
		originalFilename: safeName,
		checksum,
		status: 'pending',
		createdBy: actorId,
		createdAt: now,
		updatedAt: now
	});

	const validation = validateUpload(bytes, file.type || 'application/octet-stream', kind);
	const dims = kind === 'image' && validation.ok ? imageDimensions(bytes) : null;

	if (!validation.ok) {
		await db
			.update(media)
			.set({
				status: 'rejected',
				detectedMime: validation.detectedMime,
				updatedAt: new Date().toISOString()
			})
			.where(eq(media.id, id));
		await logAudit(db, {
			actorId,
			action: 'media_rejected',
			entityType: 'media',
			entityId: id,
			detail: { reason: validation.reason, filename: safeName }
		});
		return { ok: false, error: validation.reason };
	}

	await r2.put(r2Key, bytes, {
		httpMetadata: { contentType: validation.detectedMime ?? undefined }
	});

	await db
		.update(media)
		.set({
			status: 'active',
			detectedMime: validation.detectedMime,
			width: dims?.width ?? null,
			height: dims?.height ?? null,
			updatedAt: new Date().toISOString()
		})
		.where(eq(media.id, id));

	await logAudit(db, {
		actorId,
		action: 'media_uploaded',
		entityType: 'media',
		entityId: id,
		detail: { filename: safeName, kind, size: bytes.byteLength, mime: validation.detectedMime }
	});

	return { ok: true, mediaId: id };
}

