import { computed, onMounted, onUnmounted, ref, watch, type ComputedRef } from 'vue';
import type { DisplaySettings, NowPlaying } from '@roon-screen-cover/shared';

export function isTimeInWindow(now: Date, start: string, end: string): boolean {
  const current = now.getHours() * 60 + now.getMinutes();
  const startMinutes = parseTime(start);
  const endMinutes = parseTime(end);
  if (startMinutes === endMinutes) return false;
  return startMinutes < endMinutes
    ? current >= startMinutes && current < endMinutes
    : current >= startMinutes || current < endMinutes;
}

function parseTime(value: string): number {
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

export function useSmartIdle(
  getNowPlaying: () => NowPlaying | null,
  getSettings: () => DisplaySettings,
  getEnabled: () => boolean,
) {
  const isIdle = ref(false);
  const currentTime = ref(new Date());
  let idleTimer: ReturnType<typeof setTimeout> | null = null;
  let clockTimer: ReturnType<typeof setInterval> | null = null;

  function clearIdleTimer(): void {
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = null;
  }

  function scheduleIdle(): void {
    clearIdleTimer();
    const nowPlaying = getNowPlaying();
    const settings = getSettings();
    if (!getEnabled() || !nowPlaying || nowPlaying.state === 'playing' || settings.idleMode === 'off') {
      isIdle.value = false;
      return;
    }
    idleTimer = setTimeout(() => {
      isIdle.value = true;
      idleTimer = null;
    }, settings.idleDelayMinutes * 60_000);
  }

  function wake(): boolean {
    if (!isIdle.value) return false;
    isIdle.value = false;
    scheduleIdle();
    return true;
  }

  const nightDimmingActive: ComputedRef<boolean> = computed(() => {
    const settings = getSettings();
    return getEnabled()
      && settings.nightDimmingEnabled
      && isTimeInWindow(currentTime.value, settings.nightDimmingStart, settings.nightDimmingEnd);
  });

  const dimOpacity = computed(() => nightDimmingActive.value
    ? 1 - getSettings().nightBrightness / 100
    : 0);

  watch(
    [
      () => getNowPlaying()?.state,
      () => getNowPlaying()?.zone_id,
      () => getSettings().idleMode,
      () => getSettings().idleDelayMinutes,
      getEnabled,
    ],
    ([state]) => {
      if (state === 'playing') {
        clearIdleTimer();
        isIdle.value = false;
      } else {
        scheduleIdle();
      }
    },
    { immediate: true },
  );

  onMounted(() => {
    currentTime.value = new Date();
    clockTimer = setInterval(() => {
      currentTime.value = new Date();
    }, 30_000);
  });

  onUnmounted(() => {
    clearIdleTimer();
    if (clockTimer) clearInterval(clockTimer);
  });

  return { isIdle, wake, nightDimmingActive, dimOpacity };
}
