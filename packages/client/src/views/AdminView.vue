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
  type LLMProvider,
  type FactsConfig,
} from '@roon-screen-cover/shared';

const { state: wsState } = useWebSocket({ isAdmin: true });

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

const connectionStatus = computed(() => {
  if (!wsState.value.connected) return 'connecting';
  if (!wsState.value.roonConnected) return 'waiting-roon';
  return 'connected';
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
  // Extract browser name from user agent
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
  // Reset to first model of the new provider
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

onMounted(() => {
  loadFactsConfig();
});
</script>

<template>
  <div class="admin-view">
    <header class="admin-header">
      <div class="brand">
        <h1>Roon Now Playing</h1>
        <span class="subtitle">Admin Panel</span>
      </div>
      <div class="header-right">
        <a href="/" class="back-link" title="Back to Now Playing">
          <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
            <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
          </svg>
          <span>Now Playing</span>
        </a>
        <div class="connection-indicator" :class="connectionStatus">
          <span class="dot"></span>
          <span v-if="connectionStatus === 'connecting'">Connecting...</span>
          <span v-else-if="connectionStatus === 'waiting-roon'">Waiting for Roon</span>
          <span v-else>Connected</span>
        </div>
      </div>
    </header>

    <main class="admin-content">
      <section class="clients-section">
        <h2>Connected Clients ({{ displayClients.length }})</h2>

        <div v-if="displayClients.length === 0" class="empty-state">
          <p>No clients connected</p>
          <p class="hint">Open the main view in another tab or device to see clients here.</p>
        </div>

        <table v-else class="clients-table">
          <thead>
            <tr>
              <th>Name / ID</th>
              <th>Zone</th>
              <th>Layout</th>
              <th>Font</th>
              <th>Background</th>
              <th>Connected</th>
              <th>Device</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="client in displayClients" :key="client.clientId">
              <td class="name-cell">
                <template v-if="editingName === client.clientId">
                  <input
                    v-model="editNameValue"
                    type="text"
                    placeholder="Friendly name"
                    class="name-input"
                    @keyup.enter="saveName(client.clientId)"
                    @keyup.escape="cancelEditName"
                  />
                  <button class="btn-save" @click="saveName(client.clientId)">Save</button>
                  <button class="btn-cancel" @click="cancelEditName">Cancel</button>
                </template>
                <template v-else>
                  <span
                    class="client-name"
                    :class="{ unnamed: !client.friendlyName }"
                    @click="startEditName(client)"
                  >
                    {{ client.friendlyName || client.clientId.slice(0, 8) + '...' }}
                  </span>
                  <button class="btn-edit" @click="startEditName(client)">Edit</button>
                </template>
              </td>
              <td>
                <select
                  :value="client.zoneId || ''"
                  :disabled="pushing[client.clientId]"
                  @change="
                    (e) =>
                      pushSetting(client.clientId, {
                        zoneId: (e.target as HTMLSelectElement).value,
                      })
                  "
                >
                  <option value="" disabled>Select zone</option>
                  <option v-for="zone in wsState.zones" :key="zone.id" :value="zone.id">
                    {{ zone.display_name }}
                  </option>
                </select>
              </td>
              <td>
                <select
                  :value="client.layout"
                  :disabled="pushing[client.clientId]"
                  @change="
                    (e) =>
                      pushSetting(client.clientId, {
                        layout: (e.target as HTMLSelectElement).value as LayoutType,
                      })
                  "
                >
                  <option v-for="l in LAYOUTS" :key="l" :value="l">
                    {{ getLayoutDisplayName(l) }}
                  </option>
                </select>
              </td>
              <td>
                <select
                  :value="client.font"
                  :disabled="pushing[client.clientId]"
                  @change="
                    (e) =>
                      pushSetting(client.clientId, {
                        font: (e.target as HTMLSelectElement).value as FontType,
                      })
                  "
                >
                  <option v-for="f in FONTS" :key="f" :value="f">
                    {{ getFontDisplayName(f) }}
                  </option>
                </select>
              </td>
              <td>
                <select
                  :value="client.background"
                  :disabled="pushing[client.clientId]"
                  @change="
                    (e) =>
                      pushSetting(client.clientId, {
                        background: (e.target as HTMLSelectElement).value as BackgroundType,
                      })
                  "
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
              </td>
              <td class="time-cell">{{ formatTime(client.connectedAt) }}</td>
              <td class="device-cell">{{ formatUserAgent(client.userAgent) }}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <!-- Facts Configuration Section -->
      <section class="facts-section">
        <h2>Facts Configuration</h2>
        <p class="section-hint">
          Configure AI-powered facts generation for the facts layouts.
        </p>

        <div v-if="factsConfigLoading" class="loading-state">
          Loading configuration...
        </div>

        <div v-else class="facts-config-form">
          <!-- Provider & Model Row -->
          <div class="form-row">
            <div class="form-group">
              <label for="provider">Provider</label>
              <select
                id="provider"
                v-model="factsConfig.provider"
                @change="onProviderChange"
              >
                <option v-for="p in LLM_PROVIDERS" :key="p" :value="p">
                  {{ p === 'anthropic' ? 'Anthropic' : 'OpenAI' }}
                </option>
              </select>
            </div>

            <div class="form-group">
              <label for="model">Model</label>
              <select id="model" v-model="factsConfig.model">
                <option v-for="m in availableModels" :key="m" :value="m">
                  {{ m }}
                </option>
              </select>
            </div>
          </div>

          <!-- API Key -->
          <div class="form-group">
            <label for="apiKey">
              API Key
              <span class="hint">(or set via environment variable)</span>
            </label>
            <div class="api-key-input">
              <input
                id="apiKey"
                :type="showApiKey ? 'text' : 'password'"
                v-model="factsConfig.apiKey"
                placeholder="sk-..."
              />
              <button
                type="button"
                class="btn-toggle-key"
                @click="showApiKey = !showApiKey"
              >
                {{ showApiKey ? 'Hide' : 'Show' }}
              </button>
            </div>
          </div>

          <!-- Facts Count & Rotation Row -->
          <div class="form-row">
            <div class="form-group">
              <label for="factsCount">Facts per Track</label>
              <input
                id="factsCount"
                type="number"
                v-model.number="factsConfig.factsCount"
                min="1"
                max="10"
              />
            </div>

            <div class="form-group">
              <label for="rotationInterval">Default Rotation (sec)</label>
              <input
                id="rotationInterval"
                type="number"
                v-model.number="factsConfig.rotationInterval"
                min="5"
                max="60"
              />
            </div>
          </div>

          <!-- Advanced Section -->
          <div class="advanced-section">
            <button
              type="button"
              class="btn-advanced"
              @click="showAdvanced = !showAdvanced"
            >
              {{ showAdvanced ? '▼' : '▶' }} Advanced Settings
            </button>

            <div v-if="showAdvanced" class="advanced-content">
              <div class="form-group">
                <label for="prompt">Custom Prompt Template</label>
                <textarea
                  id="prompt"
                  v-model="factsConfig.prompt"
                  rows="8"
                  placeholder="Custom prompt template..."
                ></textarea>
                <p class="field-hint">
                  Use {artist}, {album}, {title}, {factsCount} as placeholders.
                </p>
              </div>
            </div>
          </div>

          <!-- Save/Reset Buttons -->
          <div class="form-actions">
            <button
              type="button"
              class="btn-primary"
              :disabled="factsConfigSaving"
              @click="saveFactsConfig"
            >
              {{ factsConfigSaving ? 'Saving...' : 'Save Configuration' }}
            </button>
            <button
              type="button"
              class="btn-secondary"
              @click="resetFactsConfig"
            >
              Reset to Defaults
            </button>
          </div>

          <div v-if="factsConfigError" class="message error">
            {{ factsConfigError }}
          </div>
          <div v-if="factsConfigSuccess" class="message success">
            Configuration saved successfully!
          </div>
        </div>

        <!-- Test Section -->
        <div class="test-section">
          <h3>Test Configuration</h3>

          <p class="test-hint">
            Enter track information to test facts generation.
          </p>

          <div class="form-row">
            <div class="form-group">
              <label for="testArtist">Artist</label>
              <input id="testArtist" type="text" v-model="testArtist" />
            </div>
            <div class="form-group">
              <label for="testAlbum">Album</label>
              <input id="testAlbum" type="text" v-model="testAlbum" />
            </div>
            <div class="form-group">
              <label for="testTitle">Title</label>
              <input id="testTitle" type="text" v-model="testTitle" />
            </div>
          </div>

          <button
            type="button"
            class="btn-test"
            :disabled="testRunning || !testArtist || !testAlbum || !testTitle"
            @click="runFactsTest"
          >
            {{ testRunning ? 'Generating...' : 'Generate Test Facts' }}
          </button>

          <div v-if="testError" class="message error">
            {{ testError }}
          </div>

          <div v-if="testResult" class="test-result">
            <div class="result-header">
              <span>Generated {{ testResult.length }} facts</span>
              <span v-if="testDuration" class="duration">
                ({{ (testDuration / 1000).toFixed(1) }}s)
              </span>
            </div>
            <ul class="facts-list">
              <li v-for="(fact, index) in testResult" :key="index">
                {{ fact }}
              </li>
            </ul>
          </div>
        </div>
      </section>
    </main>

    <footer class="admin-footer">
      <span>Roon Now Playing</span>
      <span class="separator">·</span>
      <a href="https://github.com/arthursoares/roon-now-playing" target="_blank" rel="noopener">GitHub</a>
    </footer>
  </div>
</template>

<style scoped>
.admin-view {
  min-height: 100vh;
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: #1a1a2e;
  color: #eee;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  overflow-y: auto;
}

.admin-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 2rem;
  background: #16213e;
  border-bottom: 1px solid #0f3460;
}

.brand {
  display: flex;
  align-items: baseline;
  gap: 0.75rem;
}

.admin-header h1 {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 600;
}

.brand .subtitle {
  font-size: 0.875rem;
  color: #888;
  font-weight: 400;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 1.5rem;
}

.back-link {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: #888;
  text-decoration: none;
  font-size: 0.875rem;
  padding: 0.5rem 0.75rem;
  border-radius: 6px;
  transition: all 0.2s;
}

.back-link:hover {
  color: #fff;
  background: #0f3460;
}

.back-link svg {
  opacity: 0.8;
}

.connection-indicator {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
}

.connection-indicator .dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #666;
}

.connection-indicator.connected .dot {
  background: #4ade80;
}

.connection-indicator.waiting-roon .dot {
  background: #fbbf24;
}

.connection-indicator.connecting .dot {
  background: #666;
  animation: pulse 1s infinite;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

.admin-content {
  flex: 1;
  padding: 2rem;
  max-width: 1400px;
  margin: 0 auto;
  width: 100%;
  box-sizing: border-box;
}

.clients-section h2 {
  margin: 0 0 1rem 0;
  font-size: 1.25rem;
  font-weight: 500;
}

.empty-state {
  text-align: center;
  padding: 3rem;
  background: #16213e;
  border-radius: 8px;
}

.empty-state p {
  margin: 0.5rem 0;
  color: #888;
}

.empty-state .hint {
  font-size: 0.875rem;
}

.clients-table {
  width: 100%;
  border-collapse: collapse;
  background: #16213e;
  border-radius: 8px;
  overflow: hidden;
}

.clients-table th,
.clients-table td {
  padding: 0.75rem 1rem;
  text-align: left;
  border-bottom: 1px solid #0f3460;
}

.clients-table th {
  background: #0f3460;
  font-weight: 500;
  font-size: 0.875rem;
  color: #aaa;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.clients-table tr:last-child td {
  border-bottom: none;
}

.clients-table tr:hover {
  background: #1f2c50;
}

.name-cell {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.client-name {
  cursor: pointer;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  transition: background 0.2s;
}

.client-name:hover {
  background: #0f3460;
}

.client-name.unnamed {
  color: #666;
  font-family: monospace;
  font-size: 0.875rem;
}

.name-input {
  padding: 0.25rem 0.5rem;
  background: #0f3460;
  border: 1px solid #1a3a6e;
  border-radius: 4px;
  color: #fff;
  font-size: 0.875rem;
  width: 140px;
}

.name-input:focus {
  outline: none;
  border-color: #4ade80;
}

.btn-edit,
.btn-save,
.btn-cancel {
  padding: 0.25rem 0.5rem;
  font-size: 0.75rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.2s;
}

.btn-edit {
  background: transparent;
  color: #666;
}

.btn-edit:hover {
  background: #0f3460;
  color: #fff;
}

.btn-save {
  background: #4ade80;
  color: #000;
}

.btn-save:hover {
  background: #22c55e;
}

.btn-cancel {
  background: #666;
  color: #fff;
}

.btn-cancel:hover {
  background: #888;
}

select {
  padding: 0.375rem 0.5rem;
  background: #0f3460;
  border: 1px solid #1a3a6e;
  border-radius: 4px;
  color: #fff;
  font-size: 0.875rem;
  cursor: pointer;
  min-width: 120px;
}

select:hover:not(:disabled) {
  border-color: #4ade80;
}

select:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

select:focus {
  outline: none;
  border-color: #4ade80;
}

.time-cell {
  font-family: monospace;
  font-size: 0.875rem;
  color: #888;
}

.device-cell {
  color: #888;
  font-size: 0.875rem;
}

.admin-footer {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 1.5rem;
  color: #555;
  font-size: 0.8rem;
  border-top: 1px solid #0f3460;
  margin-top: auto;
}

.admin-footer a {
  color: #888;
  text-decoration: none;
  transition: color 0.2s;
}

.admin-footer a:hover {
  color: #4ade80;
}

.admin-footer .separator {
  color: #333;
}

/* Facts Configuration Section */
.facts-section {
  margin-top: 2rem;
  background: #16213e;
  border-radius: 8px;
  padding: 1.5rem;
}

.facts-section h2 {
  margin: 0 0 0.5rem 0;
  font-size: 1.25rem;
  font-weight: 500;
}

.section-hint {
  margin: 0 0 1.5rem 0;
  color: #888;
  font-size: 0.875rem;
}

.loading-state {
  text-align: center;
  padding: 2rem;
  color: #888;
}

.facts-config-form {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.form-row {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
}

.form-row .form-group {
  flex: 1;
  min-width: 200px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.form-group label {
  font-size: 0.875rem;
  color: #aaa;
}

.form-group label .hint {
  font-size: 0.75rem;
  color: #666;
}

.form-group input[type="text"],
.form-group input[type="password"],
.form-group input[type="number"],
.form-group textarea {
  padding: 0.5rem 0.75rem;
  background: #0f3460;
  border: 1px solid #1a3a6e;
  border-radius: 4px;
  color: #fff;
  font-size: 0.875rem;
}

.form-group input:focus,
.form-group textarea:focus {
  outline: none;
  border-color: #4ade80;
}

.form-group textarea {
  font-family: monospace;
  resize: vertical;
}

.api-key-input {
  display: flex;
  gap: 0.5rem;
}

.api-key-input input {
  flex: 1;
}

.btn-toggle-key {
  padding: 0.5rem 0.75rem;
  background: #0f3460;
  border: 1px solid #1a3a6e;
  border-radius: 4px;
  color: #888;
  cursor: pointer;
  font-size: 0.75rem;
}

.btn-toggle-key:hover {
  background: #1a3a6e;
  color: #fff;
}

.advanced-section {
  border-top: 1px solid #0f3460;
  padding-top: 1rem;
}

.btn-advanced {
  background: transparent;
  border: none;
  color: #888;
  cursor: pointer;
  font-size: 0.875rem;
  padding: 0.5rem 0;
}

.btn-advanced:hover {
  color: #fff;
}

.advanced-content {
  margin-top: 1rem;
}

.field-hint {
  font-size: 0.75rem;
  color: #666;
  margin: 0.25rem 0 0 0;
}

.form-actions {
  display: flex;
  gap: 1rem;
  padding-top: 0.5rem;
}

.btn-primary,
.btn-secondary,
.btn-test {
  padding: 0.625rem 1.25rem;
  border-radius: 6px;
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
}

.btn-primary {
  background: #4ade80;
  color: #000;
}

.btn-primary:hover:not(:disabled) {
  background: #22c55e;
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-secondary {
  background: #0f3460;
  color: #aaa;
  border: 1px solid #1a3a6e;
}

.btn-secondary:hover {
  background: #1a3a6e;
  color: #fff;
}

.message {
  padding: 0.75rem;
  border-radius: 4px;
  font-size: 0.875rem;
}

.message.error {
  background: rgba(239, 68, 68, 0.2);
  color: #f87171;
}

.message.success {
  background: rgba(74, 222, 128, 0.2);
  color: #4ade80;
}

/* Test Section */
.test-section {
  margin-top: 2rem;
  padding-top: 1.5rem;
  border-top: 1px solid #0f3460;
}

.test-section h3 {
  margin: 0 0 0.5rem 0;
  font-size: 1rem;
  font-weight: 500;
}

.test-hint {
  color: #888;
  font-size: 0.875rem;
  margin: 0 0 1rem 0;
}

.btn-test {
  background: #3b82f6;
  color: #fff;
  margin-top: 1rem;
}

.btn-test:hover:not(:disabled) {
  background: #2563eb;
}

.btn-test:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.test-result {
  margin-top: 1rem;
  padding: 1rem;
  background: #0f3460;
  border-radius: 6px;
}

.result-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 1rem;
  font-size: 0.875rem;
  color: #aaa;
}

.result-header .duration {
  color: #666;
}

.facts-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.facts-list li {
  padding: 0.75rem;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 4px;
  font-size: 0.875rem;
  line-height: 1.5;
}
</style>
