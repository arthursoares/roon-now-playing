<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import type { IdleMode } from '@roon-screen-cover/shared';

const props = defineProps<{ mode: IdleMode }>();
const now = ref(new Date());
let timer: ReturnType<typeof setInterval> | null = null;

const time = computed(() => new Intl.DateTimeFormat(undefined, {
  hour: '2-digit',
  minute: '2-digit',
}).format(now.value));
const date = computed(() => new Intl.DateTimeFormat(undefined, {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
}).format(now.value));

onMounted(() => {
  timer = setInterval(() => { now.value = new Date(); }, 1_000);
});
onUnmounted(() => { if (timer) clearInterval(timer); });
</script>

<template>
  <div class="smart-idle" :class="`smart-idle--${props.mode}`" aria-live="polite">
    <div v-if="props.mode === 'clock'" class="smart-idle__clock">
      <time class="smart-idle__time">{{ time }}</time>
      <time class="smart-idle__date">{{ date }}</time>
    </div>
  </div>
</template>

<style scoped>
.smart-idle {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 900;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  background: #000;
  color: #fff;
  pointer-events: none;
}

.smart-idle__clock {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 5vw;
  text-align: center;
}

.smart-idle__time {
  font-size: 18vw;
  font-size: clamp(5rem, 18vw, 28rem);
  font-weight: 200;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.055em;
  line-height: 0.9;
}

.smart-idle__date {
  margin-top: 3vw;
  margin-top: clamp(1.25rem, 3vw, 4rem);
  color: rgba(255, 255, 255, 0.68);
  font-size: 2.3vw;
  font-size: clamp(1.1rem, 2.3vw, 3.5rem);
  font-weight: 300;
  letter-spacing: 0.025em;
}

@media (prefers-reduced-motion: no-preference) {
  .smart-idle__clock { animation: appear 500ms ease-out both; }
  @keyframes appear { from { opacity: 0; } }
}
</style>
