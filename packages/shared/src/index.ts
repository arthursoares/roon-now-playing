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
export const LAYOUTS = [
  'detailed',
  'minimal',
  'fullscreen',
  'ambient',
  'cover',
  'facts-columns',
  'facts-overlay',
  'facts-carousel',
  'basic',
] as const;
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
  // Popular UI fonts
  'inter',
  'roboto',
  'open-sans',
  'lato',
  'montserrat',
  'poppins',
  'source-sans-3',
  'nunito',
  'raleway',
  'work-sans',
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
  // Popular UI fonts
  'inter': { displayName: 'Inter', googleFont: 'Inter:wght@300;400;500;600;700' },
  'roboto': { displayName: 'Roboto', googleFont: 'Roboto:wght@300;400;500;700' },
  'open-sans': { displayName: 'Open Sans', googleFont: 'Open+Sans:wght@300;400;500;600;700' },
  'lato': { displayName: 'Lato', googleFont: 'Lato:wght@300;400;700' },
  'montserrat': { displayName: 'Montserrat', googleFont: 'Montserrat:wght@300;400;500;600;700' },
  'poppins': { displayName: 'Poppins', googleFont: 'Poppins:wght@300;400;500;600;700' },
  'source-sans-3': { displayName: 'Source Sans 3', googleFont: 'Source+Sans+3:wght@300;400;500;600;700' },
  'nunito': { displayName: 'Nunito', googleFont: 'Nunito:wght@300;400;500;600;700' },
  'raleway': { displayName: 'Raleway', googleFont: 'Raleway:wght@300;400;500;600;700' },
  'work-sans': { displayName: 'Work Sans', googleFont: 'Work+Sans:wght@300;400;500;600;700' },
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

// LLM Provider options
export const LLM_PROVIDERS = ['anthropic', 'openai', 'openrouter', 'local'] as const;
export type LLMProvider = (typeof LLM_PROVIDERS)[number];

// Model options per provider
export const LLM_MODELS = {
  anthropic: ['claude-sonnet-4-20250514', 'claude-haiku-4-20250514'] as const,
  openai: ['gpt-4o', 'gpt-4o-mini'] as const,
  openrouter: [
    'meta-llama/llama-3.1-70b-instruct',
    'meta-llama/llama-3.1-8b-instruct',
    'mistralai/mistral-large',
    'mistralai/mistral-small',
    'google/gemini-pro-1.5',
    'google/gemini-flash-1.5',
    'deepseek/deepseek-chat',
    'custom',
  ] as const,
  local: [] as const,
} as const;

// Facts configuration (stored on server)
export interface FactsConfig {
  provider: LLMProvider;
  model: string;
  apiKey: string;
  factsCount: number;
  rotationInterval: number;
  prompt: string;
  localBaseUrl?: string; // Only used for 'local' provider
}

// Facts API types
export interface FactsRequest {
  artist: string;
  album: string;
  title: string;
}

export interface FactsResponse {
  facts: string[];
  cached: boolean;
  generatedAt: number;
}

export interface FactsTestRequest {
  artist: string;
  album: string;
  title: string;
}

export interface FactsTestResponse {
  facts: string[];
  durationMs: number;
}

export type FactsErrorType = 'no-key' | 'api-error' | 'empty';

export interface FactsError {
  type: FactsErrorType;
  message: string;
}

// Default prompt template
export const DEFAULT_FACTS_PROMPT = `Generate {factsCount} interesting, lesser-known facts about this music:

Artist: {artist}
Album: {album}
Track: {title}

Focus on:
- Recording history or interesting production details
- Historical context or cultural impact
- Connections to other artists or musical movements
- Awards, chart positions, or notable achievements
- Personal stories from the artist about this work

When possible, include attribution (e.g., "In a 1985 interview..." or "According to Songfacts...").

Keep each fact concise (2-3 sentences max). Prioritize surprising or educational information over common knowledge.

IMPORTANT: Return ONLY a valid JSON array of strings with no additional text, markdown, or explanation.

Example format:
["Fact one goes here.", "Fact two goes here.", "Fact three goes here."]`;

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
  roon_enabled?: boolean;
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

// External source types
export type SourceType = 'roon' | 'external';
export type SourceStatus = 'connected' | 'disconnected';

export interface ExternalZone {
  zone_id: string;
  zone_name: string;
  state: PlaybackState;
  track: Track | null;
  seek_position: number;
  source_status: SourceStatus;
  last_seen: string; // ISO date string
}

export interface ExternalUpdatePayload {
  zone_name: string;
  state: PlaybackState;
  title?: string;
  artist?: string;
  album?: string;
  duration_seconds?: number;
  seek_position?: number;
  artwork_url?: string;
  artwork_base64?: string;
}

export interface ExternalUpdateResponse {
  success: boolean;
  zone_id: string;
  artwork_key?: string;
}

export interface SourcesConfig {
  requireApiKey: boolean;
  apiKey: string;
}

export interface ZoneWithSource extends Zone {
  source: SourceType;
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
