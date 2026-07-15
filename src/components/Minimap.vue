<script setup>
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import { S, nPages, paper, kindOf, persist } from '../store.js'
import { drawMini } from '../lib/minimap.js'

const MM_W = 46
const h = computed(() => Math.round((MM_W * paper.value.pageH) / paper.value.pageW))
const canvases = ref([])

function redraw() {
  canvases.value.forEach((c, i) => {
    if (!c) return
    drawMini(c, (S.boxes[i] || []).filter((b) => !b.hidden), { natW: S.natW, natH: S.natH, kindOf })
  })
}
// Debounced: a deep watch fires on every pointermove during a drag, and
// repainting 16 canvases at 60fps to animate a thumbnail is a waste.
let t = null
const schedule = () => { clearTimeout(t); t = setTimeout(() => nextTick(redraw), 120) }
watch(() => S.boxes, schedule, { deep: true })
watch(() => [S.natW, S.natH, nPages.value, S.mm], schedule)
onMounted(() => nextTick(redraw))

function go(i) { if (i !== S.page) { persist(); S.page = i } }
</script>

<template>
  <div id="minimap" :class="{ collapsed: !S.mm }">
    <div class="mmHead">
      <span>Pages</span>
      <button title="Collapse (M)" @click="S.mm = !S.mm">{{ S.mm ? '–' : '+' }}</button>
    </div>
    <div id="mmGrid">
      <button v-for="i in nPages" :key="i" class="mm"
        :class="{ on: S.page === i - 1, empty: !(S.boxes[i - 1] || []).length }"
        :title="'Page ' + i" @click="go(i - 1)">
        <canvas :ref="(el) => (canvases[i - 1] = el)" :width="MM_W * 2" :height="h * 2"
          :style="{ width: MM_W + 'px', height: h + 'px' }"></canvas>
        <span>{{ i }}</span>
      </button>
    </div>
    <div class="mmKey">
      <span><i class="k-ad"></i>ad</span><span><i class="k-ed"></i>ed</span><span><i class="k-fi"></i>fill</span>
    </div>
  </div>
</template>
