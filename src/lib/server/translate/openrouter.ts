import { z } from 'zod';

export const TRANSLATION_MODEL = 'google/gemini-3.1-pro-preview';
export const TRANSLATION_FALLBACK_MODEL = 'google/gemini-2.5-pro-preview';

export interface TextSegment {
	id: string;
	text: string;
}

export interface TranslationChunk {
	segments: TextSegment[];
}

const translationResponseSchema = z.object({
	en: z.array(z.object({ id: z.string(), text: z.string() })),
	ru: z.array(z.object({ id: z.string(), text: z.string() }))
});

export function chunkSegments(segments: TextSegment[], maxPerChunk = 40): TranslationChunk[] {
	const chunks: TranslationChunk[] = [];
	for (let i = 0; i < segments.length; i += maxPerChunk) {
		chunks.push({ segments: segments.slice(i, i + maxPerChunk) });
	}
	return chunks;
}

export async function translateChunk(
	apiKey: string,
	model: string,
	segments: TextSegment[],
	glossary: Array<{ termKa: string; termEn: string; termRu: string }> = []
): Promise<{ en: TextSegment[]; ru: TextSegment[] }> {
	const schema = {
		type: 'object',
		properties: {
			en: {
				type: 'array',
				items: {
					type: 'object',
					properties: { id: { type: 'string' }, text: { type: 'string' } },
					required: ['id', 'text'],
					additionalProperties: false
				}
			},
			ru: {
				type: 'array',
				items: {
					type: 'object',
					properties: { id: { type: 'string' }, text: { type: 'string' } },
					required: ['id', 'text'],
					additionalProperties: false
				}
			}
		},
		required: ['en', 'ru'],
		additionalProperties: false
	};

	const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${apiKey}`,
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({
			model,
			messages: [
				{
					role: 'system',
					content:
						'Translate Georgian source segments to English and Russian. Preserve segment ids exactly. Apply glossary terms.'
				},
				{
					role: 'user',
					content: JSON.stringify({ segments, glossary })
				}
			],
			response_format: {
				type: 'json_schema',
				json_schema: {
					name: 'translation',
					strict: true,
					schema
				}
			},
			provider: {
				require_parameters: true
			}
		})
	});

	if (!res.ok) {
		throw new Error(`OpenRouter error ${res.status}: ${await res.text()}`);
	}

	const payload = (await res.json()) as {
		choices?: Array<{ message?: { content?: string } }>;
	};
	const content = payload.choices?.[0]?.message?.content;
	if (!content) throw new Error('Empty translation response');

	const parsed = translationResponseSchema.parse(JSON.parse(content));
	validateSegmentIds(segments, parsed.en, 'en');
	validateSegmentIds(segments, parsed.ru, 'ru');
	return parsed;
}

function validateSegmentIds(source: TextSegment[], translated: TextSegment[], locale: string) {
	const sourceIds = new Set(source.map((s) => s.id));
	const outIds = new Set(translated.map((s) => s.id));
	if (sourceIds.size !== outIds.size || ![...sourceIds].every((id) => outIds.has(id))) {
		throw new Error(`Segment id mismatch for ${locale}`);
	}
}

export async function verifyModelCatalog(
	apiKey: string,
	modelId: string
): Promise<boolean> {
	const res = await fetch('https://openrouter.ai/api/v1/models', {
		headers: { Authorization: `Bearer ${apiKey}` }
	});
	if (!res.ok) return false;
	const data = (await res.json()) as { data?: Array<{ id: string }> };
	return (data.data ?? []).some((m) => m.id === modelId);
}
