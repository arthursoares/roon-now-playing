import { ref, watch, onMounted } from 'vue';
import { LAYOUTS, FONTS, BACKGROUNDS, type LayoutType, type FontType, type BackgroundType } from '@roon-screen-cover/shared';

const STORAGE_KEY_ZONE = 'roon-screen-cover:zone';
const STORAGE_KEY_LAYOUT = 'roon-screen-cover:layout';
const STORAGE_KEY_FONT = 'roon-screen-cover:font';
const STORAGE_KEY_BACKGROUND = 'roon-screen-cover:background';

function isValidLayout(value: string | null): value is LayoutType {
  return value !== null && (LAYOUTS as readonly string[]).includes(value);
}

function isValidFont(value: string | null): value is FontType {
  return value !== null && (FONTS as readonly string[]).includes(value);
}

function isValidBackground(value: string | null): value is BackgroundType {
  return value !== null && (BACKGROUNDS as readonly string[]).includes(value);
}

export function usePreferences() {
  const preferredZone = ref<string | null>(null);
  const layout = ref<LayoutType>('detailed');
  const font = ref<FontType>('system');
  const background = ref<BackgroundType>('black');

  function getUrlParams(): { zone: string | null; layout: LayoutType | null; font: FontType | null; background: BackgroundType | null } {
    const params = new URLSearchParams(window.location.search);
    const zoneParam = params.get('zone');
    const layoutParam = params.get('layout') as LayoutType | null;
    const fontParam = params.get('font') as FontType | null;
    const backgroundParam = params.get('background') as BackgroundType | null;

    return {
      zone: zoneParam,
      layout: isValidLayout(layoutParam) ? layoutParam : null,
      font: isValidFont(fontParam) ? fontParam : null,
      background: isValidBackground(backgroundParam) ? backgroundParam : null,
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
      const stored = localStorage.getItem(STORAGE_KEY_LAYOUT);
      if (isValidLayout(stored)) {
        layout.value = stored;
      }
    }

    // Font: URL param > localStorage > default
    if (urlParams.font) {
      font.value = urlParams.font;
    } else {
      const stored = localStorage.getItem(STORAGE_KEY_FONT);
      if (isValidFont(stored)) {
        font.value = stored;
      }
    }

    // Background: URL param > localStorage > default
    if (urlParams.background) {
      background.value = urlParams.background;
    } else {
      const stored = localStorage.getItem(STORAGE_KEY_BACKGROUND);
      if (isValidBackground(stored)) {
        background.value = stored;
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

  function saveFontPreference(newFont: FontType): void {
    font.value = newFont;
    localStorage.setItem(STORAGE_KEY_FONT, newFont);
  }

  function saveBackgroundPreference(newBackground: BackgroundType): void {
    background.value = newBackground;
    localStorage.setItem(STORAGE_KEY_BACKGROUND, newBackground);
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

  // Watch for font changes and persist
  watch(font, (newFont) => {
    localStorage.setItem(STORAGE_KEY_FONT, newFont);
  });

  // Watch for background changes and persist
  watch(background, (newBackground) => {
    localStorage.setItem(STORAGE_KEY_BACKGROUND, newBackground);
  });

  return {
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
  };
}
