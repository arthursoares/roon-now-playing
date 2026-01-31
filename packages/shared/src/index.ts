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
export const LAYOUTS = ['detailed', 'minimal', 'fullscreen', 'ambient', 'cover'] as const;
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

// Background options
export const BACKGROUNDS = [
  'black',
  'white',
  'dominant',
  'gradient-radial',
  'gradient-linear',
  'gradient-linear-multi',
  'gradient-radial-corner',
  'gradient-mesh',
  'blur-subtle',
  'blur-heavy',
  'duotone',
  'posterized',
  'gradient-noise',
  'blur-grain',
] as const;
export type BackgroundType = (typeof BACKGROUNDS)[number];

// Background category type
export type BackgroundCategory = 'basic' | 'gradient' | 'artwork' | 'textured';

// Background display names and categories
export const BACKGROUND_CONFIG: Record<BackgroundType, { displayName: string; category: BackgroundCategory }> = {
  'black': { displayName: 'Black', category: 'basic' },
  'white': { displayName: 'White', category: 'basic' },
  'dominant': { displayName: 'Dominant Color', category: 'basic' },
  'gradient-radial': { displayName: 'Radial Gradient', category: 'gradient' },
  'gradient-linear': { displayName: 'Linear Gradient', category: 'gradient' },
  'gradient-linear-multi': { displayName: 'Multi-Color Linear', category: 'gradient' },
  'gradient-radial-corner': { displayName: 'Corner Radial', category: 'gradient' },
  'gradient-mesh': { displayName: 'Mesh Gradient', category: 'gradient' },
  'blur-subtle': { displayName: 'Subtle Blur', category: 'artwork' },
  'blur-heavy': { displayName: 'Heavy Blur', category: 'artwork' },
  'duotone': { displayName: 'Duotone', category: 'artwork' },
  'posterized': { displayName: 'Posterized', category: 'artwork' },
  'gradient-noise': { displayName: 'Noise Gradient', category: 'textured' },
  'blur-grain': { displayName: 'Grainy Blur', category: 'textured' },
};

// WebSocket message types
export interface ClientSubscribeMessage {
  type: 'subscribe';
  zone_id: string;
}

export interface ClientUnsubscribeMessage {
  type: 'unsubscribe';
}


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

// Admin panel types
export interface ClientMetadata {
  clientId: string;
  friendlyName: string | null;
  layout: LayoutType;
  font: FontType;
  background: BackgroundType;
  zoneId: string | null;
  zoneName: string | null;
  connectedAt: number;
  userAgent: string | null;
  isAdmin: boolean;
}

export interface ClientMetadataMessage {
  type: 'client_metadata';
  clientId: string;
  layout: LayoutType;
  font: FontType;
  background: BackgroundType;
  zoneId: string | null;
  zoneName: string | null;
  userAgent: string | null;
  isAdmin?: boolean;
}

export interface ServerClientsListMessage {
  type: 'clients_list';
  clients: ClientMetadata[];
}

export interface ServerClientConnectedMessage {
  type: 'client_connected';
  client: ClientMetadata;
}

export interface ServerClientDisconnectedMessage {
  type: 'client_disconnected';
  clientId: string;
}

export interface ServerClientUpdatedMessage {
  type: 'client_updated';
  client: ClientMetadata;
}

export interface ServerRemoteSettingsMessage {
  type: 'remote_settings';
  layout?: LayoutType;
  font?: FontType;
  background?: BackgroundType;
  zoneId?: string;
  zoneName?: string;
}

export type ClientMessage =
  | ClientSubscribeMessage
  | ClientUnsubscribeMessage
  | ClientMetadataMessage;

export type ServerMessage =
  | ServerZonesMessage
  | ServerNowPlayingMessage
  | ServerSeekMessage
  | ServerErrorMessage
  | ServerConnectionMessage
  | ServerClientsListMessage
  | ServerClientConnectedMessage
  | ServerClientDisconnectedMessage
  | ServerClientUpdatedMessage
  | ServerRemoteSettingsMessage;
