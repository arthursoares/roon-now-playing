export function parseLlmResponse(raw: string): string[] {
  const cleaned = raw.trim();

  try {
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) return parsed.map(String);
  } catch {
    // continue to recovery
  }

  let fixed = cleaned
    .replace(/[“”„‟""]/g, '"')
    .replace(/"\s*\n+\s*"/g, '","')
    .replace(/";\s*"/g, '","')
    .replace(/,\s*\]/g, ']')
    .replace(/,\s*\}/g, '}');

  if (!fixed.trim().startsWith('[')) fixed = '[' + fixed;
  if (!fixed.trim().endsWith(']')) fixed = fixed + ']';

  try {
    const parsed = JSON.parse(fixed);
    if (Array.isArray(parsed)) return parsed.map(String);
  } catch {
    // continue to extraction
  }

  const matches = fixed.match(/"([^"\\]*(?:\\.[^"\\]*)*)"/g);
  if (matches) {
    return matches.map(s => s.slice(1, -1).replace(/\\n/g, '\n').replace(/\\'/g, "'"));
  }

  return [];
}
