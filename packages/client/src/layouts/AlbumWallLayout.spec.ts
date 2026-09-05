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

  it('applies adaptive text and progress colors to dynamic backgrounds', () => {
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

    expect(layout?.style.getPropertyValue('--text-color')).toBe('#1a1a1a');
    expect(layout?.style.getPropertyValue('--progress-bar-fill')).toBe('rgba(26, 26, 26, 0.7)');

    app.unmount();
  });
});
