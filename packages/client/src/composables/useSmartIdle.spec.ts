import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, defineComponent, nextTick, ref, type App } from 'vue';
import { DEFAULT_DISPLAY_SETTINGS, type DisplaySettings, type NowPlaying } from '@roon-screen-cover/shared';
import { isTimeInWindow, useSmartIdle } from './useSmartIdle';

describe('smart idle timing', () => {
  let app: App;
  let host: HTMLDivElement;
  const nowPlaying = ref<NowPlaying | null>(null);
  const settings = ref<DisplaySettings>({ ...DEFAULT_DISPLAY_SETTINGS, idleMode: 'clock' });
  const enabled = ref(true);

  function mount() {
    let result!: ReturnType<typeof useSmartIdle>;
    app = createApp(defineComponent({
      setup() {
        result = useSmartIdle(() => nowPlaying.value, () => settings.value, () => enabled.value);
        return () => null;
      },
    }));
    host = document.createElement('div');
    app.mount(host);
    return result;
  }

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 5, 12));
    nowPlaying.value = null;
    enabled.value = true;
    settings.value = { ...DEFAULT_DISPLAY_SETTINGS, idleMode: 'clock' };
  });

  afterEach(() => {
    app?.unmount();
    host?.remove();
    vi.useRealTimers();
  });

  it('waits after an explicit pause, wakes temporarily, and returns on playback', async () => {
    nowPlaying.value = playback('paused');
    const idle = mount();

    vi.advanceTimersByTime(299_999);
    expect(idle.isIdle.value).toBe(false);
    vi.advanceTimersByTime(1);
    expect(idle.isIdle.value).toBe(true);

    expect(idle.wake()).toBe(true);
    expect(idle.isIdle.value).toBe(false);
    vi.advanceTimersByTime(300_000);
    expect(idle.isIdle.value).toBe(true);

    nowPlaying.value = playback('playing');
    await nextTick();
    expect(idle.isIdle.value).toBe(false);
    vi.advanceTimersByTime(600_000);
    expect(idle.isIdle.value).toBe(false);
  });

  it('does not infer stopped playback from missing connection state', () => {
    const idle = mount();
    vi.advanceTimersByTime(3_600_000);
    expect(idle.isIdle.value).toBe(false);
  });

  it('starts a fresh delay after reconnecting while paused', async () => {
    nowPlaying.value = playback('paused');
    const idle = mount();
    vi.advanceTimersByTime(240_000);
    enabled.value = false;
    await nextTick();
    vi.advanceTimersByTime(600_000);
    expect(idle.isIdle.value).toBe(false);

    enabled.value = true;
    await nextTick();
    vi.advanceTimersByTime(299_999);
    expect(idle.isIdle.value).toBe(false);
    vi.advanceTimersByTime(1);
    expect(idle.isIdle.value).toBe(true);
  });

  it('restarts the delay when switching between paused zones', async () => {
    nowPlaying.value = playback('paused', 'zone-a');
    const idle = mount();
    vi.advanceTimersByTime(240_000);
    nowPlaying.value = playback('paused', 'zone-b');
    await nextTick();
    vi.advanceTimersByTime(299_999);
    expect(idle.isIdle.value).toBe(false);
    vi.advanceTimersByTime(1);
    expect(idle.isIdle.value).toBe(true);
  });

  it('dims at night only while the schedule is enabled', async () => {
    vi.setSystemTime(new Date(2026, 8, 5, 23, 30));
    settings.value = {
      ...settings.value,
      nightDimmingEnabled: true,
      nightDimmingStart: '22:00',
      nightDimmingEnd: '07:00',
      nightBrightness: 25,
    };
    const idle = mount();
    expect(idle.nightDimmingActive.value).toBe(true);
    expect(idle.dimOpacity.value).toBe(0.75);

    settings.value = { ...settings.value, nightDimmingEnabled: false };
    await nextTick();
    expect(idle.nightDimmingActive.value).toBe(false);
    expect(idle.dimOpacity.value).toBe(0);
  });

  it('restarts the delay when configuration changes and disables idle when off', async () => {
    nowPlaying.value = playback('stopped');
    const idle = mount();
    vi.advanceTimersByTime(240_000);
    settings.value = { ...settings.value, idleDelayMinutes: 10 };
    await nextTick();
    vi.advanceTimersByTime(300_000);
    expect(idle.isIdle.value).toBe(false);
    vi.advanceTimersByTime(300_000);
    expect(idle.isIdle.value).toBe(true);

    settings.value = { ...settings.value, idleMode: 'off' };
    await nextTick();
    expect(idle.isIdle.value).toBe(false);
  });
});

describe('night dimming schedule', () => {
  it('supports overnight and daytime windows using screen-local time', () => {
    expect(isTimeInWindow(new Date(2026, 8, 5, 23, 30), '22:00', '07:00')).toBe(true);
    expect(isTimeInWindow(new Date(2026, 8, 6, 6, 59), '22:00', '07:00')).toBe(true);
    expect(isTimeInWindow(new Date(2026, 8, 6, 7, 0), '22:00', '07:00')).toBe(false);
    expect(isTimeInWindow(new Date(2026, 8, 5, 13, 0), '09:00', '17:00')).toBe(true);
    expect(isTimeInWindow(new Date(2026, 8, 5, 12, 0), '12:00', '12:00')).toBe(false);
  });
});

function playback(state: NowPlaying['state'], zoneId = 'zone'): NowPlaying {
  return { zone_id: zoneId, state, track: null, seek_position: 0 };
}
