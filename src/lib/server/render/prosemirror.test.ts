import { describe, expect, it } from 'vitest';
import { renderDocument, renderLegacyV0, sanitizeHtml } from '$lib/server/render/prosemirror';

describe('prosemirror renderer', () => {
	it('renders safe HTML from JSON', () => {
		const doc = {
			type: 'doc',
			content: [
				{
					type: 'paragraph',
					content: [{ type: 'text', text: 'Hello engurhesi' }]
				}
			]
		};
		const { html, text } = renderDocument(doc);
		expect(html).toContain('<p>Hello engurhesi</p>');
		expect(text).toBe('Hello engurhesi');
	});

	it('blocks javascript: links', () => {
		const doc = {
			type: 'doc',
			content: [
				{
					type: 'paragraph',
					content: [
						{
							type: 'text',
							text: 'click',
							marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }]
						}
					]
				}
			]
		};
		const { html } = renderDocument(doc);
		expect(html).not.toContain('javascript:');
		expect(html).toContain('click');
	});

	it('strips script injection from sanitizeHtml', () => {
		expect(sanitizeHtml('<p>ok</p><script>alert(1)</script>')).not.toContain('<script');
	});

	it('renders legacy v0 fixture', () => {
		const { html } = renderLegacyV0('Legacy body');
		expect(html).toBe('<p>Legacy body</p>');
	});
});
