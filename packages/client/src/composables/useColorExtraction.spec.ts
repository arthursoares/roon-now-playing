import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, defineComponent, nextTick, ref, type Ref } from 'vue';
import { useColorExtraction } from './useColorExtraction';

class DeferredImage {
  crossOrigin = '';
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  src = '';
}

describe('useColorExtraction', () => {
  const images: DeferredImage[] = [];
  let canvasImageUrl = '';

  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('Image', class extends DeferredImage {
      constructor() {
        super();
        images.push(this);
      }
    });

    const context = {
      drawImage: (image: DeferredImage) => { canvasImageUrl = image.src; },
      getImageData: () => {
        const data = new Uint8ClampedArray(50 * 50 * 4);
        const isBlue = canvasImageUrl.includes('blue');
        for (let index = 0; index < data.length; index += 4) {
          data[index] = isBlue ? 0 : 255;
          data[index + 1] = 0;
          data[index + 2] = isBlue ? 255 : 0;
          data[index + 3] = 255;
        }
        return { data, width: 50, height: 50 } as ImageData;
      },
    };

    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
      () => context as unknown as CanvasRenderingContext2D
    );
  });

  afterEach(() => {
    images.length = 0;
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  function mountColorExtraction(artworkUrl: Ref<string | null>) {
    let result: ReturnType<typeof useColorExtraction> | undefined;
    const app = createApp(defineComponent({
      setup() {
        result = useColorExtraction(artworkUrl);
        return () => null;
      },
    }));
    app.mount(document.createElement('div'));

    return { result: result!, unmount: () => app.unmount() };
  }

  async function load(image: DeferredImage): Promise<void> {
    image.onload?.();
    await Promise.resolve();
    await nextTick();
  }

  it('keeps the latest palette when image loads finish out of order', async () => {
    const artworkUrl = ref<string | null>('red.jpg');
    const mounted = mountColorExtraction(artworkUrl);

    artworkUrl.value = 'blue.jpg';
    await nextTick();
    expect(images).toHaveLength(2);

    await load(images[1]);
    const currentBackground = mounted.result.colors.value.background;

    await load(images[0]);
    expect(mounted.result.colors.value.background).toBe(currentBackground);
    mounted.unmount();
  });

  it('invalidates an image load when artwork resets to null', async () => {
    const artworkUrl = ref<string | null>('red.jpg');
    const mounted = mountColorExtraction(artworkUrl);

    artworkUrl.value = null;
    await nextTick();
    expect(mounted.result.colors.value.ready).toBe(false);
    expect(mounted.result.isTransitioning.value).toBe(false);

    await load(images[0]);
    expect(mounted.result.colors.value.ready).toBe(false);
    expect(mounted.result.isTransitioning.value).toBe(false);
    mounted.unmount();
  });

  it('only lets the current image transition timer clear state', async () => {
    const artworkUrl = ref<string | null>('red.jpg');
    const mounted = mountColorExtraction(artworkUrl);
    await load(images[0]);

    await vi.advanceTimersByTimeAsync(250);
    artworkUrl.value = 'blue.jpg';
    await nextTick();
    await load(images[1]);

    await vi.advanceTimersByTimeAsync(250);
    expect(mounted.result.isTransitioning.value).toBe(true);

    await vi.advanceTimersByTimeAsync(250);
    expect(mounted.result.isTransitioning.value).toBe(false);
    expect(mounted.result.previousColors.value).toBeNull();
    mounted.unmount();
  });

  it('does not apply a late image load after unmount', async () => {
    const artworkUrl = ref<string | null>('red.jpg');
    const mounted = mountColorExtraction(artworkUrl);
    mounted.unmount();

    await load(images[0]);
    expect(mounted.result.colors.value.ready).toBe(false);
    expect(mounted.result.isTransitioning.value).toBe(false);
  });
});
