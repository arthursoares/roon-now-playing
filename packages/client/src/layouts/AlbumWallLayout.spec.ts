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
        albumHistory: [history[0], history[1], history[1], history[2]],
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

  it('repeats all twelve covers into a dense mosaic without repeating accessible metadata', () => {
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
        albumHistory: [
          galleryHistory[0],
          galleryHistory[1],
          galleryHistory[1],
          ...galleryHistory.slice(2),
        ],
        galleryOnly: true,
      }),
    });

    app.mount(host);

    expect(host.querySelector('.album-gallery-layout')).not.toBeNull();
    expect(host.querySelector('.hero')).toBeNull();
    const allCards = host.querySelectorAll('.gallery-card');
    expect(allCards.length).toBeGreaterThanOrEqual(40);
    const accessibleCards = [...host.querySelectorAll<HTMLElement>('.gallery-card:not([aria-hidden="true"])')];
    expect(accessibleCards).toHaveLength(12);
    expect(new Set(accessibleCards.map((card) => card.title)).size).toBe(12);
    expect(host.querySelectorAll('.gallery-card[aria-hidden="true"]')).toHaveLength(allCards.length - 12);
    expect(host.querySelector('.gallery-card[aria-hidden="true"] img')?.getAttribute('alt')).toBe('');
    expect(host.querySelector('.gallery-card img[src="/api/artwork/gallery-11"]')).not.toBeNull();
    expect(host.querySelector('.gallery-card[aria-current="true"]')).not.toBeNull();
    expect(host.querySelector('.gallery-track')).toBeNull();
    expect(host.querySelector('.album-name')).toBeNull();
    const longLabelCard = [...host.querySelectorAll<HTMLElement>('.gallery-card')]
      .find((card) => card.title.startsWith('An Album Name Long Enough'));
    expect(longLabelCard?.getAttribute('aria-label')).toContain('Without Losing Its Accessible Name');
    expect(longLabelCard?.querySelector('img')?.alt).toContain('Without Losing Its Accessible Name');

    app.unmount();
  });

  it('uses the current track as the only accessible cover before history arrives', () => {
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

    expect(host.querySelectorAll('.gallery-card').length).toBeGreaterThanOrEqual(40);
    expect(host.querySelectorAll('.gallery-card:not([aria-hidden="true"])')).toHaveLength(1);
    expect(host.querySelector('.gallery-card:not([aria-hidden="true"])')?.getAttribute('aria-label')).toContain(track.album.trim());
    expect(host.querySelector('.gallery-card[aria-current="true"]')?.getAttribute('aria-hidden')).toBeNull();
    expect(host.querySelector('.album-name')).toBeNull();
    expect(host.querySelector('.hero')).toBeNull();

    app.unmount();
  });

  it('prepends a missing current album, keeps twelve distinct accessible albums, and drops the oldest', () => {
    const currentTrack = {
      ...track,
      artist: 'Just Arrived',
      album: 'Brand New Album',
      artwork_key: 'brand-new',
    };
    const host = document.createElement('div');
    const app = createApp({
      render: () => h(AlbumWallLayout, {
        track: currentTrack,
        state: 'playing',
        isPlaying: true,
        progress: 0,
        currentTime: '0:00',
        duration: '4:00',
        artworkUrl: '/api/artwork/brand-new',
        zoneName: 'Living Room',
        background: 'black',
        albumHistory: galleryHistory,
        galleryOnly: true,
      }),
    });

    app.mount(host);

    const accessibleCards = [...host.querySelectorAll<HTMLElement>('.gallery-card:not([aria-hidden="true"])')];
    expect(accessibleCards).toHaveLength(12);
    expect(accessibleCards[0].getAttribute('aria-current')).toBe('true');
    expect(accessibleCards[0].querySelector('img')?.getAttribute('src')).toBe('/api/artwork/brand-new');
    expect(host.querySelector('.gallery-card img[src="/api/artwork/gallery-11"]')).toBeNull();

    app.unmount();
  });

  it('moves the current history album first and updates it before refreshed history arrives', async () => {
    const currentTrack = ref<Track>({
      ...track,
      artist: galleryHistory[5].artist,
      album: galleryHistory[5].album,
      artwork_key: galleryHistory[5].artwork_key,
    });
    const host = document.createElement('div');
    const app = createApp({
      render: () => h(AlbumWallLayout, {
        track: currentTrack.value,
        state: 'playing',
        isPlaying: true,
        progress: 0,
        currentTime: '0:00',
        duration: '4:00',
        artworkUrl: currentTrack.value.artwork_key ? `/api/artwork/${currentTrack.value.artwork_key}` : null,
        zoneName: 'Living Room',
        background: 'black',
        albumHistory: galleryHistory,
        galleryOnly: true,
      }),
    });

    app.mount(host);
    expect(host.querySelector('.gallery-card')?.getAttribute('aria-current')).toBe('true');
    expect(host.querySelector('.gallery-card img')?.getAttribute('src')).toBe('/api/artwork/gallery-5');

    currentTrack.value = {
      ...track,
      artist: galleryHistory[8].artist,
      album: galleryHistory[8].album,
      artwork_key: galleryHistory[8].artwork_key,
    };
    await nextTick();

    const firstCard = host.querySelector<HTMLElement>('.gallery-card');
    expect(firstCard?.getAttribute('aria-current')).toBe('true');
    expect(firstCard?.querySelector('img')?.getAttribute('src')).toBe('/api/artwork/gallery-8');
    expect(host.querySelectorAll('.gallery-card[aria-current="true"]')).toHaveLength(1);

    app.unmount();
  });
});
