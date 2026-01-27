import { ref, watch, type Ref } from 'vue';
import { FONT_CONFIG, type FontType } from '@roon-screen-cover/shared';

const loadedFonts = new Set<string>();

export function useFontLoader(font: Ref<FontType>) {
  const isLoading = ref(false);
  const isLoaded = ref(font.value === 'system');

  function getFontFamily(fontType: FontType): string {
    if (fontType === 'system') {
      return "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif";
    }
    const config = FONT_CONFIG[fontType];
    return `'${config.displayName}', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`;
  }

  async function loadFont(fontType: FontType): Promise<void> {
    if (fontType === 'system') {
      isLoaded.value = true;
      return;
    }

    const config = FONT_CONFIG[fontType];
    if (!config.googleFont) {
      isLoaded.value = true;
      return;
    }

    // Check if already loaded
    if (loadedFonts.has(fontType)) {
      isLoaded.value = true;
      return;
    }

    isLoading.value = true;
    isLoaded.value = false;

    try {
      // Create link element for Google Fonts
      const linkId = `google-font-${fontType}`;
      let link = document.getElementById(linkId) as HTMLLinkElement | null;

      if (!link) {
        link = document.createElement('link');
        link.id = linkId;
        link.rel = 'stylesheet';
        link.href = `https://fonts.googleapis.com/css2?family=${config.googleFont}&display=swap`;
        document.head.appendChild(link);

        // Wait for font to load
        await new Promise<void>((resolve, reject) => {
          link!.onload = () => resolve();
          link!.onerror = () => reject(new Error(`Failed to load font: ${fontType}`));
        });
      }

      loadedFonts.add(fontType);
      isLoaded.value = true;
    } catch (error) {
      console.error('Failed to load font:', error);
      // Fall back to system font
      isLoaded.value = true;
    } finally {
      isLoading.value = false;
    }
  }

  // Load font when it changes
  watch(
    font,
    (newFont) => {
      loadFont(newFont);
    },
    { immediate: true }
  );

  return {
    isLoading,
    isLoaded,
    getFontFamily,
    loadFont,
  };
}
