<script setup>
import { computed } from 'vue'
import { S, paper, setClass, savePrefs, snapshot, clearSel, save, applyPrediction, coverage, curBoxes } from '../store.js'
import { clearEdgeCache } from '../lib/edges.js'

const groups = computed(() => {
  const order = [], m = {}
  for (const t of S.types) {
    const g = t.group || t.id
    if (!(g in m)) { m[g] = []; order.push(g) }
    m[g].push(t)
  }
  return order.map((g) => ({ name: g, types: m[g] }))
})
const gridModes = computed(() => Object.keys(paper.value.grids))
function cycleGrid() {
  const k = gridModes.value
  S.gridMode = k[(k.indexOf(S.gridMode) + 1) % k.length]
  S.grid = true
  savePrefs()
}
function toggleEdges() { S.edgesOn = !S.edgesOn; clearEdgeCache(); savePrefs() }
function clearPage() {
  if (!curBoxes.value.length) return
  if (!confirm(`Delete all ${curBoxes.value.length} frames on this page?`)) return
  snapshot(); S.boxes[S.page] = []; clearSel(); save()
}
</script>

<template>
  <aside id="left">
    <div class="pane">
      <div class="paneTitle">Block type</div>
      <div class="types">
        <template v-for="g in groups" :key="g.name">
          <div v-if="groups.length > 1" class="grpLabel">{{ g.name }}</div>
          <div v-for="t in g.types" :key="t.id" class="sw" :class="{ active: S.active === t.id }"
            :title="t.desc || t.label" @click="setClass(t.id)">
            <i :style="{ background: t.color }"></i>
            <span class="lab">{{ t.label }}</span>
            <kbd v-if="t.key">{{ t.key.toUpperCase() }}</kbd>
          </div>
        </template>
      </div>

      <div class="section">
        <div class="paneTitle">Guides</div>
        <div class="row">
          <button class="tgl grow" :class="{ on: S.grid }" title="Show grid + margins (G)"
            @click="S.grid = !S.grid; savePrefs()">▦ Grid</button>
          <button class="tgl" :class="{ on: S.gridMode !== paper.defaultGrid }" title="Switch snap grid (C)"
            @click="cycleGrid">{{ S.gridMode }}-col</button>
        </div>
        <div class="row">
          <button class="tgl grow" :class="{ on: S.snap }" title="Master snap toggle — hold Shift to bypass for one drag (S)"
            @click="S.snap = !S.snap; savePrefs()">⌁ Snap</button>
        </div>
        <div class="row">
          <button class="tgl grow" :class="{ on: S.snap && S.snapFrames }" :disabled="!S.snap"
            title="Snap to other blocks' edges. Turn off when frames keep sticking to each other."
            @click="S.snapFrames = !S.snapFrames; savePrefs()">Frames</button>
          <button class="tgl grow" :class="{ on: S.snap && S.edgesOn }" :disabled="!S.snap"
            title="Snap to pixel-detected content edges" @click="toggleEdges">Edges</button>
        </div>
        <div class="hint">
          Snap always takes grid + margins; <b>Frames</b> adds other blocks, <b>Edges</b> adds pixel-detected content.
          Hold <kbd>Shift</kbd> to bypass for one drag. Zoom in for finer control — the magnet is 10px on
          <em>screen</em>, so it covers less of the page the closer you get. <kbd>Alt</kbd>-drag to marquee-select.
        </div>
      </div>

      <div class="section">
        <div class="paneTitle">Page</div>
        <div class="row wrap">
          <button class="ghost" title="Drop in the vision model's first-pass blocks for this page"
            @click="applyPrediction">✨ AI first pass</button>
          <button class="ghost" title="Delete every frame on this page" @click="clearPage">Clear</button>
        </div>
        <div class="hint">{{ coverage.count }} frame{{ coverage.count === 1 ? '' : 's' }} · {{ coverage.pct }}% of content covered</div>
      </div>
    </div>
  </aside>
</template>
