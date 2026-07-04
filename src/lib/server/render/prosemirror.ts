import { Schema, Node as ProseMirrorNode } from 'prosemirror-model';

// ---------------------------------------------------------------------------
// Canonical editorial schema (content_schema_version = 1).
// Matches the TipTap configuration in the admin editor exactly; anything the
// admin cannot author is rejected on save (validateDocument) rather than
// silently stripped.
// ---------------------------------------------------------------------------

const nodes = {
	doc: { content: 'block+' },
	paragraph: { group: 'block', content: 'inline*' },
	heading: {
		attrs: { level: { default: 2 } },
		group: 'block',
		content: 'inline*'
	},
	bulletList: { group: 'block', content: 'listItem+' },
	orderedList: { group: 'block', content: 'listItem+' },
	listItem: { content: 'block+' },
	blockquote: { group: 'block', content: 'block+' },
	horizontalRule: { group: 'block' },
	/** Images reference media rows by id only — never arbitrary URLs. */
	image: {
		group: 'block',
		attrs: { mediaId: { default: '' }, alt: { default: '' } }
	},
	hardBreak: { group: 'inline', inline: true },
	text: { group: 'inline' }
};

const marks = {
	bold: {},
	italic: {},
	link: {
		attrs: { href: { default: '' } },
		inclusive: false
	}
};

export const CONTENT_SCHEMA_VERSION = 1;

export const contentSchema = new Schema({ nodes, marks });
/** @deprecated Phase 0 alias */
export const spikeSchema = contentSchema;

export interface RenderResult {
	html: string;
	text: string;
}

const ALLOWED_LINK = /^(https?:|mailto:)/i;

export function emptyDocJson(): string {
	return JSON.stringify({ type: 'doc', content: [{ type: 'paragraph' }] });
}

/**
 * Strict validation on save: parses against the exact schema and rejects
 * unknown nodes/marks (ProseMirror throws on unknown types).
 */
export function validateDocument(json: unknown): { ok: true } | { ok: false; error: string } {
	try {
		const doc = ProseMirrorNode.fromJSON(contentSchema, json);
		doc.check();
		return { ok: true };
	} catch (err) {
		return { ok: false, error: err instanceof Error ? err.message : 'Invalid document' };
	}
}

export function renderDocument(
	json: unknown,
	schemaVersion = CONTENT_SCHEMA_VERSION
): RenderResult {
	if (schemaVersion > CONTENT_SCHEMA_VERSION) {
		return {
			html: '<p class="render-fallback">Content uses a newer schema version.</p>',
			text: ''
		};
	}

	let doc: ProseMirrorNode;
	try {
		doc = ProseMirrorNode.fromJSON(contentSchema, json);
	} catch {
		return { html: '<p class="render-fallback">Invalid content.</p>', text: '' };
	}

	const html = renderNode(doc);
	const text = extractText(doc);
	return { html: sanitizeHtml(html), text };
}

function renderInlineText(node: ProseMirrorNode): string {
	let text = escapeHtml(node.text ?? '');
	for (const mark of node.marks) {
		if (mark.type.name === 'bold') text = `<strong>${text}</strong>`;
		if (mark.type.name === 'italic') text = `<em>${text}</em>`;
		if (mark.type.name === 'link') {
			const href = String(mark.attrs.href ?? '');
			if (ALLOWED_LINK.test(href)) {
				text = `<a href="${escapeAttr(href)}" rel="noopener noreferrer">${text}</a>`;
			}
		}
	}
	return text;
}

function renderNode(node: ProseMirrorNode): string {
	if (node.isText) return renderInlineText(node);

	const inner = node.content.content.map(renderNode).join('');
	switch (node.type.name) {
		case 'doc':
			return inner;
		case 'paragraph':
			return `<p>${inner}</p>`;
		case 'heading': {
			const level = Math.min(4, Math.max(2, Number(node.attrs.level) || 2));
			return `<h${level}>${inner}</h${level}>`;
		}
		case 'bulletList':
			return `<ul>${inner}</ul>`;
		case 'orderedList':
			return `<ol>${inner}</ol>`;
		case 'listItem':
			return `<li>${inner}</li>`;
		case 'blockquote':
			return `<blockquote>${inner}</blockquote>`;
		case 'horizontalRule':
			return '<hr>';
		case 'hardBreak':
			return '<br>';
		case 'image': {
			const mediaId = String(node.attrs.mediaId ?? '');
			// Only media-id references; the /media/img route enforces status=active.
			if (!/^[A-Za-z0-9_-]+$/.test(mediaId)) return '';
			const alt = escapeAttr(String(node.attrs.alt ?? ''));
			return `<figure class="content-image"><img src="/media/img/${escapeAttr(mediaId)}/content" alt="${alt}" loading="lazy" decoding="async"></figure>`;
		}
		default:
			// Retired node types: render-fallback, never fail (AGENTS.md §6.4)
			return `<p class="render-fallback">${inner}</p>`;
	}
}

function extractText(node: ProseMirrorNode): string {
	if (node.isText) return node.text ?? '';
	return node.content.content.map(extractText).join(' ').replace(/\s+/g, ' ').trim();
}

function escapeHtml(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

function escapeAttr(value: string): string {
	return escapeHtml(value).replace(/'/g, '&#39;');
}

/** Defense-in-depth: strip anything our renderer can never emit. */
export function sanitizeHtml(html: string): string {
	return html
		.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
		.replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
		.replace(/javascript:/gi, '');
}

/** Legacy schema v0: plain paragraph wrapper */
export function renderLegacyV0(body: string): RenderResult {
	const safe = escapeHtml(body);
	return { html: `<p>${safe}</p>`, text: body };
}

/**
 * Extract translatable text segments with stable ids (path-based), used by the
 * translation pipeline. Structure is preserved by the application; only text
 * leaves travel to the model.
 */
export function extractSegments(json: unknown): Array<{ id: string; text: string }> {
	const segments: Array<{ id: string; text: string }> = [];
	const walk = (node: Record<string, unknown>, path: string) => {
		if (node.type === 'text' && typeof node.text === 'string' && node.text.trim()) {
			segments.push({ id: path, text: node.text });
		}
		const content = node.content;
		if (Array.isArray(content)) {
			content.forEach((child, i) => walk(child as Record<string, unknown>, `${path}.${i}`));
		}
	};
	if (json && typeof json === 'object') walk(json as Record<string, unknown>, 'r');
	return segments;
}

/** Apply translated segments back onto a structural copy of the document. */
export function applySegments(
	json: unknown,
	translated: Array<{ id: string; text: string }>
): unknown {
	const map = new Map(translated.map((s) => [s.id, s.text]));
	const clone = JSON.parse(JSON.stringify(json)) as Record<string, unknown>;
	const walk = (node: Record<string, unknown>, path: string) => {
		if (node.type === 'text' && typeof node.text === 'string' && node.text.trim()) {
			const replacement = map.get(path);
			if (replacement !== undefined) node.text = replacement;
		}
		const content = node.content;
		if (Array.isArray(content)) {
			content.forEach((child, i) => walk(child as Record<string, unknown>, `${path}.${i}`));
		}
	};
	walk(clone, 'r');
	return clone;
}

/** Content hash of the KA source used for stale-translation detection. */
export async function sourceHashOf(title: string, bodyJson: string | null): Promise<string> {
	const data = new TextEncoder().encode(`${title}\n${bodyJson ?? ''}`);
	const digest = await crypto.subtle.digest('SHA-256', data);
	return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
