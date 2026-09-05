import fs from 'node:fs';
import path from 'node:path';
import { ALBUM_HISTORY_LIMIT, getAlbumId, type NowPlaying, type RecentAlbum } from '@roon-screen-cover/shared';
import { logger } from './logger.js';

export class AlbumHistoryStore {
  private readonly albums = new Map<string, RecentAlbum[]>();

  constructor(private readonly filePath = path.join(process.env.DATA_DIR || './config', 'album-history.json')) {
    this.load();
  }

  get(zoneId: string): RecentAlbum[] {
    return (this.albums.get(zoneId) ?? []).map((album) => ({ ...album }));
  }

  record(nowPlaying: NowPlaying, now = Date.now()): boolean {
    const track = nowPlaying.track;
    if (nowPlaying.state !== 'playing' || !track || typeof nowPlaying.zone_id !== 'string' || !nowPlaying.zone_id ||
      typeof track.artist !== 'string' || typeof track.album !== 'string') return false;

    const artist = track.artist.trim();
    const album = track.album.trim();
    if (!artist || !album || album.toLowerCase() === 'unknown album') return false;

    const id = getAlbumId(artist, album);
    const history = this.albums.get(nowPlaying.zone_id) ?? [];
    const previous = history.find((entry) => entry.id === id);
    const artworkKey = typeof track.artwork_key === 'string' && track.artwork_key
      ? track.artwork_key : previous?.artwork_key ?? null;

    // Repeated tracks/seek updates from the same album must not churn disk or reorder the wall.
    if (history[0]?.id === id && history[0].artwork_key === artworkKey) return false;

    this.albums.set(nowPlaying.zone_id, [
      { id, artist, album, artwork_key: artworkKey, last_played_at: now },
      ...history.filter((entry) => entry.id !== id),
    ].slice(0, ALBUM_HISTORY_LIMIT));
    this.save();
    return true;
  }

  private load(): void {
    try {
      if (!fs.existsSync(this.filePath)) return;
      const stored: unknown = JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
      if (!stored || typeof stored !== 'object' || Array.isArray(stored)) return;

      for (const [zoneId, entries] of Object.entries(stored)) {
        if (!Array.isArray(entries)) continue;
        const history: RecentAlbum[] = [];
        const seen = new Set<string>();
        for (const entry of entries) {
          if (!isRecentAlbum(entry)) continue;
          const id = getAlbumId(entry.artist, entry.album);
          if (seen.has(id)) continue;
          seen.add(id);
          history.push({ ...entry, id });
          if (history.length === ALBUM_HISTORY_LIMIT) break;
        }
        this.albums.set(zoneId, history);
      }
    } catch (error) {
      logger.warn(`Failed to load album history: ${error}`);
    }
  }

  private save(): void {
    try {
      fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
      const temporary = `${this.filePath}.tmp`;
      fs.writeFileSync(temporary, JSON.stringify(Object.fromEntries(this.albums), null, 2));
      fs.renameSync(temporary, this.filePath);
    } catch (error) {
      logger.warn(`Failed to save album history: ${error}`);
    }
  }
}

function isRecentAlbum(value: unknown): value is RecentAlbum {
  if (!value || typeof value !== 'object') return false;
  const entry = value as Partial<RecentAlbum>;
  return typeof entry.artist === 'string' && entry.artist.trim().length > 0 &&
    typeof entry.album === 'string' && entry.album.trim().length > 0 &&
    (entry.artwork_key === null || typeof entry.artwork_key === 'string') &&
    typeof entry.last_played_at === 'number' && Number.isFinite(entry.last_played_at);
}
