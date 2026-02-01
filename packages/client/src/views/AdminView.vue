<script setup lang="ts">
import { computed, ref, onMounted } from 'vue';
import { useWebSocket } from '../composables/useWebSocket';
import {
  LAYOUTS,
  FONTS,
  FONT_CONFIG,
  BACKGROUNDS,
  BACKGROUND_CONFIG,
  LLM_PROVIDERS,
  LLM_MODELS,
  DEFAULT_FACTS_PROMPT,
  type LayoutType,
  type FontType,
  type BackgroundType,
  type ClientMetadata,
  type FactsConfig,
} from '@roon-screen-cover/shared';

const { state: wsState } = useWebSocket({ isAdmin: true });

// Navigation
const activeSection = ref<'clients' | 'facts' | 'test' | 'sources'>('clients');

const editingName = ref<string | null>(null);
const editNameValue = ref('');
const pushing = ref<Record<string, boolean>>({});

// Facts configuration state
const factsConfig = ref<FactsConfig>({
  provider: 'anthropic',
  model: 'claude-sonnet-4-20250514',
  apiKey: '',
  factsCount: 5,
  rotationInterval: 25,
  prompt: DEFAULT_FACTS_PROMPT,
});
const factsConfigLoading = ref(true);
const factsConfigSaving = ref(false);
const showApiKey = ref(false);
const showAdvanced = ref(false);
const factsConfigError = ref<string | null>(null);
const factsConfigSuccess = ref(false);

// Test facts state
const testArtist = ref('The Beatles');
const testAlbum = ref('Abbey Road');
const testTitle = ref('Come Together');
const testRunning = ref(false);
const testResult = ref<string[] | null>(null);
const testError = ref<string | null>(null);
const testDuration = ref<number | null>(null);

// External sources state
interface SourcesConfig {
  requireApiKey: boolean;
  hasApiKey: boolean;
  apiKey: string;
}

interface ExternalZone {
  zone_id: string;
  zone_name: string;
  source_status: 'connected' | 'disconnected';
  last_seen: string;
  state: string;
}

const sourcesConfig = ref<SourcesConfig>({
  requireApiKey: false,
  hasApiKey: false,
  apiKey: '',
});
const externalZones = ref<ExternalZone[]>([]);
const sourcesLoading = ref(true);
const sourcesConfigSaving = ref(false);
const generatingApiKey = ref(false);
const deletingZone = ref<string | null>(null);
const apiKeyCopied = ref(false);

const connectionStatus = computed(() => {
  if (!wsState.value.connected) return 'connecting';
  // Only show "waiting for Roon" if no zones available (neither Roon nor external)
  if (!wsState.value.roonConnected && wsState.value.zones.length === 0) return 'waiting-roon';
  return 'connected';
});

const connectionLabel = computed(() => {
  if (connectionStatus.value === 'connecting') return 'Connecting';
  if (connectionStatus.value === 'waiting-roon') return 'Waiting for Roon';
  return 'Connected';
});

// Filter out admin clients from the list
const displayClients = computed(() =>
  wsState.value.clients.filter((c) => !c.isAdmin)
);

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString();
}

function formatUserAgent(ua: string | null): string {
  if (!ua) return 'Unknown';
  if (ua.includes('Firefox')) return 'Firefox';
  if (ua.includes('Safari') && !ua.includes('Chrome')) return 'Safari';
  if (ua.includes('Chrome')) return 'Chrome';
  if (ua.includes('Edge')) return 'Edge';
  return 'Browser';
}

function startEditName(client: ClientMetadata): void {
  editingName.value = client.clientId;
  editNameValue.value = client.friendlyName || '';
}

function cancelEditName(): void {
  editingName.value = null;
  editNameValue.value = '';
}

async function saveName(clientId: string): Promise<void> {
  try {
    await fetch(`/api/admin/clients/${clientId}/name`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: editNameValue.value || null }),
    });
    editingName.value = null;
    editNameValue.value = '';
  } catch (error) {
    console.error('Failed to save name:', error);
  }
}

async function pushSetting(
  clientId: string,
  setting: { layout?: LayoutType; font?: FontType; background?: BackgroundType; zoneId?: string }
): Promise<void> {
  pushing.value[clientId] = true;
  try {
    await fetch(`/api/admin/clients/${clientId}/push`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(setting),
    });
  } catch (error) {
    console.error('Failed to push setting:', error);
  } finally {
    pushing.value[clientId] = false;
  }
}

function getLayoutDisplayName(layout: LayoutType): string {
  return layout.charAt(0).toUpperCase() + layout.slice(1);
}

function getFontDisplayName(font: FontType): string {
  return FONT_CONFIG[font]?.displayName || font;
}

function getBackgroundDisplayName(background: BackgroundType): string {
  return BACKGROUND_CONFIG[background]?.displayName || background;
}

// Facts configuration functions
const availableModels = computed(() => {
  return LLM_MODELS[factsConfig.value.provider] || [];
});

async function loadFactsConfig(): Promise<void> {
  try {
    factsConfigLoading.value = true;
    const response = await fetch('/api/facts/config');
    if (response.ok) {
      const config = await response.json();
      factsConfig.value = config;
    }
  } catch (error) {
    console.error('Failed to load facts config:', error);
  } finally {
    factsConfigLoading.value = false;
  }
}

async function saveFactsConfig(): Promise<void> {
  factsConfigSaving.value = true;
  factsConfigError.value = null;
  factsConfigSuccess.value = false;

  try {
    const response = await fetch('/api/facts/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(factsConfig.value),
    });

    if (response.ok) {
      factsConfigSuccess.value = true;
      setTimeout(() => {
        factsConfigSuccess.value = false;
      }, 3000);
    } else {
      const data = await response.json();
      factsConfigError.value = data.error || 'Failed to save configuration';
    }
  } catch (error) {
    factsConfigError.value = 'Network error';
  } finally {
    factsConfigSaving.value = false;
  }
}

function resetFactsConfig(): void {
  factsConfig.value = {
    provider: 'anthropic',
    model: 'claude-sonnet-4-20250514',
    apiKey: '',
    factsCount: 5,
    rotationInterval: 25,
    prompt: DEFAULT_FACTS_PROMPT,
  };
}

function onProviderChange(): void {
  const models = LLM_MODELS[factsConfig.value.provider];
  if (models && models.length > 0) {
    factsConfig.value.model = models[0];
  }
}

async function runFactsTest(): Promise<void> {
  testRunning.value = true;
  testResult.value = null;
  testError.value = null;
  testDuration.value = null;

  const artist = testArtist.value;
  const album = testAlbum.value;
  const title = testTitle.value;

  if (!artist || !album || !title) {
    testError.value = 'Please provide artist, album, and title';
    testRunning.value = false;
    return;
  }

  try {
    const response = await fetch('/api/facts/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ artist, album, title }),
    });

    const data = await response.json();

    if (response.ok) {
      testResult.value = data.facts;
      testDuration.value = data.durationMs;
    } else {
      testError.value = data.error?.message || 'Test failed';
    }
  } catch (error) {
    testError.value = 'Network error';
  } finally {
    testRunning.value = false;
  }
}

// External sources functions
async function fetchSourcesConfig(): Promise<void> {
  try {
    const response = await fetch('/api/sources/config');
    if (response.ok) {
      const config = await response.json();
      sourcesConfig.value = config;
    }
  } catch (error) {
    console.error('Failed to fetch sources config:', error);
  }
}

async function fetchExternalZones(): Promise<void> {
  try {
    const response = await fetch('/api/sources');
    if (response.ok) {
      const data = await response.json();
      externalZones.value = data.zones || [];
    }
  } catch (error) {
    console.error('Failed to fetch external zones:', error);
  }
}

async function loadSourcesData(): Promise<void> {
  sourcesLoading.value = true;
  await Promise.all([fetchSourcesConfig(), fetchExternalZones()]);
  sourcesLoading.value = false;
}

async function toggleRequireApiKey(): Promise<void> {
  sourcesConfigSaving.value = true;
  try {
    const newValue = !sourcesConfig.value.requireApiKey;
    const response = await fetch('/api/sources/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requireApiKey: newValue }),
    });
    if (response.ok) {
      sourcesConfig.value.requireApiKey = newValue;
    }
  } catch (error) {
    console.error('Failed to update sources config:', error);
  } finally {
    sourcesConfigSaving.value = false;
  }
}

async function generateApiKey(): Promise<void> {
  generatingApiKey.value = true;
  try {
    const response = await fetch('/api/sources/config/generate-key', {
      method: 'POST',
    });
    if (response.ok) {
      const data = await response.json();
      sourcesConfig.value.apiKey = data.apiKey;
      sourcesConfig.value.hasApiKey = true;
    }
  } catch (error) {
    console.error('Failed to generate API key:', error);
  } finally {
    generatingApiKey.value = false;
  }
}

async function copyApiKey(): Promise<void> {
  try {
    await navigator.clipboard.writeText(sourcesConfig.value.apiKey);
    apiKeyCopied.value = true;
    setTimeout(() => {
      apiKeyCopied.value = false;
    }, 2000);
  } catch (error) {
    console.error('Failed to copy API key:', error);
  }
}

async function deleteExternalZone(zoneId: string): Promise<void> {
  deletingZone.value = zoneId;
  try {
    const response = await fetch(`/api/sources/${encodeURIComponent(zoneId)}`, {
      method: 'DELETE',
    });
    if (response.ok) {
      externalZones.value = externalZones.value.filter((z) => z.zone_id !== zoneId);
    }
  } catch (error) {
    console.error('Failed to delete external zone:', error);
  } finally {
    deletingZone.value = null;
  }
}

function formatLastSeen(timestamp: string | number): string {
  if (!timestamp) return 'Never';
  const ts = typeof timestamp === 'string' ? new Date(timestamp).getTime() : timestamp;
  const now = Date.now();
  const diff = now - ts;
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return new Date(ts).toLocaleDateString();
}

onMounted(() => {
  loadFactsConfig();
  loadSourcesData();
});
</script>

<template>
  <div class="admin-shell">
    <!-- Sidebar -->
    <aside class="sidebar">
      <div class="sidebar-header">
        <div class="logo">
          <svg viewBox="0 0 24 24" fill="currentColor" class="logo-icon">
            <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
          </svg>
          <div class="logo-text">
            <span class="logo-title">Roon Now Playing</span>
            <span class="logo-subtitle">Admin</span>
          </div>
        </div>
      </div>

      <nav class="sidebar-nav">
        <button
          class="nav-item"
          :class="{ active: activeSection === 'clients' }"
          @click="activeSection = 'clients'"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
            <line x1="8" y1="21" x2="16" y2="21"/>
            <line x1="12" y1="17" x2="12" y2="21"/>
          </svg>
          <span>Displays</span>
          <span v-if="displayClients.length > 0" class="nav-badge">{{ displayClients.length }}</span>
        </button>

        <button
          class="nav-item"
          :class="{ active: activeSection === 'facts' }"
          @click="activeSection = 'facts'"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
            <line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          <span>AI Facts</span>
        </button>

        <button
          class="nav-item"
          :class="{ active: activeSection === 'test' }"
          @click="activeSection = 'test'"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="4 17 10 11 4 5"/>
            <line x1="12" y1="19" x2="20" y2="19"/>
          </svg>
          <span>Test</span>
        </button>

        <button
          class="nav-item"
          :class="{ active: activeSection === 'sources' }"
          @click="activeSection = 'sources'"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 12a9 9 0 0 1-9 9m9-9a9 9 0 0 0-9-9m9 9H3m9 9a9 9 0 0 1-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 0 1 9-9"/>
          </svg>
          <span>Sources</span>
          <span v-if="externalZones.length > 0" class="nav-badge">{{ externalZones.length }}</span>
        </button>
      </nav>

      <div class="sidebar-footer">
        <a href="/" class="back-link">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
          <span>Now Playing</span>
        </a>

        <div class="status-indicator" :class="connectionStatus">
          <span class="status-dot"></span>
          <span class="status-text">{{ connectionLabel }}</span>
        </div>
      </div>
    </aside>

    <!-- Main Content -->
    <main class="main-content">
      <!-- Clients Section -->
      <section v-if="activeSection === 'clients'" class="content-section">
        <header class="section-header">
          <div class="section-title">
            <h1>Connected Displays</h1>
            <p class="section-desc">Manage layout, fonts, and zones for each connected display.</p>
          </div>
          <div class="section-stats">
            <div class="stat">
              <span class="stat-value">{{ displayClients.length }}</span>
              <span class="stat-label">Active</span>
            </div>
            <div class="stat">
              <span class="stat-value">{{ wsState.zones.length }}</span>
              <span class="stat-label">Zones</span>
            </div>
          </div>
        </header>

        <div v-if="displayClients.length === 0" class="empty-state">
          <div class="empty-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
              <line x1="8" y1="21" x2="16" y2="21"/>
              <line x1="12" y1="17" x2="12" y2="21"/>
            </svg>
          </div>
          <h3>No displays connected</h3>
          <p>Open the main view in another tab or device to see displays here.</p>
        </div>

        <div v-else class="clients-grid">
          <article v-for="client in displayClients" :key="client.clientId" class="client-card">
            <header class="card-header">
              <div class="client-identity">
                <template v-if="editingName === client.clientId">
                  <input
                    v-model="editNameValue"
                    type="text"
                    placeholder="Display name"
                    class="name-input"
                    @keyup.enter="saveName(client.clientId)"
                    @keyup.escape="cancelEditName"
                    autofocus
                  />
                  <div class="name-actions">
                    <button class="btn-icon btn-confirm" @click="saveName(client.clientId)" title="Save">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                    </button>
                    <button class="btn-icon btn-cancel" @click="cancelEditName" title="Cancel">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18"/>
                        <line x1="6" y1="6" x2="18" y2="18"/>
                      </svg>
                    </button>
                  </div>
                </template>
                <template v-else>
                  <h3 class="client-name" :class="{ unnamed: !client.friendlyName }">
                    {{ client.friendlyName || 'Unnamed Display' }}
                  </h3>
                  <button class="btn-icon btn-edit" @click="startEditName(client)" title="Edit name">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>
                    </svg>
                  </button>
                </template>
              </div>
              <div class="client-meta">
                <span class="meta-item">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"/>
                    <polyline points="12 6 12 12 16 14"/>
                  </svg>
                  {{ formatTime(client.connectedAt) }}
                </span>
                <span class="meta-item">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="5" y="2" width="14" height="20" rx="2" ry="2"/>
                    <line x1="12" y1="18" x2="12.01" y2="18"/>
                  </svg>
                  {{ formatUserAgent(client.userAgent) }}
                </span>
              </div>
            </header>

            <div class="card-body">
              <div class="setting-group">
                <label class="setting-label">Zone</label>
                <select
                  :value="client.zoneId || ''"
                  :disabled="pushing[client.clientId]"
                  class="setting-select"
                  @change="(e) => pushSetting(client.clientId, { zoneId: (e.target as HTMLSelectElement).value })"
                >
                  <option value="" disabled>Select zone...</option>
                  <option v-for="zone in wsState.zones" :key="zone.id" :value="zone.id">
                    {{ zone.display_name }}
                  </option>
                </select>
              </div>

              <div class="setting-group">
                <label class="setting-label">Layout</label>
                <select
                  :value="client.layout"
                  :disabled="pushing[client.clientId]"
                  class="setting-select"
                  @change="(e) => pushSetting(client.clientId, { layout: (e.target as HTMLSelectElement).value as LayoutType })"
                >
                  <option v-for="l in LAYOUTS" :key="l" :value="l">
                    {{ getLayoutDisplayName(l) }}
                  </option>
                </select>
              </div>

              <div class="setting-group">
                <label class="setting-label">Font</label>
                <select
                  :value="client.font"
                  :disabled="pushing[client.clientId]"
                  class="setting-select"
                  @change="(e) => pushSetting(client.clientId, { font: (e.target as HTMLSelectElement).value as FontType })"
                >
                  <option v-for="f in FONTS" :key="f" :value="f">
                    {{ getFontDisplayName(f) }}
                  </option>
                </select>
              </div>

              <div class="setting-group">
                <label class="setting-label">Background</label>
                <select
                  :value="client.background"
                  :disabled="pushing[client.clientId]"
                  class="setting-select"
                  @change="(e) => pushSetting(client.clientId, { background: (e.target as HTMLSelectElement).value as BackgroundType })"
                >
                  <optgroup label="Basic">
                    <option v-for="b in BACKGROUNDS.filter(bg => BACKGROUND_CONFIG[bg].category === 'basic')" :key="b" :value="b">
                      {{ getBackgroundDisplayName(b) }}
                    </option>
                  </optgroup>
                  <optgroup label="Gradients">
                    <option v-for="b in BACKGROUNDS.filter(bg => BACKGROUND_CONFIG[bg].category === 'gradient')" :key="b" :value="b">
                      {{ getBackgroundDisplayName(b) }}
                    </option>
                  </optgroup>
                  <optgroup label="Artwork">
                    <option v-for="b in BACKGROUNDS.filter(bg => BACKGROUND_CONFIG[bg].category === 'artwork')" :key="b" :value="b">
                      {{ getBackgroundDisplayName(b) }}
                    </option>
                  </optgroup>
                  <optgroup label="Textured">
                    <option v-for="b in BACKGROUNDS.filter(bg => BACKGROUND_CONFIG[bg].category === 'textured')" :key="b" :value="b">
                      {{ getBackgroundDisplayName(b) }}
                    </option>
                  </optgroup>
                </select>
              </div>
            </div>

            <div v-if="pushing[client.clientId]" class="card-loading">
              <div class="loading-bar"></div>
            </div>
          </article>
        </div>
      </section>

      <!-- Facts Configuration Section -->
      <section v-if="activeSection === 'facts'" class="content-section">
        <header class="section-header">
          <div class="section-title">
            <h1>AI Facts Configuration</h1>
            <p class="section-desc">Configure AI-powered facts generation for the facts display layouts.</p>
          </div>
        </header>

        <div v-if="factsConfigLoading" class="loading-state">
          <div class="loading-spinner"></div>
          <span>Loading configuration...</span>
        </div>

        <div v-else class="config-layout">
          <div class="config-main">
            <!-- Provider Card -->
            <div class="config-card">
              <h2 class="card-title">AI Provider</h2>

              <div class="form-grid">
                <div class="form-field">
                  <label for="provider">Provider</label>
                  <select id="provider" v-model="factsConfig.provider" @change="onProviderChange">
                    <option v-for="p in LLM_PROVIDERS" :key="p" :value="p">
                      {{ p === 'anthropic' ? 'Anthropic' : 'OpenAI' }}
                    </option>
                  </select>
                </div>

                <div class="form-field">
                  <label for="model">Model</label>
                  <select id="model" v-model="factsConfig.model">
                    <option v-for="m in availableModels" :key="m" :value="m">
                      {{ m }}
                    </option>
                  </select>
                </div>
              </div>

              <div class="form-field full-width">
                <label for="apiKey">
                  API Key
                  <span class="label-hint">Leave empty to use environment variable</span>
                </label>
                <div class="input-with-action">
                  <input
                    id="apiKey"
                    :type="showApiKey ? 'text' : 'password'"
                    v-model="factsConfig.apiKey"
                    placeholder="sk-..."
                    class="mono-input"
                  />
                  <button type="button" class="input-action" @click="showApiKey = !showApiKey">
                    <svg v-if="!showApiKey" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                    <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                      <line x1="1" y1="1" x2="23" y2="23"/>
                    </svg>
                  </button>
                </div>
              </div>
            </div>

            <!-- Display Settings Card -->
            <div class="config-card">
              <h2 class="card-title">Display Settings</h2>

              <div class="form-grid">
                <div class="form-field">
                  <label for="factsCount">Facts per Track</label>
                  <div class="number-input">
                    <input
                      id="factsCount"
                      type="number"
                      v-model.number="factsConfig.factsCount"
                      min="1"
                      max="10"
                    />
                    <span class="number-hint">1-10</span>
                  </div>
                </div>

                <div class="form-field">
                  <label for="rotationInterval">Rotation Interval</label>
                  <div class="number-input">
                    <input
                      id="rotationInterval"
                      type="number"
                      v-model.number="factsConfig.rotationInterval"
                      min="5"
                      max="60"
                    />
                    <span class="number-hint">seconds</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Advanced Card -->
            <div class="config-card collapsible" :class="{ expanded: showAdvanced }">
              <button class="card-title-button" @click="showAdvanced = !showAdvanced">
                <h2 class="card-title">Advanced Settings</h2>
                <svg class="collapse-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              </button>

              <div v-if="showAdvanced" class="card-content">
                <div class="form-field full-width">
                  <label for="prompt">Custom Prompt Template</label>
                  <textarea
                    id="prompt"
                    v-model="factsConfig.prompt"
                    rows="8"
                    class="mono-input"
                    placeholder="Custom prompt template..."
                  ></textarea>
                  <p class="field-hint">
                    Available placeholders: <code>{artist}</code>, <code>{album}</code>, <code>{title}</code>, <code>{factsCount}</code>
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div class="config-sidebar">
            <div class="action-card">
              <button
                type="button"
                class="btn-primary"
                :disabled="factsConfigSaving"
                @click="saveFactsConfig"
              >
                <svg v-if="!factsConfigSaving" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                  <polyline points="17 21 17 13 7 13 7 21"/>
                  <polyline points="7 3 7 8 15 8"/>
                </svg>
                <span v-if="factsConfigSaving" class="loading-dots">Saving</span>
                <span v-else>Save Configuration</span>
              </button>

              <button type="button" class="btn-secondary" @click="resetFactsConfig">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
                  <path d="M21 3v5h-5"/>
                  <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
                  <path d="M3 21v-5h5"/>
                </svg>
                Reset to Defaults
              </button>
            </div>

            <Transition name="message">
              <div v-if="factsConfigError" class="message-card error">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="15" y1="9" x2="9" y2="15"/>
                  <line x1="9" y1="9" x2="15" y2="15"/>
                </svg>
                <span>{{ factsConfigError }}</span>
              </div>
            </Transition>

            <Transition name="message">
              <div v-if="factsConfigSuccess" class="message-card success">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                  <polyline points="22 4 12 14.01 9 11.01"/>
                </svg>
                <span>Configuration saved!</span>
              </div>
            </Transition>
          </div>
        </div>
      </section>

      <!-- Test Section -->
      <section v-if="activeSection === 'test'" class="content-section">
        <header class="section-header">
          <div class="section-title">
            <h1>Test Facts Generation</h1>
            <p class="section-desc">Enter track information to test your AI facts configuration.</p>
          </div>
        </header>

        <div class="test-layout">
          <div class="test-form-card">
            <h2 class="card-title">Track Information</h2>

            <div class="form-field">
              <label for="testArtist">Artist</label>
              <input id="testArtist" type="text" v-model="testArtist" placeholder="e.g. The Beatles" />
            </div>

            <div class="form-field">
              <label for="testAlbum">Album</label>
              <input id="testAlbum" type="text" v-model="testAlbum" placeholder="e.g. Abbey Road" />
            </div>

            <div class="form-field">
              <label for="testTitle">Track Title</label>
              <input id="testTitle" type="text" v-model="testTitle" placeholder="e.g. Come Together" />
            </div>

            <button
              type="button"
              class="btn-primary btn-test"
              :disabled="testRunning || !testArtist || !testAlbum || !testTitle"
              @click="runFactsTest"
            >
              <svg v-if="!testRunning" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polygon points="5 3 19 12 5 21 5 3"/>
              </svg>
              <span v-if="testRunning" class="loading-dots">Generating</span>
              <span v-else>Generate Facts</span>
            </button>
          </div>

          <div class="test-results">
            <div v-if="testError" class="message-card error">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <line x1="15" y1="9" x2="9" y2="15"/>
                <line x1="9" y1="9" x2="15" y2="15"/>
              </svg>
              <span>{{ testError }}</span>
            </div>

            <div v-if="testResult" class="results-card">
              <header class="results-header">
                <h3>Generated Facts</h3>
                <div class="results-meta">
                  <span class="result-count">{{ testResult.length }} facts</span>
                  <span v-if="testDuration" class="result-time">{{ (testDuration / 1000).toFixed(1) }}s</span>
                </div>
              </header>

              <ul class="facts-list">
                <li v-for="(fact, index) in testResult" :key="index">
                  <span class="fact-number">{{ index + 1 }}</span>
                  <span class="fact-text">{{ fact }}</span>
                </li>
              </ul>
            </div>

            <div v-if="!testResult && !testError" class="results-placeholder">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <circle cx="12" cy="12" r="10"/>
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
                <line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
              <p>Results will appear here</p>
            </div>
          </div>
        </div>
      </section>

      <!-- External Sources Section -->
      <section v-if="activeSection === 'sources'" class="content-section">
        <header class="section-header">
          <div class="section-title">
            <h1>External Sources</h1>
            <p class="section-desc">Manage external audio sources that connect via the API.</p>
          </div>
          <div class="section-stats">
            <div class="stat">
              <span class="stat-value">{{ externalZones.filter(z => z.source_status === 'connected').length }}</span>
              <span class="stat-label">Connected</span>
            </div>
            <div class="stat">
              <span class="stat-value">{{ externalZones.length }}</span>
              <span class="stat-label">Total</span>
            </div>
          </div>
        </header>

        <div v-if="sourcesLoading" class="loading-state">
          <div class="loading-spinner"></div>
          <span>Loading sources...</span>
        </div>

        <div v-else class="sources-layout">
          <!-- API Key Configuration Card -->
          <div class="config-card">
            <h2 class="card-title">API Configuration</h2>

            <div class="toggle-setting">
              <div class="toggle-info">
                <label class="toggle-label">Require API Key</label>
                <p class="toggle-desc">When enabled, external sources must provide a valid API key to connect.</p>
              </div>
              <button
                class="toggle-switch"
                :class="{ active: sourcesConfig.requireApiKey }"
                :disabled="sourcesConfigSaving"
                @click="toggleRequireApiKey"
              >
                <span class="toggle-knob"></span>
              </button>
            </div>

            <div class="api-key-section">
              <label class="setting-label">API Key</label>
              <div v-if="sourcesConfig.hasApiKey" class="api-key-display">
                <code class="api-key-value">{{ sourcesConfig.apiKey }}</code>
                <div class="api-key-actions">
                  <button class="btn-small" @click="copyApiKey" :disabled="apiKeyCopied">
                    <svg v-if="!apiKeyCopied" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                    </svg>
                    <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                    {{ apiKeyCopied ? 'Copied' : 'Copy' }}
                  </button>
                  <button class="btn-small btn-warning" @click="generateApiKey" :disabled="generatingApiKey">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
                      <path d="M21 3v5h-5"/>
                      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
                      <path d="M3 21v-5h5"/>
                    </svg>
                    {{ generatingApiKey ? 'Regenerating...' : 'Regenerate' }}
                  </button>
                </div>
              </div>
              <div v-else class="api-key-generate">
                <p class="no-key-message">No API key has been generated yet.</p>
                <button class="btn-primary btn-small" @click="generateApiKey" :disabled="generatingApiKey">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>
                  </svg>
                  {{ generatingApiKey ? 'Generating...' : 'Generate API Key' }}
                </button>
              </div>
            </div>
          </div>

          <!-- External Zones Table -->
          <div class="config-card">
            <h2 class="card-title">External Zones</h2>

            <div v-if="externalZones.length === 0" class="empty-state-inline">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M21 12a9 9 0 0 1-9 9m9-9a9 9 0 0 0-9-9m9 9H3m9 9a9 9 0 0 1-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 0 1 9-9"/>
              </svg>
              <p>No external zones registered yet.</p>
            </div>

            <table v-else class="zones-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Zone ID</th>
                  <th>Status</th>
                  <th>Last Seen</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="zone in externalZones" :key="zone.zone_id">
                  <td class="zone-name">{{ zone.zone_name }}</td>
                  <td class="zone-id"><code>{{ zone.zone_id }}</code></td>
                  <td>
                    <span class="status-badge" :class="zone.source_status">
                      {{ zone.source_status === 'connected' ? 'Connected' : 'Disconnected' }}
                    </span>
                  </td>
                  <td class="zone-last-seen">{{ formatLastSeen(zone.last_seen) }}</td>
                  <td class="zone-actions">
                    <button
                      class="btn-icon btn-delete"
                      :disabled="deletingZone === zone.zone_id"
                      @click="deleteExternalZone(zone.zone_id)"
                      title="Delete zone"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                        <line x1="10" y1="11" x2="10" y2="17"/>
                        <line x1="14" y1="11" x2="14" y2="17"/>
                      </svg>
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </main>
  </div>
</template>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=JetBrains+Mono:wght@400;500&display=swap');

/* === Base Variables === */
.admin-shell {
  --bg-base: #0a0a0b;
  --bg-elevated: #111113;
  --bg-surface: #18181b;
  --bg-hover: #27272a;
  --border-subtle: #27272a;
  --border-default: #3f3f46;
  --text-primary: #fafafa;
  --text-secondary: #a1a1aa;
  --text-muted: #71717a;
  --accent-primary: #f59e0b;
  --accent-primary-hover: #d97706;
  --accent-success: #10b981;
  --accent-error: #ef4444;
  --accent-info: #3b82f6;
  --font-sans: 'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif;
  --font-mono: 'JetBrains Mono', 'SF Mono', Consolas, monospace;
  --radius-sm: 6px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.3);
  --shadow-md: 0 4px 12px rgba(0, 0, 0, 0.4);
  --transition: 150ms ease;
}

/* === Shell Layout === */
.admin-shell {
  display: flex;
  min-height: 100vh;
  background: var(--bg-base);
  color: var(--text-primary);
  font-family: var(--font-sans);
  font-size: 14px;
  line-height: 1.5;
}

/* === Sidebar === */
.sidebar {
  width: 240px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  background: var(--bg-elevated);
  border-right: 1px solid var(--border-subtle);
}

.sidebar-header {
  padding: 20px;
  border-bottom: 1px solid var(--border-subtle);
}

.logo {
  display: flex;
  align-items: center;
  gap: 12px;
}

.logo-icon {
  width: 32px;
  height: 32px;
  color: var(--accent-primary);
}

.logo-text {
  display: flex;
  flex-direction: column;
  line-height: 1.2;
}

.logo-title {
  font-size: 18px;
  font-weight: 700;
  letter-spacing: -0.02em;
}

.logo-subtitle {
  font-size: 12px;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.sidebar-nav {
  flex: 1;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  background: transparent;
  border: none;
  border-radius: var(--radius-md);
  color: var(--text-secondary);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition);
  text-align: left;
}

.nav-item svg {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
}

.nav-item:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.nav-item.active {
  background: var(--accent-primary);
  color: #000;
}

.nav-item.active svg {
  stroke: #000;
}

.nav-badge {
  margin-left: auto;
  padding: 2px 8px;
  background: var(--bg-hover);
  border-radius: 10px;
  font-size: 12px;
  font-weight: 600;
}

.nav-item.active .nav-badge {
  background: rgba(0, 0, 0, 0.2);
}

.sidebar-footer {
  padding: 12px;
  border-top: 1px solid var(--border-subtle);
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.back-link {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  color: var(--text-muted);
  text-decoration: none;
  border-radius: var(--radius-md);
  font-size: 13px;
  transition: all var(--transition);
}

.back-link svg {
  width: 16px;
  height: 16px;
}

.back-link:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.status-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: var(--bg-surface);
  border-radius: var(--radius-md);
  font-size: 12px;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--text-muted);
}

.status-indicator.connected .status-dot {
  background: var(--accent-success);
  box-shadow: 0 0 8px var(--accent-success);
}

.status-indicator.waiting-roon .status-dot {
  background: var(--accent-primary);
  animation: pulse 1.5s ease-in-out infinite;
}

.status-indicator.connecting .status-dot {
  background: var(--text-muted);
  animation: pulse 1s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

.status-text {
  color: var(--text-secondary);
}

/* === Main Content === */
.main-content {
  flex: 1;
  overflow-y: auto;
  padding: 32px;
}

.content-section {
  max-width: 1200px;
  margin: 0 auto;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 32px;
  padding-bottom: 24px;
  border-bottom: 1px solid var(--border-subtle);
}

.section-title h1 {
  margin: 0 0 8px 0;
  font-size: 28px;
  font-weight: 700;
  letter-spacing: -0.02em;
}

.section-desc {
  margin: 0;
  color: var(--text-muted);
  font-size: 15px;
}

.section-stats {
  display: flex;
  gap: 24px;
}

.stat {
  text-align: right;
}

.stat-value {
  display: block;
  font-size: 32px;
  font-weight: 700;
  color: var(--accent-primary);
  line-height: 1;
  font-family: var(--font-mono);
}

.stat-label {
  font-size: 12px;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

/* === Empty State === */
.empty-state {
  text-align: center;
  padding: 64px 32px;
  background: var(--bg-elevated);
  border-radius: var(--radius-lg);
  border: 1px dashed var(--border-default);
}

.empty-icon {
  width: 64px;
  height: 64px;
  margin: 0 auto 16px;
  color: var(--text-muted);
}

.empty-icon svg {
  width: 100%;
  height: 100%;
}

.empty-state h3 {
  margin: 0 0 8px 0;
  font-size: 18px;
  font-weight: 600;
}

.empty-state p {
  margin: 0;
  color: var(--text-muted);
  font-size: 14px;
}

/* === Client Cards Grid === */
.clients-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  gap: 20px;
}

.client-card {
  background: var(--bg-elevated);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-subtle);
  overflow: hidden;
  transition: border-color var(--transition), box-shadow var(--transition);
  position: relative;
}

.client-card:hover {
  border-color: var(--border-default);
}

.card-header {
  padding: 20px;
  border-bottom: 1px solid var(--border-subtle);
}

.client-identity {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.client-name {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  flex: 1;
}

.client-name.unnamed {
  color: var(--text-muted);
  font-style: italic;
}

.name-input {
  flex: 1;
  padding: 8px 12px;
  background: var(--bg-surface);
  border: 1px solid var(--accent-primary);
  border-radius: var(--radius-sm);
  color: var(--text-primary);
  font-size: 14px;
  font-family: inherit;
}

.name-input:focus {
  outline: none;
  box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.2);
}

.name-actions {
  display: flex;
  gap: 4px;
}

.btn-icon {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  border-radius: var(--radius-sm);
  color: var(--text-muted);
  cursor: pointer;
  transition: all var(--transition);
}

.btn-icon svg {
  width: 16px;
  height: 16px;
}

.btn-icon:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.btn-icon.btn-confirm:hover {
  background: var(--accent-success);
  color: #fff;
}

.btn-icon.btn-cancel:hover {
  background: var(--accent-error);
  color: #fff;
}

.client-meta {
  display: flex;
  gap: 16px;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--text-muted);
}

.meta-item svg {
  width: 14px;
  height: 14px;
}

.card-body {
  padding: 20px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.setting-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.setting-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.setting-select {
  padding: 10px 12px;
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  color: var(--text-primary);
  font-size: 13px;
  font-family: inherit;
  cursor: pointer;
  transition: border-color var(--transition);
}

.setting-select:hover:not(:disabled) {
  border-color: var(--border-default);
}

.setting-select:focus {
  outline: none;
  border-color: var(--accent-primary);
}

.setting-select:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.card-loading {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: var(--bg-surface);
  overflow: hidden;
}

.loading-bar {
  height: 100%;
  width: 30%;
  background: var(--accent-primary);
  animation: loading 1s ease-in-out infinite;
}

@keyframes loading {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(400%); }
}

/* === Configuration Layout === */
.config-layout {
  display: grid;
  grid-template-columns: 1fr 280px;
  gap: 24px;
  align-items: start;
}

.config-main {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.config-card {
  background: var(--bg-elevated);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-subtle);
  padding: 24px;
}

.card-title {
  margin: 0 0 20px 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-field.full-width {
  grid-column: 1 / -1;
}

.form-field label {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary);
}

.label-hint {
  font-size: 11px;
  font-weight: 400;
  color: var(--text-muted);
  margin-left: 8px;
}

.form-field input,
.form-field select,
.form-field textarea {
  padding: 10px 14px;
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  color: var(--text-primary);
  font-size: 14px;
  font-family: inherit;
  transition: border-color var(--transition);
}

.form-field input:hover,
.form-field select:hover,
.form-field textarea:hover {
  border-color: var(--border-default);
}

.form-field input:focus,
.form-field select:focus,
.form-field textarea:focus {
  outline: none;
  border-color: var(--accent-primary);
}

.mono-input {
  font-family: var(--font-mono) !important;
  font-size: 13px !important;
}

.input-with-action {
  display: flex;
  gap: 8px;
}

.input-with-action input {
  flex: 1;
}

.input-action {
  width: 42px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  color: var(--text-muted);
  cursor: pointer;
  transition: all var(--transition);
}

.input-action svg {
  width: 18px;
  height: 18px;
}

.input-action:hover {
  border-color: var(--border-default);
  color: var(--text-primary);
}

.number-input {
  display: flex;
  align-items: center;
  gap: 8px;
}

.number-input input {
  width: 80px;
  text-align: center;
}

.number-hint {
  font-size: 12px;
  color: var(--text-muted);
}

.field-hint {
  font-size: 12px;
  color: var(--text-muted);
  margin: 4px 0 0;
}

.field-hint code {
  padding: 2px 6px;
  background: var(--bg-surface);
  border-radius: 4px;
  font-family: var(--font-mono);
  font-size: 11px;
}

/* Collapsible Card */
.collapsible .card-title-button {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 0;
  margin: 0;
  background: none;
  border: none;
  cursor: pointer;
  color: inherit;
}

.collapsible .card-title-button .card-title {
  margin: 0;
}

.collapse-icon {
  width: 20px;
  height: 20px;
  color: var(--text-muted);
  transition: transform var(--transition);
}

.collapsible.expanded .collapse-icon {
  transform: rotate(180deg);
}

.collapsible .card-content {
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid var(--border-subtle);
}

/* Config Sidebar */
.config-sidebar {
  display: flex;
  flex-direction: column;
  gap: 16px;
  position: sticky;
  top: 32px;
}

.action-card {
  background: var(--bg-elevated);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-subtle);
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.btn-primary,
.btn-secondary {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px 20px;
  border-radius: var(--radius-md);
  font-size: 14px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  transition: all var(--transition);
  border: none;
}

.btn-primary svg,
.btn-secondary svg {
  width: 18px;
  height: 18px;
}

.btn-primary {
  background: var(--accent-primary);
  color: #000;
}

.btn-primary:hover:not(:disabled) {
  background: var(--accent-primary-hover);
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-secondary {
  background: var(--bg-surface);
  color: var(--text-secondary);
  border: 1px solid var(--border-subtle);
}

.btn-secondary:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.loading-dots::after {
  content: '';
  animation: dots 1.5s infinite;
}

@keyframes dots {
  0%, 20% { content: ''; }
  40% { content: '.'; }
  60% { content: '..'; }
  80%, 100% { content: '...'; }
}

.message-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  border-radius: var(--radius-md);
  font-size: 13px;
  font-weight: 500;
}

.message-card svg {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
}

.message-card.error {
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  color: #fca5a5;
}

.message-card.success {
  background: rgba(16, 185, 129, 0.1);
  border: 1px solid rgba(16, 185, 129, 0.3);
  color: #6ee7b7;
}

.message-enter-active,
.message-leave-active {
  transition: all 0.3s ease;
}

.message-enter-from,
.message-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

/* === Loading State === */
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 64px;
  color: var(--text-muted);
}

.loading-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--border-subtle);
  border-top-color: var(--accent-primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* === Test Layout === */
.test-layout {
  display: grid;
  grid-template-columns: 400px 1fr;
  gap: 24px;
  align-items: start;
}

.test-form-card {
  background: var(--bg-elevated);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-subtle);
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.btn-test {
  margin-top: 8px;
}

.test-results {
  min-height: 300px;
}

.results-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  height: 300px;
  background: var(--bg-elevated);
  border-radius: var(--radius-lg);
  border: 1px dashed var(--border-default);
  color: var(--text-muted);
}

.results-placeholder svg {
  width: 48px;
  height: 48px;
  opacity: 0.5;
}

.results-placeholder p {
  margin: 0;
  font-size: 14px;
}

.results-card {
  background: var(--bg-elevated);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-subtle);
  overflow: hidden;
}

.results-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  background: var(--bg-surface);
  border-bottom: 1px solid var(--border-subtle);
}

.results-header h3 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
}

.results-meta {
  display: flex;
  gap: 16px;
  font-size: 12px;
}

.result-count {
  color: var(--accent-primary);
  font-weight: 600;
}

.result-time {
  color: var(--text-muted);
  font-family: var(--font-mono);
}

.facts-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.facts-list li {
  display: flex;
  gap: 16px;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-subtle);
  transition: background var(--transition);
}

.facts-list li:last-child {
  border-bottom: none;
}

.facts-list li:hover {
  background: var(--bg-surface);
}

.fact-number {
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-hover);
  border-radius: 50%;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-muted);
}

.fact-text {
  font-size: 14px;
  line-height: 1.6;
  color: var(--text-secondary);
}

/* === Responsive === */
@media (max-width: 1200px) {
  .config-layout {
    grid-template-columns: 1fr;
  }

  .config-sidebar {
    position: static;
    flex-direction: row;
    flex-wrap: wrap;
  }

  .action-card {
    flex: 1;
    min-width: 200px;
  }
}

@media (max-width: 900px) {
  .test-layout {
    grid-template-columns: 1fr;
  }

  .form-grid {
    grid-template-columns: 1fr;
  }

  .card-body {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .admin-shell {
    flex-direction: column;
    height: 100vh;
    overflow: hidden;
  }

  .sidebar {
    width: 100%;
    flex-direction: row;
    flex-wrap: wrap;
    flex-shrink: 0;
    border-right: none;
    border-bottom: 1px solid var(--border-subtle);
  }

  .sidebar-header {
    flex: 1;
    border-bottom: none;
  }

  .sidebar-nav {
    flex-direction: row;
    padding: 8px 12px;
    overflow-x: auto;
    flex: none;
  }

  .sidebar-footer {
    flex-direction: row;
    border-top: none;
    border-left: 1px solid var(--border-subtle);
  }

  .main-content {
    padding: 20px;
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
  }

  .clients-grid {
    grid-template-columns: 1fr;
  }
}

/* === Sources Section === */
.sources-layout {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.toggle-setting {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  padding: 16px 0;
  border-bottom: 1px solid var(--border-subtle);
}

.toggle-info {
  flex: 1;
}

.toggle-label {
  display: block;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 4px;
}

.toggle-desc {
  margin: 0;
  font-size: 13px;
  color: var(--text-muted);
}

.toggle-switch {
  position: relative;
  width: 48px;
  height: 26px;
  background: var(--bg-surface);
  border: 1px solid var(--border-default);
  border-radius: 13px;
  cursor: pointer;
  transition: all var(--transition);
  flex-shrink: 0;
}

.toggle-switch:hover:not(:disabled) {
  border-color: var(--text-muted);
}

.toggle-switch.active {
  background: var(--accent-primary);
  border-color: var(--accent-primary);
}

.toggle-switch:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.toggle-knob {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 20px;
  height: 20px;
  background: var(--text-secondary);
  border-radius: 50%;
  transition: all var(--transition);
}

.toggle-switch.active .toggle-knob {
  left: 24px;
  background: #000;
}

.api-key-section {
  padding-top: 20px;
}

.api-key-display {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 8px;
  padding: 12px 16px;
  background: var(--bg-surface);
  border-radius: var(--radius-md);
  border: 1px solid var(--border-subtle);
}

.api-key-value {
  flex: 1;
  font-family: var(--font-mono);
  font-size: 13px;
  color: var(--text-secondary);
  word-break: break-all;
}

.api-key-actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}

.api-key-generate {
  margin-top: 8px;
}

.no-key-message {
  margin: 0 0 12px 0;
  font-size: 13px;
  color: var(--text-muted);
}

.btn-small {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 500;
  font-family: inherit;
  cursor: pointer;
  transition: all var(--transition);
}

.btn-small svg {
  width: 14px;
  height: 14px;
}

.btn-small:hover:not(:disabled) {
  background: var(--bg-hover);
  border-color: var(--border-default);
  color: var(--text-primary);
}

.btn-small:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-small.btn-warning:hover:not(:disabled) {
  background: rgba(245, 158, 11, 0.1);
  border-color: var(--accent-primary);
  color: var(--accent-primary);
}

.btn-primary.btn-small {
  background: var(--accent-primary);
  border-color: var(--accent-primary);
  color: #000;
}

.btn-primary.btn-small:hover:not(:disabled) {
  background: var(--accent-primary-hover);
  border-color: var(--accent-primary-hover);
}

.empty-state-inline {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 32px;
  color: var(--text-muted);
  text-align: center;
}

.empty-state-inline svg {
  width: 48px;
  height: 48px;
  opacity: 0.5;
}

.empty-state-inline p {
  margin: 0;
  font-size: 14px;
}

.zones-table {
  width: 100%;
  border-collapse: collapse;
}

.zones-table th,
.zones-table td {
  padding: 12px 16px;
  text-align: left;
  border-bottom: 1px solid var(--border-subtle);
}

.zones-table th {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  background: var(--bg-surface);
}

.zones-table tbody tr:hover {
  background: var(--bg-surface);
}

.zones-table tbody tr:last-child td {
  border-bottom: none;
}

.zone-name {
  font-weight: 500;
  color: var(--text-primary);
}

.zone-id code {
  padding: 4px 8px;
  background: var(--bg-surface);
  border-radius: var(--radius-sm);
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--text-secondary);
}

.zone-last-seen {
  color: var(--text-muted);
  font-size: 13px;
}

.zone-actions {
  width: 48px;
  text-align: right;
}

.status-badge {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
}

.status-badge.connected {
  background: rgba(16, 185, 129, 0.1);
  color: var(--accent-success);
}

.status-badge.disconnected {
  background: var(--bg-surface);
  color: var(--text-muted);
}

.btn-icon.btn-delete:hover {
  background: rgba(239, 68, 68, 0.1);
  color: var(--accent-error);
}
</style>
