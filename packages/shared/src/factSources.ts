/** Syntactic source-link validation; this does not resolve DNS or verify a claim. */
export function normalizeFactSourceUrl(value: unknown): string | null {
  if (typeof value !== 'string' || value.length === 0 || value.length > 2_048
    || value.trim() !== value || Array.from(value).some(character => {
      const code = character.charCodeAt(0);
      return code <= 32 || code === 127;
    })) return null;
  let url: URL;
  try { url = new URL(value); } catch { return null; }
  if (url.protocol !== 'https:' || url.username || url.password || url.port) return null;
  const host = url.hostname.toLowerCase().replace(/\.$/, '');
  // Music citations should name public sites, not addresses or local services.
  if (!host.includes('.') || host.includes(':') || /^\d+(?:\.\d+){3}$/.test(host)) return null;
  if (['localhost', 'local', 'internal', 'home', 'lan', 'test', 'example', 'invalid', 'onion']
    .some(suffix => host === suffix || host.endsWith(`.${suffix}`))) return null;
  // A fragment selects part of the same retrieved resource, not a new source.
  url.hash = '';
  return url.href;
}
