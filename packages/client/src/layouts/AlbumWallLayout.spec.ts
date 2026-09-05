import { createApp, h, nextTick, ref } from 'vue';
import { describe, expect, it } from 'vitest';
import type { RecentAlbum, Track } from '@roon-screen-cover/shared';
import AlbumWallLayout from './AlbumWallLayout.vue';

const track: Track = {
  title: 'A Very Long Current Track Title',
  artist: '  THE ARTIST ',
  album: ' Current Album ',
  duration_seconds: 240,
  artwork_key: 'hero-key',
};

const history: RecentAlbum[] = [
  {
    id: '["the artist","current album"]',
    artist: 'The Artist',
    album: 'Current Album',
    artwork_key: 'current-history-key',
    last_played_at: 300,
  },
  {
    id: '["previous artist","the complete previous album name"]',
    artist: 'Previous Artist',
    album: 'The Complete Previous Album Name',
    artwork_key: 'previous-key',
    last_played_at: 200,
  },
  {
    id: '["missing artist","missing cover"]',
    artist: 'Missing Artist',
    album: 'Missing Cover',
    artwork_key: null,
    last_played_at: 100,
  },
];

const galleryHistory: RecentAlbum[] = Array.from({ length: 12 }, (_, index) => ({
  id: index === 0 ? '["the artist","current album"]' : `["artist ${index}","album ${index}"]`,
  artist: index === 0 ? 'The Artist' : `Artist ${index}`,
  album: index === 0 ? 'Current Album' : index === 1
    ? 'An Album Name Long Enough to Need Two Lines Without Losing Its Accessible Name'
    : `Album ${index}`,
  artwork_key: `gallery-${index}`,
  last_played_at: 1_000 - index,
}));

describe('AlbumWallLayout', () => {
  it('keeps the current track as the hero and shows prior albums in server order', () => {
    const host = document.createElement('div');
    const app = createApp({
      render: () => h(AlbumWallLayout, {
        track,
        state: 'playing',
        isPlaying: true,
        progress: 25,
        currentTime: '1:00',
        duration: '4:00',
        artworkUrl: '/api/artwork/hero-key',
        zoneName: 'Living Room',
        background: 'black',
        albumHistory: history,
      }),
    });

    app.mount(host);

    expect(host.querySelector('.hero-artwork')?.getAttribute('src')).toBe('/api/artwork/hero-key');
    expect(host.querySelector('h1')?.textContent).toBe(track.title);
    expect(host.querySelector('.zone')?.textContent).toBe('Living Room');

    const cards = [...host.querySelectorAll<HTMLElement>('.album-card')];
    expect(cards).toHaveLength(2);
    expect(cards.map((card) => card.title)).toEqual([
      'The Complete Previous Album Name — Previous Artist',
      'Missing Cover — Missing Artist',
    ]);
    expect(cards[0].querySelector('img')?.alt).toBe('The Complete Previous Album Name by Previous Artist');
    expect(cards[1].querySelector('.cover-placeholder')).not.toBeNull();

    app.unmount();
  });

  it('replaces artwork that fails to load with a placeholder', async () => {
    const host = document.createElement('div');
    const albums = ref(history.slice(1, 2));
    const app = createApp({
      render: () => h(AlbumWallLayout, {
        track,
        state: 'paused',
        isPlaying: false,
        progress: 50,
        currentTime: '2:00',
        duration: '4:00',
        artworkUrl: '/api/artwork/hero-key',
        zoneName: 'Living Room',
        background: 'black',
        albumHistory: albums.value,
      }),
    });

    app.mount(host);
    const image = host.querySelector<HTMLImageElement>('.album-cover');
    image?.dispatchEvent(new Event('error'));
    await nextTick();

    expect(host.querySelector('.album-cover')).toBeNull();
    expect(host.querySelector('.album-card .cover-placeholder')).not.toBeNull();

    albums.value = [{ ...albums.value[0], artwork_key: 'replacement-key' }];
    await nextTick();

    expect(host.querySelector('.album-cover')?.getAttribute('src')).toBe('/api/artwork/replacement-key');

    app.unmount();
  });

  it('renders a useful empty gallery when history has not arrived yet', () => {
    const host = document.createElement('div');
    const app = createApp({
      render: () => h(AlbumWallLayout, {
        track,
        state: 'playing',
        isPlaying: true,
        progress: 0,
        currentTime: '0:00',
        duration: '4:00',
        artworkUrl: '/api/artwork/hero-key',
        zoneName: 'Living Room',
        background: 'black',
      }),
    });

    app.mount(host);

    expect(host.querySelector('.album-grid')).toBeNull();
    expect(host.querySelector('.empty-history')?.textContent).toContain(
      'More albums will appear as the music continues.'
    );

    app.unmount();
  });

  it('keeps text and progress readable over a light dynamic background', () => {
    const host = document.createElement('div');
    const app = createApp({
      render: () => h(AlbumWallLayout, {
        track,
        state: 'playing',
        isPlaying: true,
        progress: 25,
        currentTime: '1:00',
        duration: '4:00',
        artworkUrl: null,
        zoneName: 'Living Room',
        background: 'blur-subtle',
      }),
    });

    app.mount(host);
    const layout = host.querySelector<HTMLElement>('.album-wall-layout');
    const content = host.querySelector<HTMLElement>('.album-wall-content');

    expect(layout?.style.getPropertyValue('--text-color')).toBe('#1a1a1a');
    expect(layout?.style.getPropertyValue('--progress-bar-fill')).toBe('rgba(26, 26, 26, 0.7)');
    expect(content?.classList.contains('dynamic-contrast')).toBe(true);
    expect(content?.style.getPropertyValue('--text-color')).toBe('#ffffff');
    expect(content?.style.getPropertyValue('--text-tertiary')).toBe('rgba(255, 255, 255, 0.88)');
    expect(content?.style.getPropertyValue('--progress-bar-fill')).toBe('#ffffff');

    app.unmount();
  });

  it('renders all twelve albums with the current tile marked and no hero', () => {
    const host = document.createElement('div');
    const app = createApp({
      render: () => h(AlbumWallLayout, {
        track,
        state: 'playing',
        isPlaying: true,
        progress: 25,
        currentTime: '1:00',
        duration: '4:00',
        artworkUrl: '/api/artwork/hero-key',
        zoneName: 'Living Room',
        background: 'black',
        albumHistory: galleryHistory,
        galleryOnly: true,
      }),
    });

    app.mount(host);

    expect(host.querySelector('.album-gallery-layout')).not.toBeNull();
    expect(host.querySelector('.hero')).toBeNull();
    expect(host.querySelectorAll('.gallery-card')).toHaveLength(12);
    expect(host.querySelector('.current-marker')?.textContent).toBe('Now playing');
    const longLabelCard = [...host.querySelectorAll<HTMLElement>('.gallery-card')]
      .find((card) => card.title.startsWith('An Album Name Long Enough'));
    expect(longLabelCard?.querySelector('.album-name')?.textContent).toContain('Without Losing Its Accessible Name');
    expect(longLabelCard?.querySelector('img')?.alt).toContain('Without Losing Its Accessible Name');

    app.unmount();
  });

  it('uses the current track as a paused gallery tile before history arrives', () => {
    const host = document.createElement('div');
    const app = createApp({
      render: () => h(AlbumWallLayout, {
        track,
        state: 'paused',
        isPlaying: false,
        progress: 50,
        currentTime: '2:00',
        duration: '4:00',
        artworkUrl: '/api/artwork/hero-key',
        zoneName: 'Living Room',
        background: 'black',
        galleryOnly: true,
      }),
    });

    app.mount(host);

    expect(host.querySelectorAll('.gallery-card')).toHaveLength(1);
    expect(host.querySelector('.album-name')?.textContent).toBe(track.album);
    expect(host.querySelector('.current-marker')?.textContent).toBe('Paused');
    expect(host.querySelector('.hero')).toBeNull();

    app.unmount();
  });
});
