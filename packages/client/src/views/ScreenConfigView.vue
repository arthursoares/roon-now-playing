<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { useRoute } from 'vue-router';
import {
  LAYOUTS,
  FONTS,
  BACKGROUNDS,
  FONT_CONFIG,
  BACKGROUND_CONFIG,
  type LayoutType,
  type FontType,
  type BackgroundType,
  type ClientMetadata,
  type Zone,
} from '@roon-screen-cover/shared';
import { useWebSocket } from '../composables/useWebSocket';

const route = useRoute();
const friendlyName = computed(() => route.params.friendlyName as string);

const { state: wsState } = useWebSocket({ isAdmin: true });

const editingName = ref(false);
const editNameValue = ref('');
const saving = ref(false);
const error = ref<string | null>(null);

// Find the target screen from the admin client list
const screen = computed<ClientMetadata | null>(() => {
  return wsState.value.clients.find(
    (c) => c.friendlyName === friendlyName.value
  ) ?? null;
});

const isConnected = computed(() => screen.value !== null);

// Available zones from websocket state
const zones = computed<Zone[]>(() => wsState.value.zones);

function getLayoutDisplayName(layout: LayoutType): string {
  return layout.charAt(0).toUpperCase() + layout.slice(1).replace(/-/g, ' ');
}

function getFontDisplayName(font: FontType): string {
  return FONT_CONFIG[font]?.displayName || font;
}

function getBackgroundDisplayName(background: BackgroundType): string {
  return BACKGROUND_CONFIG[background]?.displayName || background;
}

function startEditName(): void {
  editingName.value = true;
  editNameValue.value = screen.value?.friendlyName || friendlyName.value;
}

function cancelEditName(): void {
  editingName.value = false;
  editNameValue.value = '';
}

async function saveName(): Promise<void> {
  if (!screen.value) return;
  saving.value = true;
  try {
    await fetch(`/api/admin/clients/${screen.value.clientId}/name`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: editNameValue.value || null }),
    });
    editingName.value = false;
  } catch (err) {
    console.error('Failed to save name:', err);
  } finally {
    saving.value = false;
  }
}

async function pushSetting(
  setting: { layout?: LayoutType; font?: FontType; background?: BackgroundType; zoneId?: string }
): Promise<void> {
  if (!screen.value) return;
  saving.value = true;
  try {
    const resp = await fetch(`/api/admin/clients/${screen.value.clientId}/push`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(setting),
    });
    if (!resp.ok) {
      const data = await resp.json();
      error.value = data.error || 'Failed to push setting';
    }
  } catch (err) {
    console.error('Failed to push setting:', err);
    error.value = 'Network error';
  } finally {
    saving.value = false;
  }
}

// Auto-clear errors
watch(error, (val) => {
  if (val) {
    setTimeout(() => { error.value = null; }, 3000);
  }
});

// Poll for screen data if not yet found via WebSocket
const pollTimer = ref<ReturnType<typeof setInterval> | null>(null);

onMounted(() => {
  // Poll API as fallback if screen not in WS client list
  pollTimer.value = setInterval(async () => {
    if (screen.value) {
      if (pollTimer.value) {
        clearInterval(pollTimer.value);
        pollTimer.value = null;
      }
      return;
    }
    try {
      await fetch(`/api/admin/screens/${encodeURIComponent(friendlyName.value)}`);
    } catch {
      // ignore — screen may not be connected yet
    }
  }, 3000);
});

onUnmounted(() => {
  if (pollTimer.value) clearInterval(pollTimer.value);
});
</script>

<template>
  <div class="screen-config">
    <header class="config-header">
      <a href="/admin" class="back-link">&larr; All Screens</a>
    </header>

    <main class="config-main">
      <!-- Screen name -->
      <section class="config-section">
        <div class="screen-name-row">
          <template v-if="editingName">
            <input
              v-model="editNameValue"
              class="name-input"
              placeholder="Screen name"
              @keyup.enter="saveName"
              @keyup.escape="cancelEditName"
            />
            <button class="btn btn-small" @click="saveName" :disabled="saving">Save</button>
            <button class="btn btn-small btn-ghost" @click="cancelEditName">Cancel</button>
          </template>
          <template v-else>
            <h1 class="screen-name">{{ screen?.friendlyName || friendlyName }}</h1>
            <button v-if="isConnected" class="btn btn-small btn-ghost" @click="startEditName">Rename</button>
          </template>
        </div>
        <div class="connection-badge" :class="{ connected: isConnected }">
          {{ isConnected ? 'Connected' : 'Offline' }}
        </div>
      </section>

      <template v-if="isConnected && screen">
        <!-- Zone picker -->
        <section class="config-section">
          <label class="config-label">Zone</label>
          <div class="option-grid">
            <button
              v-for="zone in zones"
              :key="zone.id"
              class="option-btn"
              :class="{ active: screen.zoneId === zone.id }"
              @click="pushSetting({ zoneId: zone.id })"
            >
              {{ zone.display_name }}
            </button>
          </div>
          <p v-if="zones.length === 0" class="empty-hint">No zones available yet</p>
        </section>

        <!-- Layout picker -->
        <section class="config-section">
          <label class="config-label">Layout</label>
          <div class="option-grid">
            <button
              v-for="l in LAYOUTS"
              :key="l"
              class="option-btn"
              :class="{ active: screen.layout === l }"
              @click="pushSetting({ layout: l })"
            >
              {{ getLayoutDisplayName(l) }}
            </button>
          </div>
        </section>

        <!-- Background picker -->
        <section class="config-section">
          <label class="config-label">Background</label>
          <div class="option-grid">
            <button
              v-for="bg in BACKGROUNDS"
              :key="bg"
              class="option-btn"
              :class="{ active: screen.background === bg }"
              @click="pushSetting({ background: bg })"
            >
              {{ getBackgroundDisplayName(bg) }}
            </button>
          </div>
        </section>

        <!-- Font picker -->
        <section class="config-section">
          <label class="config-label">Font</label>
          <div class="option-grid">
            <button
              v-for="f in FONTS"
              :key="f"
              class="option-btn"
              :class="{ active: screen.font === f }"
              @click="pushSetting({ font: f })"
            >
              {{ getFontDisplayName(f) }}
            </button>
          </div>
        </section>
      </template>

      <!-- Offline state -->
      <div v-else-if="!isConnected" class="offline-message">
        <p>This screen is not currently connected.</p>
        <p class="hint">Turn on the display and it will appear here automatically.</p>
      </div>

      <!-- Error toast -->
      <div v-if="error" class="error-toast">{{ error }}</div>
    </main>
  </div>
</template>

<style scoped>
.screen-config {
  min-height: 100vh;
  background: #111;
  color: #fff;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

.config-header {
  padding: 1rem 1.5rem;
  border-bottom: 1px solid #222;
}

.back-link {
  color: #888;
  text-decoration: none;
  font-size: 0.9rem;
}

.back-link:hover {
  color: #fff;
}

.config-main {
  max-width: 600px;
  margin: 0 auto;
  padding: 1.5rem;
}

.config-section {
  margin-bottom: 2rem;
}

.screen-name-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.screen-name {
  font-size: 1.5rem;
  font-weight: 400;
  margin: 0;
  letter-spacing: 0.02em;
}

.name-input {
  font-size: 1.5rem;
  font-weight: 400;
  background: #222;
  color: #fff;
  border: 1px solid #444;
  border-radius: 6px;
  padding: 0.25rem 0.5rem;
  flex: 1;
  min-width: 0;
}

.connection-badge {
  display: inline-block;
  font-size: 0.75rem;
  padding: 0.25rem 0.75rem;
  border-radius: 100px;
  background: #333;
  color: #888;
  margin-top: 0.5rem;
}

.connection-badge.connected {
  background: #1a3a1a;
  color: #4ade80;
}

.config-label {
  display: block;
  font-size: 0.85rem;
  color: #888;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin-bottom: 0.75rem;
}

.option-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.option-btn {
  padding: 0.6rem 1rem;
  font-size: 0.9rem;
  background: #222;
  color: #ccc;
  border: 1px solid #333;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s;
}

.option-btn:hover {
  background: #2a2a2a;
  border-color: #555;
  color: #fff;
}

.option-btn.active {
  background: #1a1a3a;
  border-color: #4a6cf7;
  color: #fff;
}

.btn {
  padding: 0.5rem 1rem;
  font-size: 0.85rem;
  background: #333;
  color: #fff;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.15s;
}

.btn:hover {
  background: #444;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-small {
  padding: 0.3rem 0.6rem;
  font-size: 0.8rem;
}

.btn-ghost {
  background: transparent;
  color: #888;
}

.btn-ghost:hover {
  color: #fff;
  background: #222;
}

.empty-hint {
  color: #555;
  font-size: 0.9rem;
  font-style: italic;
}

.offline-message {
  text-align: center;
  padding: 3rem 1rem;
}

.offline-message p {
  color: #888;
  font-size: 1.1rem;
}

.offline-message .hint {
  color: #555;
  font-size: 0.9rem;
  margin-top: 0.5rem;
}

.error-toast {
  position: fixed;
  bottom: 1.5rem;
  left: 50%;
  transform: translateX(-50%);
  background: #7f1d1d;
  color: #fca5a5;
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  font-size: 0.9rem;
}
</style>
