import { createApp, defineComponent, h, nextTick, ref, type App } from 'vue';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import ProgressBar from './ProgressBar.vue';

describe('ProgressBar', () => {
  let app: App<Element> | null;
  let host: HTMLDivElement;

  beforeEach(() => {
    app = null;
    host = document.createElement('div');
    document.body.append(host);
  });

  afterEach(() => {
    app?.unmount();
    host.remove();
  });

  function mount(progress: number) {
    const value = ref(progress);
    app = createApp(defineComponent({
      setup: () => () => h(ProgressBar, {
        progress: value.value,
        currentTime: '0:42',
        duration: '3:57',
      }),
    }));
    app.mount(host);
    return { value, fill: host.querySelector<HTMLElement>('.progress-fill')! };
  }

  it('updates progress through a scale transform without changing fill width', async () => {
    const { value, fill } = mount(25);

    expect(fill.style.transform).toBe('scaleX(0.25)');
    expect(fill.style.width).toBe('');

    value.value = 75;
    await nextTick();

    expect(fill.style.transform).toBe('scaleX(0.75)');
    expect(fill.style.width).toBe('');
  });

  it.each([
    { progress: -20, scale: 0 },
    { progress: 120, scale: 1 },
    { progress: Number.NaN, scale: 0 },
    { progress: Number.POSITIVE_INFINITY, scale: 0 },
    { progress: Number.NEGATIVE_INFINITY, scale: 0 },
  ])('clamps $progress to scaleX($scale)', ({ progress, scale }) => {
    const { fill } = mount(progress);

    expect(fill.style.transform).toBe(`scaleX(${scale})`);
  });
});
