<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from "vue";
import { GameSession } from "../engine/session";
import { pickGameChars, recordResults, type GameRecord, type StatsMap } from "../engine/rules";
import type { Settings } from "../engine/settings";
import { keyOutcome, looksNonHungarian } from "../input/match";
import KeyboardHint from "./KeyboardHint.vue";

const props = defineProps<{ settings: Settings; stats: StatsMap }>();
const emit = defineEmits<{ finished: [game: GameRecord, stats: StatsMap]; quit: []; partial: [stats: StatsMap] }>();

const chars = pickGameChars(props.settings.pool, props.stats, props.settings.gameSize);
const s = reactive(new GameSession(props.settings, chars));
const phase = ref<"ask" | "hint" | "over">("ask");
const hintChar = ref("");
const label = ref("");
const barKey = ref(0);
const wrongLayout = ref(false);
const pill = computed(() => (s.mastered.length === chars.length ? "ok" : s.mastered.length ? "part" : "none"));
let timer: number | undefined;

function startAsk() {
  clearTimeout(timer);
  barKey.value++;
  timer = window.setTimeout(() => answer(false), props.settings.timeoutSec * 1000);
}

function next() {
  if (s.over) {
    phase.value = "over";
    emit("finished", { date: new Date().toISOString(), chars, rounds: [...s.rounds] }, recordResults(props.stats, s.allAsks, s.mastered));
  } else {
    phase.value = "ask";
    startAsk();
  }
}

function answer(hit: boolean) {
  clearTimeout(timer);
  const c = s.current!;
  label.value = `Round ${s.round}/${props.settings.maxRounds} · ask ${s.asks.length + 1}/${s.queue.length}`;
  s.answer(hit);
  if (hit) return next();
  hintChar.value = c;
  phase.value = "hint";
}

function quit() {
  if (s.allAsks.length > 0) emit("partial", recordResults(props.stats, s.allAsks, []));
  emit("quit");
}

function onKey(e: KeyboardEvent) {
  if (phase.value === "over") return;
  if (phase.value === "hint" && e.key === "Escape") {
    e.preventDefault();
    next();
    return;
  }
  if (looksNonHungarian(e)) wrongLayout.value = true;
  const target = phase.value === "hint" ? hintChar.value : s.current!;
  const o = keyOutcome(e, target);
  if (o === "ignore") return;
  e.preventDefault();
  if (phase.value === "hint") {
    if (o === "hit") next();
  } else answer(o === "hit");
}

onMounted(() => {
  window.addEventListener("keydown", onKey);
  if (s.over) phase.value = "over";
  else startAsk();
});
onBeforeUnmount(() => {
  window.removeEventListener("keydown", onKey);
  clearTimeout(timer);
});
</script>

<template>
  <section class="practice">
    <p v-if="wrongLayout" class="warn">
      Y/Z look swapped the US way. Is the Hungarian input source active? (menu bar → input source → Hungarian)
    </p>

    <template v-if="phase !== 'over'">
      <div class="meta">{{ phase === "hint" ? label : `Round ${s.round}/${settings.maxRounds} · ask ${s.asks.length + 1}/${s.queue.length}` }}</div>
      <svg class="char" viewBox="0 0 100 100" role="img" :aria-label="phase === 'hint' ? hintChar : s.current">
        <rect x="2" y="2" width="96" height="96" rx="14" />
        <text x="50" y="68" text-anchor="middle">{{ phase === "hint" ? hintChar : s.current }}</text>
      </svg>
      <div v-if="phase === 'ask'" class="bar"><div :key="barKey" class="fill" :style="{ animationDuration: settings.timeoutSec + 's' }" /></div>
      <template v-else>
        <KeyboardHint :char="hintChar" />
        <p class="muted">Now press it to continue (Esc to skip)</p>
      </template>
    </template>

    <div v-else class="done">
      <h2>Game finished <span class="pill" :class="pill">{{ s.mastered.length }}/{{ chars.length }} mastered</span></h2>
      <table class="tbl">
        <thead><tr><th>Round</th><th>Asked</th><th class="n">Mastered</th></tr></thead>
        <tbody>
          <tr v-for="(r, i) in s.rounds" :key="i">
            <td>{{ i + 1 }}</td>
            <td><span v-for="c in r.asked" :key="c" class="key" :class="r.mastered.includes(c) ? 'ok' : 'no'">{{ c }}</span></td>
            <td class="n">{{ r.mastered.length }}/{{ r.asked.length }}</td>
          </tr>
        </tbody>
      </table>
      <p v-if="s.active.length" class="muted">Still weak: <span v-for="c in s.active" :key="c" class="key no">{{ c }}</span></p>
    </div>

    <button @click="phase === 'over' ? emit('quit') : quit()">{{ phase === "over" ? "Back" : "Quit game" }}</button>
  </section>
</template>

<style scoped>
.practice { text-align: center; }
.char { display: block; width: 110px; margin: 0.5rem auto; }
.char rect { fill: #2c2c30; stroke: #555; stroke-width: 2; }
.char text { fill: #eee; font: 700 64px ui-monospace, "SF Mono", Menlo, monospace; }
.meta, .muted { color: #999; }
.warn { background: #5a3b00; padding: 0.6rem; border-radius: 6px; }
.bar { height: 8px; background: #333; border-radius: 4px; overflow: hidden; margin: 1rem auto 2rem; max-width: 400px; }
.fill { height: 100%; background: #f5a623; transform-origin: left; animation: shrink linear forwards; }
@keyframes shrink { from { transform: scaleX(1); } to { transform: scaleX(0); } }
.done { max-width: 34rem; margin: 0 auto; text-align: left; }
.done h2 { text-align: center; }
.done .pill { margin-left: 0.5rem; vertical-align: middle; }
</style>
