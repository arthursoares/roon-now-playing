// Reject, rather than truncate, oversized responses so the limit cannot create facts.
const MAX_RESPONSE_LENGTH = 1_048_576;

const isOpeningQuote = (character: string | undefined) => character === '"' || character === '“';
const cleanFacts = (facts: string[]) => facts.map((fact) => fact.trim()).filter(Boolean);

function stringArray(value: unknown): string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
    ? cleanFacts(value)
    : [];
}

/**
 * Strict JSON first, then a bounded scan of explicitly delimited array items.
 * Recovery never searches arbitrary prose for quoted fragments. Ambiguous syntax
 * rejects the response; only an unfinished final string may leave a complete prefix.
 */
export function parseFactsResponse(text: string): string[] {
  if (typeof text !== 'string' || text.length > MAX_RESPONSE_LENGTH) return [];

  let source = text.trim();
  // A complete fence makes the payload explicit, including inline model output
  // and a simple colon-terminated introduction. Never strip arbitrary prose.
  const fence = source.match(/^(?:[^\r\n[\]{}"`]+:\s*)?```(?:json)?([\s\S]*?)```$/i);
  if (fence) source = fence[1].trim();

  try {
    // A valid JSON object or mixed array is a schema error, not a repair candidate.
    return stringArray(JSON.parse(source));
  } catch {
    // Continue only with the explicitly supported response formats below.
  }

  // Keep common model introductions, but only around an otherwise strict array.
  const introduced = source.match(/^[^\r\n[\]{}"`]+:\s*(\[[\s\S]*\])$/);
  if (introduced) {
    try {
      return stringArray(JSON.parse(introduced[1]));
    } catch {
      return [];
    }
  }

  if (!source.startsWith('[')) return [];

  const skipWhitespace = (start: number): number => {
    let end = start;
    while (end < source.length && /\s/.test(source[end])) end++;
    return end;
  };

  if (!isOpeningQuote(source[skipWhitespace(1)]) && source[skipWhitespace(1)] !== ']') {
    // A separate model format: at least two complete, unquoted paragraphs, one
    // per bracketed line. Never reinterpret objects, literals or nested arrays.
    const lines = source.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    if (lines.length < 2) return [];
    const facts: string[] = [];
    for (const line of lines) {
      const paragraph = line.match(/^\[([^\][{}]+)\]$/)?.[1].trim();
      if (!paragraph || !/^\p{L}/u.test(paragraph) || !/\s/.test(paragraph)) return [];
      if (/^(?:true|false|null)(?:\s|,|$)/.test(paragraph)) return [];
      facts.push(paragraph);
    }
    return facts;
  }

  const facts: string[] = [];
  let position = 0;

  const closeString = (parts: string[], end: number): { value: string; end: number } | undefined => {
    try {
      return { value: JSON.parse(`"${parts.join('')}"`) as string, end };
    } catch {
      return undefined;
    }
  };

  const readString = (start: number): { value: string; end: number } | 'unfinished' | undefined => {
    const opening = source[start];
    const parts: string[] = [];
    let curlyDepth = 0;
    for (let cursor = start + 1; cursor < source.length; cursor++) {
      const character = source[cursor];
      if (character === '\\') {
        if (cursor + 1 === source.length) return 'unfinished';
        // Preserve JSON escapes verbatim for JSON.parse, including Unicode escapes.
        parts.push(source.slice(cursor, cursor + 2));
        cursor++;
      } else if (character === '“') {
        curlyDepth++;
        parts.push(character);
      } else if (character === '”') {
        if (curlyDepth === 0) return closeString(parts, cursor + 1);
        curlyDepth--;
        parts.push(character);
      } else if (character === '"') {
        // With curly delimiters, preserve ordinary quoted titles when their quotes
        // cannot be an array boundary. ASCII-delimited unescaped titles are ambiguous.
        const after = skipWhitespace(cursor + 1);
        const atBoundary = after === source.length || source[after] === ',' || source[after] === ']'
          || (after > cursor + 1 && isOpeningQuote(source[after]));
        if (opening === '"' || (curlyDepth === 0 && atBoundary)) return closeString(parts, cursor + 1);
        parts.push('\\"');
      } else {
        // Repair only literal JSON whitespace controls; do not change valid escapes.
        parts.push(character === '\n' ? '\\n' : character === '\r' ? '\\r' : character === '\t' ? '\\t' : character);
      }
    }
    return 'unfinished';
  };

  while (source[position] === '[') {
    position = skipWhitespace(position + 1);
    if (source[position] === ']') {
      position++;
    } else {
      while (true) {
        if (position === source.length) return cleanFacts(facts);
        if (!isOpeningQuote(source[position])) return [];
        const item = readString(position);
        if (item === 'unfinished') return cleanFacts(facts);
        if (!item) return [];
        facts.push(item.value);
        position = skipWhitespace(item.end);
        if (position === source.length) return cleanFacts(facts);
        if (source[position] === ']') {
          position++;
          break;
        }
        if (source[position] === ',') {
          position = skipWhitespace(position + 1);
          // Only this position follows a complete item and exactly one comma.
          if (source[position] === ']') {
            position++;
            break;
          }
        } else if (!(position > item.end && isOpeningQuote(source[position]))) {
          // A missing comma is repairable only between whitespace-separated strings.
          return [];
        }
      }
    }
    position = skipWhitespace(position);
    if (position === source.length) return cleanFacts(facts);
  }

  return [];
}
