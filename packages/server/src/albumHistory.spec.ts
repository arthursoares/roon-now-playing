import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { NowPlaying } from '@roon-screen-cover/shared';
import { AlbumHistoryStore } from './albumHistory.js';

describe('AlbumHistoryStore', () => {
  let directory: string;
  let file: string;
  beforeEach(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'roon-albums-'));
    file = path.join(directory, 'album-history.json');
  });
  afterEach(() => {
    vi.restoreAllMocks();
    fs.rmSync(directory, { recursive: true, force: true });
  });

  function playing(album: string, zone = 'living-room'): NowPlaying {
    return {
      zone_id: zone, state: 'playing', seek_position: 0,
      track: { title: 'First track', artist: 'Artist', album, artwork_key: `cover-${album}`, duration_seconds: 180 },
    };
  }

  it('keeps the 12 most recent distinct albums in each zone and restores them from disk', () => {
    const store = new AlbumHistoryStore(file);
    for (let i = 0; i < 14; i++) store.record(playing(`Album ${i}`), i + 1);
    store.record(playing('Kitchen album', 'kitchen'), 20);

    const restored = new AlbumHistoryStore(file);
    expect(restored.get('living-room')).toHaveLength(12);
    expect(restored.get('living-room').map((album) => album.album)).toEqual(
      Array.from({ length: 12 }, (_, i) => `Album ${13 - i}`),
    );
    expect(restored.get('kitchen').map((album) => album.album)).toEqual(['Kitchen album']);
    expect(restored.get('unseen')).toEqual([]);
  });

  it('does not duplicate an album or write on every track/seek update', () => {
    const store = new AlbumHistoryStore(file);
    store.record(playing('One'), 100);
    const write = vi.spyOn(fs, 'writeFileSync');
    const nextTrack = playing('One');
    nextTrack.track!.title = 'Second track';
    nextTrack.seek_position = 54;
    expect(store.record(nextTrack, 200)).toBe(false);
    expect(write).not.toHaveBeenCalled();
    expect(store.get('living-room')).toHaveLength(1);
    expect(store.get('living-room')[0].last_played_at).toBe(100);
  });

  it('moves a returning album to the front without duplicates', () => {
    const store = new AlbumHistoryStore(file);
    store.record(playing('One'), 1);
    store.record(playing('Two'), 2);
    const repeated = playing(' one ');
    repeated.track!.artist = ' artist ';
    store.record(repeated, 3);
    expect(store.get('living-room').map((album) => album.album)).toEqual(['one', 'Two']);
    expect(store.get('living-room')[0].last_played_at).toBe(3);
  });

  it('updates late artwork for the current album', () => {
    const store = new AlbumHistoryStore(file);
    const update = playing('One');
    update.track!.artwork_key = null;
    store.record(update, 1);
    update.track!.artwork_key = 'cover-ready';
    expect(store.record(update, 2)).toBe(true);
    expect(store.get('living-room')).toHaveLength(1);
    expect(store.get('living-room')[0].artwork_key).toBe('cover-ready');
  });

  it('does not count paused, stopped, or missing album metadata as listening', () => {
    const store = new AlbumHistoryStore(file);
    const update = playing('One');
    expect(store.record({ ...update, state: 'paused' })).toBe(false);
    expect(store.record({ ...update, state: 'stopped' })).toBe(false);
    expect(store.record({ ...update, track: null })).toBe(false);
    expect(store.record(playing(''))).toBe(false);
    expect(store.record(playing('Unknown Album'))).toBe(false);
    expect(store.get('living-room')).toEqual([]);
  });

  it('recovers from malformed storage and ignores invalid stored entries', () => {
    fs.writeFileSync(file, '{broken');
    expect(new AlbumHistoryStore(file).get('living-room')).toEqual([]);
    fs.writeFileSync(file, JSON.stringify({ 'living-room': [null, { album: 'Broken' }] }));
    const store = new AlbumHistoryStore(file);
    expect(store.get('living-room')).toEqual([]);
    store.record(playing('Recovered'));
    expect(new AlbumHistoryStore(file).get('living-room')[0].album).toBe('Recovered');
  });
});
