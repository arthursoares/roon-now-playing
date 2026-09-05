import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, nextTick, type App } from 'vue';
import NowPlayingView from './NowPlayingView.vue';

const { saveLayoutPreference, updateMetadata, subscribeToZone, wsStateHolder } = vi.hoisted(() => ({
  saveLayoutPreference: vi.fn(),
  updateMetadata: vi.fn(),
  subscribeToZone: vi.fn(),
  wsStateHolder: { current: undefined as unknown },
}));

vi.mock('../composables/useWebSocket', async () => {
  const { ref } = await import('vue');
  return { useWebSocket: () => {
    const state = ref({
      connected: true,
      roonConnected: false,
      roonEnabled: false,
      friendlyName: 'test-screen',
      zones: [{ id: 'zone', display_name: 'Test Zone' }],
      nowPlaying: { zone_id: 'zone', state: 'paused', track: null, seek_position: 0 },
      clients: [],
      displaySettings: {
        fontScale: 1,
        artworkScale: 100,
        idleMode: 'layout',
        idleLayout: 'cover',
        idleDelayMinutes: 1,
        nightDimmingEnabled: false,
        nightDimmingStart: '22:00',
        nightDimmingEnd: '07:00',
        nightBrightness: 30,
      },
    });
    wsStateHolder.current = state;
    return { state, subscribeToZone, updateMetadata };
  } };
});
vi.mock('../composables/usePreferences', async () => {
  const { ref } = await import('vue');
  return { usePreferences: () => ({
    preferredZone: ref(null),
    layout: ref('detailed'),
    font: ref('system'),
    background: ref('black'),
    enabledLayouts: ref(null),
    saveZonePreference: vi.fn(),
    saveLayoutPreference,
    saveFontPreference: vi.fn(),
    saveBackgroundPreference: vi.fn(),
    saveEnabledLayoutsPreference: vi.fn(),
    loadPreferences: vi.fn(),
    reapplyUrlParams: vi.fn(),
  }) };
});
vi.mock('../composables/useFontLoader', () => ({
  useFontLoader: () => ({ getFontFamily: () => 'sans-serif' }),
}));
vi.mock('qrcode', () => ({ default: { toDataURL: vi.fn().mockResolvedValue('') } }));
vi.mock('../components/ZonePicker.vue', async () => {
  const { defineComponent } = await import('vue');
  return { default: defineComponent(() => () => null) };
});
vi.mock('../components/NowPlaying.vue', async () => {
  const { defineComponent, h } = await import('vue');
  return { default: defineComponent({
    props: ['layout'],
    emits: ['cycle-layout', 'change-zone'],
    setup(props, { emit }) {
      return () => h('button', {
        class: 'rendered-layout',
        'data-layout': props.layout,
        onClick: () => emit('cycle-layout'),
        onDblclick: () => emit('change-zone'),
      });
    },
  }) };
});

describe('NowPlayingView Smart Idle layout', () => {
  let app: App;
  let host: HTMLDivElement;

  beforeEach(() => {
    vi.useFakeTimers();
    saveLayoutPreference.mockClear();
    updateMetadata.mockClear();
    subscribeToZone.mockClear();
    host = document.createElement('div');
    document.body.append(host);
    app = createApp(NowPlayingView);
    app.mount(host);
  });

  afterEach(() => {
    app.unmount();
    host.remove();
    vi.useRealTimers();
  });

  it('temporarily swaps layouts and suppresses the wake gesture', async () => {
    expect(host.querySelector('.rendered-layout')?.getAttribute('data-layout')).toBe('detailed');
    vi.advanceTimersByTime(60_000);
    await nextTick();
    const idleLayout = host.querySelector<HTMLElement>('.rendered-layout')!;
    expect(idleLayout.getAttribute('data-layout')).toBe('cover');
    expect(saveLayoutPreference).not.toHaveBeenCalled();

    idleLayout.dispatchEvent(new Event('pointerdown', { bubbles: true, cancelable: true }));
    idleLayout.dispatchEvent(new Event('pointerup', { bubbles: true, cancelable: true }));
    idleLayout.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    idleLayout.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true }));
    await nextTick();

    expect(host.querySelector('.rendered-layout')?.getAttribute('data-layout')).toBe('detailed');
    expect(saveLayoutPreference).not.toHaveBeenCalled();
    expect(updateMetadata).not.toHaveBeenCalled();
  });

  it('suppresses a long-touch release but allows the next intentional click', async () => {
    vi.advanceTimersByTime(60_000);
    await nextTick();
    const idleLayout = host.querySelector<HTMLElement>('.rendered-layout')!;
    idleLayout.dispatchEvent(new Event('pointerdown', { bubbles: true, cancelable: true }));
    vi.advanceTimersByTime(2_000);
    idleLayout.dispatchEvent(new Event('pointerup', { bubbles: true, cancelable: true }));
    idleLayout.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    idleLayout.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true }));
    await nextTick();
    expect(host.querySelector('.rendered-layout')?.getAttribute('data-layout')).toBe('detailed');
    expect(saveLayoutPreference).not.toHaveBeenCalled();

    vi.advanceTimersByTime(751);
    host.querySelector<HTMLElement>('.rendered-layout')!
      .dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    expect(saveLayoutPreference).toHaveBeenCalledTimes(1);
    expect(updateMetadata).toHaveBeenCalledTimes(1);
  });

  it('wakes from a legacy click without cycling the normal layout', async () => {
    vi.advanceTimersByTime(60_000);
    await nextTick();
    const idleLayout = host.querySelector<HTMLElement>('.rendered-layout')!;
    expect(idleLayout.getAttribute('data-layout')).toBe('cover');

    idleLayout.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    await nextTick();

    expect(host.querySelector('.rendered-layout')?.getAttribute('data-layout')).toBe('detailed');
    expect(saveLayoutPreference).not.toHaveBeenCalled();
    expect(updateMetadata).not.toHaveBeenCalled();
  });

  it('clears idle on disconnect and starts a fresh delay after reconnect', async () => {
    vi.advanceTimersByTime(60_000);
    await nextTick();
    expect(host.querySelector('.rendered-layout')?.getAttribute('data-layout')).toBe('cover');

    const state = wsStateHolder.current as { value: { connected: boolean } };
    state.value.connected = false;
    await nextTick();
    vi.advanceTimersByTime(600_000);
    state.value.connected = true;
    await nextTick();
    expect(host.querySelector('.rendered-layout')?.getAttribute('data-layout')).toBe('detailed');

    vi.advanceTimersByTime(59_999);
    await nextTick();
    expect(host.querySelector('.rendered-layout')?.getAttribute('data-layout')).toBe('detailed');
    vi.advanceTimersByTime(1);
    await nextTick();
    expect(host.querySelector('.rendered-layout')?.getAttribute('data-layout')).toBe('cover');
  });
});
