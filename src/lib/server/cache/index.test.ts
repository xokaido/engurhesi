import { describe, expect, it } from 'vitest';
import { buildCacheKey, snapshotKey, cacheTagsHeader } from '$lib/server/cache';

describe('cache utilities', () => {
  it('builds a version-prefixed cache key with allowed pagination param only', () => {
    const req = new Request('https://engurhesi.ge/ka/news?page=2&utm=x');
    const key = buildCacheKey(req);
    expect(key).toMatch(/^\/__v\/[^/]+\/ka\/news\?page=2$/);
  });

  it('builds snapshot key', () => {
    expect(snapshotKey('ka', '/news')).toBe('snapshots/ka/news.html');
  });

  it('joins cache tags', () => {
    expect(cacheTagsHeader(['home', 'news:1'])).toBe('home,news:1');
  });
});
