import type { D1Database, R2Bucket, Queue, ImagesBinding } from '@cloudflare/workers-types';

declare global {
	namespace App {
		interface Platform {
			env: Env;
			context: ExecutionContext;
			caches: CacheStorage & { default: Cache };
		}
		interface Locals {
			session?: {
				id: string;
				userId: string;
				role: 'admin' | 'editor' | 'draft_editor';
				csrfToken: string;
				name: string;
				email: string;
			};
		}
	}
}

export interface Env {
	DB: D1Database;
	R2: R2Bucket;
	SNAPSHOTS: R2Bucket;
	JOBS: Queue;
	IMAGES: ImagesBinding;
	ASSETS: Fetcher;
	ENVIRONMENT: string;
	TURNSTILE_SITE_KEY: string;
	TURNSTILE_SECRET?: string;
	OPENROUTER_API_KEY?: string;
	OPENROUTER_MODEL: string;
	OPENROUTER_FALLBACK_MODEL: string;
	SESSION_PEPPER?: string;
	CF_ACCOUNT_ID?: string;
	CF_API_TOKEN?: string;
	CF_ZONE_ID?: string;
	/** Phase 0 spike: force D1 failure on cached routes */
	SPIKE_FORCE_D1_FAILURE?: string;
}

export {};
