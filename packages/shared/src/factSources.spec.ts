import { describe, expect, it } from 'vitest';
import { normalizeFactSourceUrl } from './factSources';

describe('music source URLs', () => {
  it('normalizes the same retrieved page consistently across attribution and cache layers', () => {
    expect(normalizeFactSourceUrl('https://EXAMPLE.com:443/music#recording')).toBe('https://example.com/music');
    expect(normalizeFactSourceUrl('https://example.com')).toBe('https://example.com/');
  });
  it.each([
    null, '', 'http://example.com', 'https://user:password@example.com/music',
    'https://localhost/music', 'https://server.internal/music', 'https://music.local./',
    'https://127.1/', 'https://2130706433/', 'https://[::1]/', 'https://10.0.0.1/',
    'https://example.com:8443/', ' https://example.com/', 'https://example.com/\nprivate',
  ])('rejects unsupported source URL %j', value => {
    expect(normalizeFactSourceUrl(value)).toBeNull();
  });
});
