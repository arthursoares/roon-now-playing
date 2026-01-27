// Zone types
export interface Zone {
  id: string;
  display_name: string;
}

// Track types
export interface Track {
  title: string;
  artist: string;
  album: string;
  duration_seconds: number;
  artwork_key: string | null;
}

// Playback state
export type PlaybackState = 'playing' | 'paused' | 'stopped';

// Now Playing state
export interface NowPlaying {
  zone_id: string;
  state: PlaybackState;
  track: Track | null;
  seek_position: number;
}

// Layout options
export const LAYOUTS = ['detailed', 'minimal', 'fullscreen', 'ambient'] as const;
export type LayoutType = (typeof LAYOUTS)[number];

// Font options
export const FONTS = [
  'system',
  'patua-one',
  'comfortaa',
  'noto-sans-display',
  'coda',
  'bellota-text',
  'big-shoulders',
] as const;
export type FontType = (typeof FONTS)[number];

// Font display names and Google Font URLs
export const FONT_CONFIG: Record<FontType, { displayName: string; googleFont: string | null }> = {
  'system': { displayName: 'System', googleFont: null },
  'patua-one': { displayName: 'Patua One', googleFont: 'Patua+One:wght@400' },
  'comfortaa': { displayName: 'Comfortaa', googleFont: 'Comfortaa:wght@300;400;500;600;700' },
  'noto-sans-display': { displayName: 'Noto Sans Display', googleFont: 'Noto+Sans+Display:wght@400;500;600;700' },
  'coda': { displayName: 'Coda', googleFont: 'Coda:wght@400;800' },
  'bellota-text': { displayName: 'Bellota Text', googleFont: 'Bellota+Text:wght@300;400;700' },
  'big-shoulders': { displayName: 'Big Shoulders Display', googleFont: 'Big+Shoulders+Display:wght@400;500;600;700' },
};

// WebSocket message types
export interface ClientSubscribeMessage {
  type: 'subscribe';
  zone_id: string;
}

export interface ClientUnsubscribeMessage {
  type: 'unsubscribe';
}

export type ClientMessage = ClientSubscribeMessage | ClientUnsubscribeMessage;

export interface ServerZonesMessage {
  type: 'zones';
  zones: Zone[];
}

export interface ServerNowPlayingMessage {
  type: 'now_playing';
  zone_id: string;
  state: PlaybackState;
  track: Track | null;
  seek_position: number;
}

export interface ServerSeekMessage {
  type: 'seek';
  zone_id: string;
  seek_position: number;
}

export interface ServerErrorMessage {
  type: 'error';
  message: string;
}

export interface ServerConnectionMessage {
  type: 'connection';
  status: 'connected' | 'disconnected';
  roon_connected: boolean;
}

export type ServerMessage =
  | ServerZonesMessage
  | ServerNowPlayingMessage
  | ServerSeekMessage
  | ServerErrorMessage
  | ServerConnectionMessage;
