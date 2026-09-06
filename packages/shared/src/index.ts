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
  'album-wall',
  'album-gallery',
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

export const OPENAI_GPT56_MODELS = ['gpt-5.6-luna', 'gpt-5.6-terra', 'gpt-5.6-sol'] as const;
export const OPENAI_FACTS_MODELS = [...OPENAI_GPT56_MODELS, 'gpt-5.5', 'gpt-6-astra'] as const;
const DEPRECATED_OPENAI_FACTS_MODELS: readonly string[] = [
  'gpt-5-mini', 'gpt-5', 'gpt-5-nano', 'gpt-4.1', 'gpt-4o', 'gpt-4o-mini', 'gpt-5.4', 'gpt-5.4-mini',
];

export function migrateOpenAIFactsModel(model: string): string {
  if (model === 'gpt-5.6') return 'gpt-5.6-sol';
  return DEPRECATED_OPENAI_FACTS_MODELS.includes(model) ? 'gpt-5.6-luna' : model;
}

export const OPENAI_REASONING_EFFORTS = ['none', 'minimal', 'low', 'medium', 'high', 'xhigh'] as const;
export type OpenAIReasoningEffort = (typeof OPENAI_REASONING_EFFORTS)[number];
export const DEFAULT_OPENAI_REASONING_EFFORT: OpenAIReasoningEffort = 'none';

export function isGpt56Model(model: string): boolean {
  return model === 'gpt-5.6' || (OPENAI_GPT56_MODELS as readonly string[]).includes(model);
}

export function isOriginalGpt5Model(model: string): boolean {
  return /^(gpt-5|gpt-5-mini|gpt-5-nano)(?:-\d{4}-\d{2}-\d{2})?$/.test(model);
}

export function getOpenAIReasoningEfforts(model: string): readonly OpenAIReasoningEffort[] {
  if (isGpt56Model(model) || model === 'gpt-5.5') return ['none', 'low', 'medium', 'high', 'xhigh'];
  if (model === 'gpt-6-astra') return ['low', 'medium', 'high', 'xhigh'];
  if (isOriginalGpt5Model(model)) return ['minimal', 'low', 'medium', 'high'];
  return [];
}

export function getOpenAIReasoningEffort(model: string, requested?: OpenAIReasoningEffort): OpenAIReasoningEffort | undefined {
  const supported = getOpenAIReasoningEfforts(model);
  return requested && supported.includes(requested) ? requested : supported[0];
}

export function getRecommendedFactsOutputTokens(provider: LLMProvider, model: string): number {
  if (provider === 'openai' && (isOriginalGpt5Model(model) || model === 'gpt-6-astra')) return 8192;
  if (provider === 'openai' && (isGpt56Model(model) || model === 'gpt-5.5')) return 2048;
  return DEFAULT_MAX_OUTPUT_TOKENS;
}

// Model options per provider
export const LLM_MODELS = {
  anthropic: ['claude-haiku-4-5', 'claude-sonnet-4-6', 'claude-opus-4-8'] as const,
  openai: OPENAI_FACTS_MODELS,
  openrouter: [
    'anthropic/claude-sonnet-4.5',
    'openai/gpt-4.1',
    'google/gemini-2.5-flash',
    'meta-llama/llama-3.3-70b-instruct',
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
  maxOutputTokens?: number;
  openaiReasoningEffort?: OpenAIReasoningEffort;
  localBaseUrl?: string; // Only used for 'local' provider
}

export const DEFAULT_MAX_OUTPUT_TOKENS = 1024;
export const MIN_OUTPUT_TOKENS = 1;
export const MAX_OUTPUT_TOKENS = 65536;

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
export const DEFAULT_FACTS_PROMPT = `Give up to {factsCount} concise, accurate music facts about:
Artist: {artist}
Album: {album}
Track: {title}

Focus on recording details, historical context, musical connections, or achievements. Prefer specific information over generic praise. Omit uncertain claims; do not invent quotes, sources, dates, or awards.

Return only a JSON array of strings, one fact per string, with 1-2 sentences per fact.`;

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

export interface RecentAlbum {
  id: string;
  artist: string;
  album: string;
  artwork_key: string | null;
  last_played_at: number;
}

export const ALBUM_HISTORY_LIMIT = 12;

export function getAlbumId(artist: string, album: string): string {
  return JSON.stringify([artist.trim().toLowerCase(), album.trim().toLowerCase()]);
}

export interface ServerAlbumHistoryMessage {
  type: 'album_history';
  zone_id: string;
  albums: RecentAlbum[];
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
  friendly_name?: string;
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
  fontScaleOverride?: number | null; // null = use global, number = custom
  artworkScaleOverride?: number | null;
  enabledLayouts?: LayoutType[] | null;
  lockInteractions?: boolean; // true = disable tap-to-cycle and double-tap-to-change-zone
}

export interface PersistedClientSettings {
  layout: LayoutType;
  font: FontType;
  background: BackgroundType;
  zoneId: string | null;
  zoneName: string | null;
  fontScaleOverride: number | null;
  artworkScaleOverride: number | null;
  enabledLayouts: LayoutType[] | null;
  lockInteractions: boolean;
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
  fontScaleOverride?: number | null;
  artworkScaleOverride?: number | null;
  enabledLayouts?: LayoutType[] | null;
  lockInteractions?: boolean;
}

export interface ServerClientResetMessage {
  type: 'client_reset';
}

// Display settings (stored on server)
export interface DisplaySettings {
  fontScale: number;
  artworkScale: number;
  idleMode: IdleMode;
  idleLayout: LayoutType;
  idleDelayMinutes: number;
  nightDimmingEnabled: boolean;
  nightDimmingStart: string;
  nightDimmingEnd: string;
  nightBrightness: number;
}

export const IDLE_MODES = ['off', 'clock', 'black', 'layout'] as const;
export type IdleMode = (typeof IDLE_MODES)[number];

export const DEFAULT_DISPLAY_SETTINGS: DisplaySettings = {
  fontScale: 1.0,
  artworkScale: 100,
  idleMode: 'off',
  idleLayout: 'cover',
  idleDelayMinutes: 5,
  nightDimmingEnabled: false,
  nightDimmingStart: '22:00',
  nightDimmingEnd: '07:00',
  nightBrightness: 30,
};

export interface DisplaySettingsUpdateMessage {
  type: 'display_settings_update';
  settings: DisplaySettings;
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
  | ServerAlbumHistoryMessage
  | ServerErrorMessage
  | ServerConnectionMessage
  | ServerClientsListMessage
  | ServerClientConnectedMessage
  | ServerClientDisconnectedMessage
  | ServerClientUpdatedMessage
  | ServerRemoteSettingsMessage
  | ServerClientResetMessage
  | DisplaySettingsUpdateMessage;
