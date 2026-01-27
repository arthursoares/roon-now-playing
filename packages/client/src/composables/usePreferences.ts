import { ref, watch, onMounted } from 'vue';
import type { LayoutType } from '@roon-screen-cover/shared';

const STORAGE_KEY_ZONE = 'roon-screen-cover:zone';
const STORAGE_KEY_LAYOUT = 'roon-screen-cover:layout';

export function usePreferences() {
  const preferredZone = ref<string | null>(null);
  const layout = ref<LayoutType>('detailed');

  function getUrlParams(): { zone: string | null; layout: LayoutType | null } {
    const params = new URLSearchParams(window.location.search);
    const zoneParam = params.get('zone');
    const layoutParam = params.get('layout') as LayoutType | null;

    return {
      zone: zoneParam,
      layout: layoutParam && ['minimal', 'detailed', 'fullscreen'].includes(layoutParam)
        ? layoutParam
        : null,
    };
  }

  function loadPreferences(): void {
    const urlParams = getUrlParams();

    // Zone: URL param > localStorage
    if (urlParams.zone) {
      preferredZone.value = urlParams.zone;
    } else {
      const stored = localStorage.getItem(STORAGE_KEY_ZONE);
      if (stored) {
        preferredZone.value = stored;
      }
    }

    // Layout: URL param > localStorage > default
    if (urlParams.layout) {
      layout.value = urlParams.layout;
    } else {
      const stored = localStorage.getItem(STORAGE_KEY_LAYOUT) as LayoutType | null;
      if (stored && ['minimal', 'detailed', 'fullscreen'].includes(stored)) {
        layout.value = stored;
      }
    }
  }

  function saveZonePreference(zoneIdOrName: string): void {
    preferredZone.value = zoneIdOrName;
    localStorage.setItem(STORAGE_KEY_ZONE, zoneIdOrName);
  }

  function saveLayoutPreference(newLayout: LayoutType): void {
    layout.value = newLayout;
    localStorage.setItem(STORAGE_KEY_LAYOUT, newLayout);
  }

  function clearZonePreference(): void {
    preferredZone.value = null;
    localStorage.removeItem(STORAGE_KEY_ZONE);
  }

  // Load on mount
  onMounted(() => {
    loadPreferences();
  });

  // Watch for layout changes and persist
  watch(layout, (newLayout) => {
    localStorage.setItem(STORAGE_KEY_LAYOUT, newLayout);
  });

  return {
    preferredZone,
    layout,
    saveZonePreference,
    saveLayoutPreference,
    clearZonePreference,
    loadPreferences,
  };
}
