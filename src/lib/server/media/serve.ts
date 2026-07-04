import type { ImagesBinding, R2Bucket } from '@cloudflare/workers-types';
import { IMAGE_PRESETS, type ImagePreset } from './validation';
import { putCachedResponse, cacheTagsHeader } from '../cache';
import { toBody, toImageInputStream } from '../workers-compat';

function getRangeBounds(
	range: { offset?: number; length?: number; suffix?: number },
	total: number
): { offset: number; length: number } {
	if (range.suffix !== undefined) {
		return { offset: Math.max(0, total - range.suffix), length: range.suffix };
	}
	const offset = range.offset ?? 0;
	const length = range.length ?? total - offset;
	return { offset, length };
}

export async function serveImagePreset(
	r2: R2Bucket,
	images: ImagesBinding | undefined,
	cache: Cache,
	request: Request,
	r2Key: string,
	preset: ImagePreset,
	mediaId: string,
	isDev: boolean
): Promise<Response> {
	const obj = await r2.get(r2Key);
	if (!obj) return new Response('Not found', { status: 404 });

	const bytes = new Uint8Array(await obj.arrayBuffer());
	const contentType = obj.httpMetadata?.contentType ?? 'application/octet-stream';
	const config = IMAGE_PRESETS[preset];

	if (isDev || !images || preset === 'original' || config.width === null) {
		console.log('[images] dev passthrough — binding unavailable or original preset');
		return new Response(bytes, {
			headers: {
				'Content-Type': contentType,
				'X-Image-Passthrough': '1'
			}
		});
	}

	try {
		const transformed = await images
			.input(toImageInputStream(bytes) as Parameters<ImagesBinding['input']>[0])
			.transform({
				width: config.width,
				fit: 'scale-down'
			})
			.output({ format: 'image/webp', quality: config.quality });

		const imageResponse = transformed.response();
		const headers = new Headers();
		imageResponse.headers.forEach((value, key) => headers.set(key, value));
		headers.set('Cache-Control', 'public, max-age=31536000, immutable');
		headers.set('Cache-Tag', cacheTagsHeader([`media:${mediaId}`]));

		const response = new Response(toBody(imageResponse.body), { status: 200, headers });
		await putCachedResponse(cache, request, response.clone(), [`media:${mediaId}`]);
		return response;
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Transform failed';
		if (message.includes('unsupported') || message.includes('format')) {
			return new Response('Unsupported image format', {
				status: 415,
				headers: { 'Content-Type': 'text/plain' }
			});
		}
		return new Response(bytes, {
			headers: { 'Content-Type': contentType, 'X-Image-Fallback': '1' }
		});
	}
}

export async function serveVideoRange(
	r2: R2Bucket,
	r2Key: string,
	request: Request
): Promise<Response> {
	const rangeHeader = request.headers.get('Range');
	const obj = await r2.get(r2Key, rangeHeader ? { range: parseRange(rangeHeader) } : undefined);

	if (!obj) return new Response('Not found', { status: 404 });

	const headers = new Headers();
	headers.set('Accept-Ranges', 'bytes');
	headers.set('Content-Type', obj.httpMetadata?.contentType ?? 'video/mp4');
	headers.set('X-Content-Type-Options', 'nosniff');
	headers.set('Cache-Control', 'no-store');

	if (obj.range) {
		const { offset, length } = getRangeBounds(obj.range, obj.size);
		headers.set('Content-Range', `bytes ${offset}-${offset + length - 1}/${obj.size}`);
		headers.set('Content-Length', String(length));
		return new Response(toBody(obj.body), { status: 206, headers });
	}

	headers.set('Content-Length', String(obj.size));
	return new Response(toBody(obj.body), { status: 200, headers });
}

function parseRange(header: string): { offset: number; length?: number } | undefined {
	const match = /^bytes=(\d+)-(\d*)$/.exec(header);
	if (!match) return undefined;
	const offset = Number(match[1]);
	const end = match[2] ? Number(match[2]) : undefined;
	if (end !== undefined) {
		return { offset, length: end - offset + 1 };
	}
	return { offset };
}
