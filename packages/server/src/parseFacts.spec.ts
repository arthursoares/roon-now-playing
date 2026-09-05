import { describe, expect, it } from 'vitest';
import { parseFactsResponse } from './parseFacts.js';

describe('parseFactsResponse', () => {
  it('preserves JSON escapes, punctuation and Unicode while trimming blank facts', () => {
    const facts = [
      'The song "Heroes" uses a sustained note.',
      "The singer’s notes describe the band's session.",
      'First line\nSecond line\twith a tab',
      String.raw`The archive is C:\music\session, with a literal \n marker.`,
      'Björk recorded “Jóga” in Reykjavík. 🎵',
    ];
    expect(parseFactsResponse(JSON.stringify(['  ', ...facts, '  Last fact.  ']))).toEqual([
      ...facts,
      'Last fact.',
    ]);
  });

  it.each([
    ['literal newline', '["The session began in London.\nIt ended in Berlin."]', ['The session began in London.\nIt ended in Berlin.']],
    ['literal tab and carriage return', '["The session\tlasted\r\ntwo days."]', ['The session\tlasted\r\ntwo days.']],
    ['missing commas', '["The session lasted two days."\n"The record features a piano." "The artist mixed it."]', ['The session lasted two days.', 'The record features a piano.', 'The artist mixed it.']],
    ['mixed quote boundaries', '[“The session lasted two days.", "The record features a piano.”]', ['The session lasted two days.', 'The record features a piano.']],
    ['curly structural quotes and titles', '[“The song “Heroes” uses a sustained note.”, “The singer’s notes describe the session.”]', ['The song “Heroes” uses a sustained note.', 'The singer’s notes describe the session.']],
    ['ASCII titles inside curly quotes', '[“The song "Heroes" uses a sustained note.”]', ['The song "Heroes" uses a sustained note.']],
    ['escaped titles in repaired JSON', String.raw`["The song \"Heroes\" uses a sustained note." "The artist's notes mention C:\\music."]`, ['The song "Heroes" uses a sustained note.', "The artist's notes mention C:\\music."]],
    ['missing closing bracket', '["The session lasted two days."', ['The session lasted two days.']],
    ['trailing comma before the closing bracket', '["First fact.","Second fact.",\n]', ['First fact.', 'Second fact.']],
    ['trailing comma after one complete item', '["The session lasted two days.",]', ['The session lasted two days.']],
    ['trailing commas in adjacent arrays', '["First fact.",]\n["Second fact.",]', ['First fact.', 'Second fact.']],
    ['truncated final string', '["The session lasted two days.", "The record features', ['The session lasted two days.']],
    ['truncation after a comma', '["The session lasted two days.",', ['The session lasted two days.']],
    ['truncation after an escape', '["The session lasted two days.", "The record\\', ['The session lasted two days.']],
    ['adjacent arrays', '["The session lasted two days."]\n["The record features a piano."]', ['The session lasted two days.', 'The record features a piano.']],
    ['adjacent arrays without whitespace', '["One fact."]["Another fact."]', ['One fact.', 'Another fact.']],
    ['adjacent arrays with escaped titles', String.raw`["The song \"Heroes\" uses a sustained note."]
["The record features a piano."]`, ['The song "Heroes" uses a sustained note.', 'The record features a piano.']],
    ['bracketed paragraphs', '[The session lasted two days.]\n[The record features a piano.]', ['The session lasted two days.', 'The record features a piano.']],
    ['bracketed paragraphs with titles', '[The song “Heroes” uses a sustained note.]\n[The singer\'s notes mention C:\\music.]', ['The song “Heroes” uses a sustained note.', "The singer's notes mention C:\\music."]],
    ['JSON markdown fence', '```json\n["The session lasted two days."]\n```', ['The session lasted two days.']],
    ['plain markdown fence', '```\n["The session lasted two days."]\n```', ['The session lasted two days.']],
    ['inline JSON fence', '```json ["The session lasted two days."]```', ['The session lasted two days.']],
    ['inline plain fence', '```["The session lasted two days."]```', ['The session lasted two days.']],
    ['preamble before a whole fence', 'Here are facts:\n```json\n["The session lasted two days."]\n```', ['The session lasted two days.']],
    ['preamble before an inline fence', 'Here are the facts: ```json ["The session lasted two days."]```', ['The session lasted two days.']],
    ['repaired markdown fence', '```json\n["One fact."\n"Another fact."]\n```', ['One fact.', 'Another fact.']],
    ['simple preamble', 'Here are the facts: ["The session lasted two days."]', ['The session lasted two days.']],
    ['preamble on a separate line', 'Facts about the recording:\n["The session lasted two days."]', ['The session lasted two days.']],
  ])('recovers %s without changing complete facts', (_name, response, expected) => {
    expect(parseFactsResponse(response)).toEqual(expected);
  });

  it.each([
    '', '   ', '[]', '["", "  "]', 'null', 'true', '42', '"A fact."',
    '{}', '{"facts": ["An object value."]}', '[{"fact": "An object value."}]',
    '["A fact.", null]', '["A fact.", 42]', '["A fact.", ["A nested fact."]]',
    '[,]', '[,"A fact."]', '["A fact.",,]', '["A fact.", , "Another fact."]',
    '["A fact."][,]', '["A fact.",]\n[,"Another fact."]',
    '["A fact."][true]', '["A fact.", {"key": "value"',
    'Here are the facts: ["A fact." "Another fact."]', '["A fact."] This is model commentary.',
    'The song "Heroes" uses a sustained note.',
    '["The song "Heroes" uses a sustained note."]',
    '["The song "Heroes" uses a sustained note." "Another fact."]',
    '["A fact.""Another fact."]',
    '["An incomplete fact', '[“An incomplete fact',
    String.raw`["An invalid \q escape."]`,
    String.raw`["An invalid \u00ZZ escape."]`,
    '["An invalid\u0000control character."]',
    '[true]\n[false]', '[123]\n[456]', '[null]\n[null]',
    '[{"key": "value"}]\n[{"key": "another"}]',
    '[Unquoted paragraph.]\n[An incomplete paragraph',
    '[A single unquoted paragraph.]',
    '["A fact."]\n[An unquoted paragraph.]',
    '```json\n["A fact."]\n```\nExplanation.',
    '```javascript\n["A fact."]\n```',
    'Here are facts:\n```json {"facts": ["An object value."]}```',
    'Here are facts:\n```json ["A fact.", null]```',
    'Here are facts:\n```json ["A fact."][{"key": "value"}]```',
    'Here are facts:\n```json ["A fact."]```\nExplanation.',
    'Here are facts:\n```json ["A fact."]```\n```json ["Another fact."]```',
    'Some model commentary\n```json ["A fact."]```',
    'Here are facts: ["An earlier fragment."]\n```json ["A fact."]```',
    '{"facts": ```json ["An object value."]```}',
  ])('rejects unsupported or ambiguous response %j', (response) => {
    expect(parseFactsResponse(response)).toEqual([]);
  });

  it('round trips string content without changing escapes or quote characters', () => {
    const pieces = ['"', '“', '”', "'", '’', '\\', '\n', '\r', '\t', '[', ']', ',', 'é', '🎵'];
    for (const left of pieces) {
      for (const right of pieces) {
        const fact = `The ${left}title${right} is preserved.`;
        expect(parseFactsResponse(JSON.stringify([fact]))).toEqual([fact]);
      }
    }
  });

  it('never turns a truncated string into a fact at any cut position', () => {
    const facts = ['The song "Heroes" uses a sustained note.', 'The artist’s notes mention C:\\music.', 'The final session lasted two days.'];
    const response = JSON.stringify(facts);
    for (let end = 0; end <= response.length; end++) {
      const recovered = parseFactsResponse(response.slice(0, end));
      expect(recovered).toEqual(facts.slice(0, recovered.length));
    }
  });

  it('accepts long valid responses without a small hidden output cap', () => {
    const fact = 'Complete text. '.repeat(6_000);
    expect(parseFactsResponse(JSON.stringify([fact]))).toEqual([fact.trim()]);
  });

  it('rejects oversized responses before extracting any prefix', () => {
    expect(parseFactsResponse(`["A fact.", "${'x'.repeat(1_048_576)}"]`)).toEqual([]);
  });

  it('handles a bounded long malformed response without extracting quote fragments', () => {
    expect(parseFactsResponse(`["${'title" '.repeat(8_000)}]`)).toEqual([]);
  });

  it('rejects an unfinished fence containing a long whitespace payload', () => {
    expect(parseFactsResponse('```json' + ' '.repeat(100_000) + 'unfinished')).toEqual([]);
  });
});
