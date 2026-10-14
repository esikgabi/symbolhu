<script setup lang="ts">
import { computed } from "vue";
import { baseLabels, layout } from "../layout";

const props = defineProps<{ char: string }>();

interface Key { code: number; label?: string; w?: number }
const k = (code: number, label?: string, w = 1): Key => ({ code, label, w });
const rows: Key[][] = [
  [10, 18, 19, 20, 21, 23, 22, 26, 28, 25, 29, 27, 24].map((c) => k(c)).concat(k(51, "⌫", 1.6)),
  [k(48, "⇥", 1.5), ...[12, 13, 14, 15, 17, 16, 32, 34, 31, 35, 33, 30].map((c) => k(c)), k(-1, "", 1)],
  [k(57, "⇪", 1.8), ...[0, 1, 2, 3, 5, 4, 38, 40, 37, 41, 39, 42].map((c) => k(c)), k(36, "⏎", 1.4)],
  [k(56, "⇧", 1.3), ...[50, 6, 7, 8, 9, 11, 45, 46, 43, 47, 44].map((c) => k(c)), k(60, "⇧", 2.3)],
  [k(63, "fn"), k(59, "⌃"), k(58, "⌥", 1.2), k(55, "⌘", 1.4), k(49, "", 5), k(54, "⌘", 1.4), k(61, "⌥", 1.2)],
];

const combo = computed(() => layout[props.char]);
const lit = computed(() => {
  const c = combo.value;
  if (!c) return new Set<number>();
  const s = new Set([c.keyCode]);
  if (c.shift) s.add(56);
  if (c.option) s.add(58);
  return s;
});
const recipe = computed(() => {
  const c = combo.value;
  if (!c) return "";
  const keyName = baseLabels[c.keyCode] ?? `key ${c.keyCode}`;
  return [c.shift && "⇧ Shift", c.option && "⌥ Option", keyName].filter(Boolean).join(" + ");
});
</script>

<template>
  <div class="hint">
    <div v-if="combo" class="recipe">{{ recipe }}</div>
    <div v-else class="recipe">No key on the Hungarian layout produces “{{ char }}”</div>
    <div class="kb">
      <div v-for="(row, i) in rows" :key="i" class="row">
        <div
          v-for="(key, j) in row"
          :key="j"
          class="key"
          :class="{ lit: lit.has(key.code), ghost: key.code === -1 }"
          :style="{ flex: `${key.w} 1 0` }"
        >{{ key.label ?? baseLabels[key.code] }}</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.recipe { font-size: 1.6rem; font-weight: 600; margin-bottom: 0.8rem; }
.kb { display: flex; flex-direction: column; gap: 4px; width: 100%; max-width: 640px; margin: 0 auto; }
.row { display: flex; gap: 4px; }
.key {
  height: 42px; display: flex; align-items: center; justify-content: center;
  border: 1px solid #888; border-radius: 6px; background: #2a2a2e; color: #ddd; font-size: 0.9rem;
}
.key.ghost { visibility: hidden; }
.key.lit { background: #f5a623; color: #000; border-color: #f5a623; font-weight: 700; }
</style>
