<script setup>
import { ref, computed } from 'vue'
import { S, pageMatches, applyTemplate, currentPageAsTemplate, curBoxes, toast } from '../store.js'

const open = ref(false)
const sending = ref(false)
const name = ref('')

const best = computed(() => pageMatches.value[0])
const rest = computed(() => pageMatches.value.slice(1, 6))
const strength = (s) => (s >= 0.85 ? 'strong' : s >= 0.6 ? 'fair' : 'weak')
const short = (n) => (n || '').replace(/^BBP(RESS)?\s*[·_]?\s*/, '')

function startSend() {
  name.value = `BBP · PAGE_${String(S.page + 1).padStart(2, '0')}`
  sending.value = true
}
function send() {
  const n = name.value.trim()
  if (!n) return
  const t = currentPageAsTemplate(n, `From ${S.project?.title || 'issue'} — page ${S.page + 1}`)
  // Studio's PUT replaces the WHOLE library, so we don't fire it blind — hand
  // over a valid one-template library file to import instead. See README.
  const blob = new Blob([JSON.stringify({ version: 1, templates: [t] }, null, 2)], { type: 'application/json' })
  const u = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = u
  a.download = n.replace(/[^\w]+/g, '-').toLowerCase() + '.template.json'
  a.click()
  URL.revokeObjectURL(u)
  sending.value = false
  toast(`Built “${n}” (${t.type}) — import into Studio`)
}
</script>

<template>
  <div class="section">
    <div class="paneTitle">
      Template
      <span v-if="S.templateSource" class="src" :class="S.templateSource"
        :title="S.templateNote || 'live NewsWell Studio library'">{{ S.templateSource }}</span>
    </div>

    <div v-if="!curBoxes.length" class="hint">Draw some blocks to match this page against the library.</div>
    <div v-else-if="!best" class="hint">No templates loaded.</div>

    <template v-else>
      <div class="tmatch" :class="strength(best.score)">
        <div class="tname">{{ short(best.name) }}</div>
        <div class="tbar"><i :style="{ width: Math.round(best.score * 100) + '%' }"></i></div>
        <div class="tmeta">
          <span>{{ best.score.toFixed(2) }} · {{ strength(best.score) }}</span>
          <span>{{ best.type }} · {{ best.slots }} slots</span>
        </div>
        <div v-if="best.unmatchedPage || best.unmatchedSlots" class="tmeta">
          <span class="warnpill">
            {{ best.unmatchedPage ? best.unmatchedPage + ' block(s) unmatched' : '' }}
            {{ best.unmatchedPage && best.unmatchedSlots ? ' · ' : '' }}
            {{ best.unmatchedSlots ? best.unmatchedSlots + ' slot(s) empty' : '' }}
          </span>
        </div>
      </div>

      <div class="row wrap" style="margin-top:7px">
        <button class="ghost grow" title="Replace this page's blocks with the template's slots"
          @click="applyTemplate(S.templates.find(t => t.id === best.id))">Apply</button>
        <button class="ghost" @click="open = !open">{{ open ? '▴' : '▾' }} {{ rest.length }}</button>
      </div>

      <div v-if="open" class="tlist">
        <div v-for="m in rest" :key="m.id" class="trow" :title="m.description"
          @click="applyTemplate(S.templates.find(t => t.id === m.id))">
          <span class="tn">{{ short(m.name) }}</span>
          <span class="ts">{{ m.score.toFixed(2) }}</span>
        </div>
      </div>
    </template>

    <div class="row" style="margin-top:9px">
      <button v-if="!sending" class="ghost grow" :disabled="!curBoxes.length"
        title="Turn this page into a NewsWell PageTemplate" @click="startSend">↑ Send page as template</button>
    </div>
    <div v-if="sending" class="tsend">
      <input v-model="name" spellcheck="false" @keyup.enter="send" @keyup.esc="sending = false">
      <div class="row">
        <button class="primary grow" @click="send">Build</button>
        <button class="ghost" @click="sending = false">Cancel</button>
      </div>
      <div class="hint">Downloads a one-template library file to import in Studio. Direct push needs an append endpoint — see README.</div>
    </div>
  </div>
</template>
