<script setup lang="ts">
import { computed } from 'vue';
import type { FactSource } from '@roon-screen-cover/shared';
import { readFactSourceGroup } from '../utils/factSources';

const props = defineProps<{
  sources?: unknown;
}>();

const safeSources = computed(() => readFactSourceGroup(props.sources));
const label = computed(() => safeSources.value.length === 1 ? 'Source' : 'Sources');

function linkText(source: FactSource): string {
  if (source.title) return source.title;
  try {
    return new URL(source.url).hostname;
  } catch {
    return source.url;
  }
}
</script>

<template>
  <nav v-if="safeSources.length" class="fact-sources" :aria-label="label">
    <span class="fact-sources-label">{{ label }}:</span>
    <a
      v-for="(source, index) in safeSources"
      :key="`${source.url}:${index}`"
      :href="source.url"
      target="_blank"
      rel="noopener noreferrer"
    >{{ linkText(source) }}</a>
  </nav>
</template>

<style scoped>
.fact-sources {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: inherit;
  column-gap: 0.6em;
  row-gap: 0.25em;
  max-width: 100%;
  margin-top: 0.65em;
  color: inherit;
  font-size: var(--fact-source-font-size, calc(var(--fluid-caption, var(--text-sm)) * var(--font-scale, 1)));
  line-height: var(--leading-snug, 1.35);
  opacity: 0.78;
}

.fact-sources-label {
  opacity: 0.8;
}

.fact-sources a {
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
  color: inherit;
  text-decoration: underline;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
