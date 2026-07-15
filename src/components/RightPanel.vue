<script setup>
import { computed } from 'vue'
import {
  S, conv, curBoxes, selBoxes, colorOf, labelOf, rolesFor, boxById, isSel,
  setSel, toggleSel, clearSel, snapshot, save, setClass, deleteSel, duplicate, align, zorder
} from '../store.js'
import { clamp } from '../lib/geometry.js'

const one = computed(() => (S.sel.length === 1 ? boxById(S.primary) || selBoxes.value[0] : null))
const roles = computed(() => (one.value ? rolesFor(one.value.cls) : null))

/* Numeric fields commit on change (blur/enter), not per-keystroke — live binding
   fights the canvas and would push an undo entry per digit typed. */
function setNum(field, e) {
  const b = one.value
  const v = parseFloat(e.target.value)
  if (!b || isNaN(v)) return
  const c = conv.value
  snapshot()
  if (field === 'x') b.x = clamp(c.ptToPxX(v), 0, S.natW - b.w)
  if (field === 'y') b.y = clamp(c.ptToPxY(v), 0, S.natH - b.h)
  if (field === 'w') b.w = clamp(c.ptToPxW(v), 4, S.natW - b.x)
  if (field === 'h') b.h = clamp(c.ptToPxH(v), 4, S.natH - b.y)
  save()
}
function setRole(e) {
  const b = one.value
  if (!b) return
  snapshot()
  b.role = e.target.value
  S.defaultRole[b.cls] = e.target.value
  save()
}

/* Layers: front (last painted) reads at the top, like every other editor. */
const layers = computed(() => [...curBoxes.value].reverse())
const pick = (b, ev) => (ev.shiftKey ? toggleSel(b.id) : setSel([b.id], b.id))
const toggleHidden = (b) => { snapshot(); b.hidden = !b.hidden; if (b.hidden && isSel(b.id)) clearSel(); save() }
const toggleLock = (b) => { snapshot(); b.locked = !b.locked; save() }
const del = (b) => { snapshot(); S.boxes[S.page] = curBoxes.value.filter((x) => x.id !== b.id); if (isSel(b.id)) clearSel(); save() }
const dims = (b) => `${Math.round(conv.value.pxToPtW(b.w))}×${Math.round(conv.value.pxToPtH(b.h))}`

const ALIGN = [
  { op: 'l', t: '⇤', title: 'Align left' }, { op: 'ch', t: '⇔', title: 'Align h-center' }, { op: 'r', t: '⇥', title: 'Align right' },
  { op: 't', t: '⤒', title: 'Align top' }, { op: 'cv', t: '⇕', title: 'Align v-center' }, { op: 'b', t: '⤓', title: 'Align bottom' }
]
</script>

<template>
  <aside id="right">
    <section id="inspector">
      <div v-if="!S.sel.length" class="empty">Nothing selected.<br>Pick a block type at left, then drag on the page.</div>

      <template v-else-if="one">
        <div class="paneTitle">Inspector</div>
        <div class="field">
          <label>Type</label>
          <select :value="one.cls" @change="setClass($event.target.value)">
            <option v-for="t in S.types" :key="t.id" :value="t.id">{{ t.label }}</option>
          </select>
        </div>
        <div v-if="roles" class="field" style="margin-top:9px">
          <label>Editorial role</label>
          <select :value="one.role" @change="setRole">
            <option v-for="r in roles" :key="r" :value="r">{{ r }}</option>
          </select>
        </div>
        <div class="xy" style="margin-top:11px">
          <div class="numwrap"><span>X</span><input type="number" step="1" :value="Math.round(conv.pxToPtX(one.x))" @change="setNum('x', $event)"><em class="u">pt</em></div>
          <div class="numwrap"><span>Y</span><input type="number" step="1" :value="Math.round(conv.pxToPtY(one.y))" @change="setNum('y', $event)"><em class="u">pt</em></div>
          <div class="numwrap"><span>W</span><input type="number" step="1" :value="Math.round(conv.pxToPtW(one.w))" @change="setNum('w', $event)"><em class="u">pt</em></div>
          <div class="numwrap"><span>H</span><input type="number" step="1" :value="Math.round(conv.pxToPtH(one.h))" @change="setNum('h', $event)"><em class="u">pt</em></div>
        </div>
        <div class="inspRow">
          <button title="Bring to front" @click="zorder(one, 1)">Front</button>
          <button title="Send to back" @click="zorder(one, -1)">Back</button>
          <button title="Duplicate (⌘D)" @click="duplicate">Duplicate</button>
          <button title="Delete (Del)" @click="deleteSel">Delete</button>
        </div>
      </template>

      <template v-else>
        <div class="paneTitle">Inspector</div>
        <div class="selcount">{{ S.sel.length }} frames selected</div>
        <div class="align" style="margin-top:10px">
          <button v-for="a in ALIGN" :key="a.op" :title="a.title" @click="align(a.op)">{{ a.t }}</button>
        </div>
        <div class="inspRow">
          <button :disabled="S.sel.length < 3" title="Distribute horizontally" @click="align('dh')">Distribute →</button>
          <button :disabled="S.sel.length < 3" title="Distribute vertically" @click="align('dv')">Distribute ↓</button>
        </div>
        <div class="inspRow">
          <button @click="duplicate">Duplicate</button>
          <button @click="deleteSel">Delete</button>
        </div>
      </template>
    </section>

    <section id="layers">
      <div class="paneTitle">Frames <span class="mono">{{ curBoxes.length ? '· ' + curBoxes.length : '' }}</span></div>
      <div id="layerList">
        <div v-if="!curBoxes.length" class="empty">No frames yet.<br>Drag on the page to draw one.</div>
        <div v-for="b in layers" :key="b.id" class="layer"
          :class="{ sel: isSel(b.id), hidden: b.hidden }"
          @click="pick(b, $event)"
          @mouseenter="S.hover = b.id" @mouseleave="S.hover === b.id && (S.hover = null)">
          <button class="lbtn eye" :class="{ on: b.hidden }" title="Show/hide" @click.stop="toggleHidden(b)">{{ b.hidden ? '◌' : '◉' }}</button>
          <i :style="{ background: colorOf(b.cls) }"></i>
          <span class="nm"><b>{{ labelOf(b.cls) }}</b>{{ b.role ? ' ' + b.role : '' }}<small>{{ dims(b) }}</small></span>
          <button class="lbtn lock" :class="{ on: b.locked }" title="Lock" @click.stop="toggleLock(b)">{{ b.locked ? '🔒' : '🔓' }}</button>
          <button class="lbtn del" title="Delete" @click.stop="del(b)">✕</button>
        </div>
      </div>
    </section>
  </aside>
</template>
