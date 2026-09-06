import { afterEach, describe, expect, it } from 'vitest';
import { createApp, h, type App } from 'vue';
import FactSources from './FactSources.vue';

describe('FactSources', () => {
  let app: App | undefined;

  afterEach(() => app?.unmount());

  function mount(sources: unknown): HTMLElement {
    const host = document.createElement('div');
    app = createApp({ render: () => h(FactSources, { sources }) });
    app.mount(host);
    return host;
  }

  it('renders nothing without sources', () => {
    expect(mount([]).textContent).toBe('');
  });

  it.each([
    null,
    'not an array',
    [{}],
    [{ url: 'javascript:alert(1)', title: 'Unsafe' }],
    [{ url: 'http://example.com/source', title: 'Insecure' }],
    [{ url: 'https://127.0.0.1/source', title: 'Private' }],
    [
      { url: 'https://musicbrainz.org/recording/example', title: 'Valid' },
      { url: 42, title: 'Malformed' },
    ],
  ])('renders no links for an unsafe or malformed source group %#', (sources) => {
    const host = mount(sources);
    expect(host.querySelector('nav')).toBeNull();
    expect(host.querySelector('a')).toBeNull();
  });

  it('renders a singular accessible source link with safe external-link attributes', () => {
    const host = mount([{ url: 'https://musicbrainz.org/recording/example', title: 'MusicBrainz' }]);
    const navigation = host.querySelector('nav');
    const link = host.querySelector('a');

    expect(navigation?.getAttribute('aria-label')).toBe('Source');
    expect(link?.textContent).toBe('MusicBrainz');
    expect(link?.getAttribute('href')).toBe('https://musicbrainz.org/recording/example');
    expect(link?.getAttribute('target')).toBe('_blank');
    expect(link?.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('uses the hostname for a blank title and renders title text without interpreting markup', () => {
    const host = mount([
      { url: 'https://www.discogs.com/release/example', title: '' },
      { url: 'https://en.wikipedia.org/wiki/Example', title: '<em>Wikipedia</em>' },
    ]);
    const links = [...host.querySelectorAll('a')];

    expect(host.querySelector('nav')?.getAttribute('aria-label')).toBe('Sources');
    expect(links.map((link) => link.textContent)).toEqual(['www.discogs.com', '<em>Wikipedia</em>']);
    expect(host.querySelector('em')).toBeNull();
  });
});
