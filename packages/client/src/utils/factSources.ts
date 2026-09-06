import { normalizeFactSourceUrl, type FactSource } from '@roon-screen-cover/shared';

export function readFactSourceGroup(value: unknown): FactSource[] {
  if (!Array.isArray(value)) return [];

  const parsed: FactSource[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return [];
    const source = item as Record<string, unknown>;
    if (typeof source.url !== 'string' || typeof source.title !== 'string') return [];

    const url = normalizeFactSourceUrl(source.url);
    if (!url) return [];
    parsed.push({ url, title: source.title.trim() });
  }
  return parsed;
}
