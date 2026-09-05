import { createApp, defineComponent, h, nextTick, ref, type App, type Ref } from 'vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import NowPlaying from './NowPlaying.vue';

describe('NowPlaying tap controls', () => {
  let app: App<Element> | null;
  let host: HTMLDivElement;
  let lockInteractions: Ref<boolean>;
  const cycleLayout = vi.fn();
  const changeZone = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    cycleLayout.mockClear();
    changeZone.mockClear();
    app = null;
    lockInteractions = ref(false);
    host = document.createElement('div');
    document.body.append(host);
  });

  afterEach(() => {
    app?.unmount();
    host.remove();
    vi.useRealTimers();
  });

  function mount(): HTMLElement {
    app = createApp(defineComponent({
      setup() {
        return () => h(NowPlaying, {
          nowPlaying: null,
          zone: { id: 'zone', display_name: 'Test Zone' },
          layout: 'detailed',
          background: 'black',
          lockInteractions: lockInteractions.value,
          onCycleLayout: cycleLayout,
          onChangeZone: changeZone,
        });
      },
    }));
    app.mount(host);
    return host.querySelector<HTMLElement>('.now-playing')!;
  }

  it('emits one layout action after the double-click window for a single click', () => {
    const display = mount();

    display.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(cycleLayout).not.toHaveBeenCalled();
    vi.advanceTimersByTime(274);
    expect(cycleLayout).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(cycleLayout).toHaveBeenCalledTimes(1);
  });

  it('ignores layout and zone actions when tap controls are locked', () => {
    lockInteractions.value = true;
    const display = mount();

    display.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    display.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    vi.runAllTimers();

    expect(cycleLayout).not.toHaveBeenCalled();
    expect(changeZone).not.toHaveBeenCalled();
  });

  it('treats the browser click-click-dblclick sequence as only a zone action', () => {
    const display = mount();

    display.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    display.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    display.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    vi.runAllTimers();

    expect(cycleLayout).not.toHaveBeenCalled();
    expect(changeZone).toHaveBeenCalledTimes(1);
  });

  it('cancels a pending layout action when interactions become locked', async () => {
    const display = mount();
    display.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    lockInteractions.value = true;
    await nextTick();
    vi.runAllTimers();

    expect(cycleLayout).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('restores single-click actions after interactions are unlocked', async () => {
    lockInteractions.value = true;
    const display = mount();
    display.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    lockInteractions.value = false;
    await nextTick();
    display.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    vi.advanceTimersByTime(275);

    expect(cycleLayout).toHaveBeenCalledTimes(1);
  });

  it('cleans up a pending layout action when unmounted', () => {
    const display = mount();
    display.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(vi.getTimerCount()).toBe(1);

    app!.unmount();
    app = null;
    vi.runAllTimers();

    expect(cycleLayout).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
});
