/** Shared (client-safe) types. */

export interface MediaRef {
	id: string;
	r2Key: string;
	width: number | null;
	height: number | null;
	placeholderColor: string | null;
	alt: string;
}

export type ImagePresetName = 'thumb' | 'card' | 'content' | 'hero' | 'original';

/** Media URLs are keyed by media id; the routes resolve id → R2 key and
 * enforce status = active. */
export function mediaImgUrl(mediaId: string, preset: ImagePresetName): string {
	return `/media/img/${mediaId}/${preset}`;
}

export function mediaFileUrl(mediaId: string): string {
	return `/media/file/${mediaId}`;
}

export function mediaVideoUrl(mediaId: string): string {
	return `/media/video/${mediaId}`;
}

export function formatBytes(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
