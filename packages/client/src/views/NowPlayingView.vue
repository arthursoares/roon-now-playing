<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { LAYOUTS, type Zone, type LayoutType, type FontType, type BackgroundType } from '@roon-screen-cover/shared';
import QRCode from 'qrcode';
import { useWebSocket } from '../composables/useWebSocket';
import { usePreferences } from '../composables/usePreferences';
import { useFontLoader } from '../composables/useFontLoader';
import ZonePicker from '../components/ZonePicker.vue';
import NowPlaying from '../components/NowPlaying.vue';

const {
  preferredZone,
  layout,
  font,
  background,
  saveZonePreference,
  saveLayoutPreference,
  saveFontPreference,
  saveBackgroundPreference,
  clearZonePreference,
  loadPreferences,
} = usePreferences();

const selectedZoneId = ref<string | null>(null);
const selectedZoneName = ref<string | null>(null);

// Handle remote settings from admin
function handleRemoteSettings(settings: {
  layout?: LayoutType;
  font?: FontType;
  background?: BackgroundType;
  zoneId?: string;
  zoneName?: string;
}) {
  if (settings.layout) {
    saveLayoutPreference(settings.layout);
  }
  if (settings.font) {
    saveFontPreference(settings.font);
  }
  if (settings.background) {
    saveBackgroundPreference(settings.background);
  }
  if (settings.zoneId) {
    selectedZoneId.value = settings.zoneId;
    selectedZoneName.value = settings.zoneName || null;
    if (settings.zoneName) {
      saveZonePreference(settings.zoneName);
    }
    subscribeToZone(settings.zoneId, settings.zoneName);
    showZonePicker.value = false;
  }
}

const { state: wsState, subscribeToZone, unsubscribe, updateMetadata } = useWebSocket({
  layout,
  font,
  background,
  zoneId: selectedZoneId,
  zoneName: selectedZoneName,
  onRemoteSettings: handleRemoteSettings,
});

const { isLoaded: fontLoaded, getFontFamily } = useFontLoader(font);

const fontFamily = computed(() => getFontFamily(font.value));

const showZonePicker = ref(false);

const selectedZone = computed(() => {
  if (!selectedZoneId.value) return null;
  return wsState.value.zones.find((z) => z.id === selectedZoneId.value) ?? null;
});

const connectionStatus = computed(() => {
  if (!wsState.value.connected) return 'connecting';
  if (wsState.value.zones.length === 0 && !selectedZoneId.value) return 'welcome';
  return 'connected';
});

// QR code for welcome screen
const qrCodeDataUrl = ref<string | null>(null);
const configUrl = computed(() => {
  const name = wsState.value.friendlyName;
  if (!name) return null;
  return `${window.location.origin}/admin/screen/${encodeURIComponent(name)}`;
});

watch(configUrl, async (url) => {
  if (url) {
    qrCodeDataUrl.value = await QRCode.toDataURL(url, {
      width: 200,
      margin: 2,
      color: { dark: '#ffffff', light: '#00000000' },
    });
  }
}, { immediate: true });

function findZoneByPreference(zones: Zone[], preference: string | null): Zone | null {
  if (!preference || zones.length === 0) return null;

  // Try to match by ID first
  const byId = zones.find((z) => z.id === preference);
  if (byId) return byId;

  // Try to match by display name (case-insensitive)
  const byName = zones.find((z) => z.display_name.toLowerCase() === preference.toLowerCase());
  if (byName) return byName;

  // Try partial match
  const byPartial = zones.find((z) =>
    z.display_name.toLowerCase().includes(preference.toLowerCase())
  );
  return byPartial ?? null;
}

function selectZone(zone: Zone): void {
  selectedZoneId.value = zone.id;
  selectedZoneName.value = zone.display_name;
  saveZonePreference(zone.display_name);
  subscribeToZone(zone.id, zone.display_name);
  showZonePicker.value = false;
}

function changeZone(): void {
  showZonePicker.value = true;
}

function cycleLayout(): void {
  const currentIndex = LAYOUTS.indexOf(layout.value);
  const nextIndex = (currentIndex + 1) % LAYOUTS.length;
  const newLayout = LAYOUTS[nextIndex];
  saveLayoutPreference(newLayout);
  updateMetadata();
}

// Watch for zones to become available and auto-select
watch(
  () => wsState.value.zones,
  (zones) => {
    if (zones.length === 0) return;

    // If we don't have a selection yet, try to use preference
    if (!selectedZoneId.value) {
      const matched = findZoneByPreference(zones, preferredZone.value);
      if (matched) {
        selectZone(matched);
      } else if (zones.length === 1) {
        // Auto-select if only one zone
        selectZone(zones[0]);
      } else {
        // Show picker
        showZonePicker.value = true;
      }
    }
  },
  { immediate: true }
);

// Watch for layout/font/background changes to update metadata
watch([layout, font, background], () => {
  updateMetadata();
});

// Load preferences on mount
onMounted(() => {
  loadPreferences();
});
</script>

<template>
  <div class="now-playing-view" :style="{ fontFamily }">
    <!-- Connecting spinner -->
    <div v-if="connectionStatus === 'connecting'" class="connection-overlay">
      <div class="connection-status">
        <div class="spinner"></div>
        <p>Connecting to server...</p>
      </div>
    </div>

    <!-- Welcome screen -->
    <div v-else-if="connectionStatus === 'welcome'" class="connection-overlay">
      <div class="welcome-content">
        <h1 v-if="wsState.friendlyName" class="screen-name">{{ wsState.friendlyName }}</h1>
        <img v-if="qrCodeDataUrl" :src="qrCodeDataUrl" alt="Config QR Code" class="qr-code" />
        <p class="welcome-caption">Scan to configure this display</p>
      </div>
    </div>

    <!-- Zone picker modal -->
    <ZonePicker
      v-if="showZonePicker && connectionStatus === 'connected'"
      :zones="wsState.zones"
      :selected-zone-id="selectedZoneId"
      @select="selectZone"
    />

    <!-- Now Playing display -->
    <NowPlaying
      v-else-if="selectedZone && connectionStatus === 'connected'"
      :now-playing="wsState.nowPlaying"
      :zone="selectedZone"
      :layout="layout"
      :background="background"
      @change-zone="changeZone"
      @cycle-layout="cycleLayout"
    />

    <!-- No zone selected fallback -->
    <div v-else-if="connectionStatus === 'connected' && !selectedZone && !showZonePicker" class="no-zone">
      <p>No zone selected</p>
      <button @click="showZonePicker = true">Select Zone</button>
    </div>
  </div>
</template>

<style scoped>
.now-playing-view {
  width: 100%;
  height: 100%;
  background: #000;
  color: #fff;
}

.connection-overlay {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #000;
  z-index: 1000;
}

.connection-status {
  text-align: center;
}

.connection-status p {
  margin-top: 1rem;
  font-size: 1.2rem;
  color: #888;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid #333;
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.welcome-content {
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.5rem;
}

.screen-name {
  font-size: 2rem;
  font-weight: 300;
  color: #fff;
  letter-spacing: 0.05em;
  margin: 0;
}

.qr-code {
  width: 200px;
  height: 200px;
}

.welcome-caption {
  font-size: 1rem;
  color: #666;
  margin: 0;
}

.no-zone {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 1rem;
}

.no-zone p {
  color: #888;
  font-size: 1.2rem;
}

.no-zone button {
  padding: 0.75rem 1.5rem;
  font-size: 1rem;
  background: #333;
  color: #fff;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.2s;
}

.no-zone button:hover {
  background: #444;
}
</style>
