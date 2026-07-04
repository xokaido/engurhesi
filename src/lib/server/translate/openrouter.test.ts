import { describe, expect, it } from 'vitest';
import { chunkSegments } from '$lib/server/translate/openrouter';

describe('translation chunking', () => {
	it('chunks long segment lists', () => {
		const segments = Array.from({ length: 95 }, (_, i) => ({
			id: `s${i}`,
			text: `Segment ${i}`
		}));
		const chunks = chunkSegments(segments, 40);
		expect(chunks).toHaveLength(3);
		expect(chunks[0].segments).toHaveLength(40);
		expect(chunks[2].segments).toHaveLength(15);
	});
});
