<script setup>
import { computed } from 'vue'
import { S, coverage } from '../store.js'

const saveText = computed(() => ({
  idle: 'idle', dirty: 'unsaved', ok: 'saved ✓', err: 'save failed'
}[S.saveState]))
</script>

<template>
  <footer>
    <div class="st"><b>xy</b> <span>{{ S.cursor.x }}, {{ S.cursor.y }} pt</span></div>
    <div class="st"><b>zoom</b> <span>{{ Math.round(S.zoom * 100) }}%</span></div>
    <div class="st">
      <b>coverage</b>
      <span class="bar"><i :style="{ width: Math.min(100, coverage.pct) + '%' }"></i></span>
      <span>{{ coverage.pct }}%</span>
    </div>
    <div class="st">
      <span v-if="coverage.overlaps" class="warnpill">⚠ {{ coverage.overlaps }} overlap{{ coverage.overlaps > 1 ? 's' : '' }}</span>
      <span v-else class="okpill">✓ no overlaps</span>
    </div>
    <div class="spacer"></div>
    <div class="st"><span :class="S.saveState">{{ saveText }}</span></div>
  </footer>
</template>
