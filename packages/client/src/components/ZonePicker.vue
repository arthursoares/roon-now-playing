<script setup lang="ts">
import type { Zone } from '@roon-screen-cover/shared';

const props = defineProps<{
  zones: Zone[];
  selectedZoneId: string | null;
}>();

const emit = defineEmits<{
  select: [zone: Zone];
}>();

function selectZone(zone: Zone): void {
  emit('select', zone);
}
</script>

<template>
  <div class="zone-picker">
    <div class="picker-content">
      <h2>Select Zone</h2>
      <p v-if="zones.length === 0" class="no-zones">No zones available</p>
      <ul v-else class="zone-list">
        <li
          v-for="zone in zones"
          :key="zone.id"
          :class="{ selected: zone.id === selectedZoneId }"
          @click="selectZone(zone)"
        >
          <span class="zone-name">{{ zone.display_name }}</span>
          <span v-if="zone.id === selectedZoneId" class="check">✓</span>
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.zone-picker {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.9);
  z-index: 100;
}

.picker-content {
  max-width: 400px;
  width: 90%;
  padding: 2rem;
}

h2 {
  font-size: 1.5rem;
  font-weight: 500;
  margin-bottom: 1.5rem;
  text-align: center;
}

.no-zones {
  text-align: center;
  color: #888;
}

.zone-list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.zone-list li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.25rem;
  background: #1a1a1a;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.2s;
}

.zone-list li:hover {
  background: #2a2a2a;
}

.zone-list li.selected {
  background: #333;
}

.zone-name {
  font-size: 1.1rem;
}

.check {
  color: #4ade80;
  font-size: 1.2rem;
}
</style>
