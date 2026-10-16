<script setup lang="ts">
import { computed } from "vue";
import { weakness, type GameRecord, type StatsMap } from "../engine/rules";

const props = defineProps<{ stats: StatsMap; games: GameRecord[] }>();
defineEmits<{ back: [] }>();

const rows = computed(() =>
  Object.entries(props.stats)
    .map(([c, s]) => ({ c, ...s, miss: Math.round(weakness(s) * 100) }))
    .sort((a, b) => b.miss - a.miss),
);
const games = computed(() => [...props.games].reverse());
const fmt = (d: string) => new Date(d).toLocaleString([], { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
const mastered = (g: GameRecord) => g.rounds.reduce((n, r) => n + r.mastered.length, 0);
const pillClass = (g: GameRecord) => (mastered(g) === g.chars.length ? "ok" : mastered(g) ? "part" : "none");
</script>

<template>
  <section class="stats">
    <h2>Statistics</h2>
    <p v-if="!rows.length">No games played yet.</p>
    <table v-else class="tbl">
      <thead><tr><th>Char</th><th class="n">Asks</th><th class="n">Hits</th><th>Miss</th><th class="n">Mastered</th></tr></thead>
      <tbody>
        <tr v-for="r in rows" :key="r.c">
          <td><span class="key">{{ r.c }}</span></td>
          <td class="n">{{ r.asks }}</td>
          <td class="n">{{ r.hits }}</td>
          <td><span class="bar"><i :style="{ width: r.miss + '%' }" /></span>{{ r.miss }}%</td>
          <td class="n">{{ r.masteredCount }}</td>
        </tr>
      </tbody>
    </table>
    <template v-if="games.length">
      <h3>Games</h3>
      <table class="tbl">
        <thead><tr><th>Date</th><th>Chars</th><th class="n">Rounds</th><th class="n">Mastered</th></tr></thead>
        <tbody>
          <tr v-for="g in games" :key="g.date">
            <td class="date">{{ fmt(g.date) }}</td>
            <td><span v-for="c in g.chars" :key="c" class="key">{{ c }}</span></td>
            <td class="n">{{ g.rounds.length }}</td>
            <td class="n"><span class="pill" :class="pillClass(g)">{{ mastered(g) }}/{{ g.chars.length }}</span></td>
          </tr>
        </tbody>
      </table>
    </template>
    <button @click="$emit('back')">Back</button>
  </section>
</template>

<style scoped>
.stats { max-width: 34rem; margin: 0 auto; }
.date { white-space: nowrap; }
.bar { display: inline-block; width: 60px; height: 6px; border-radius: 3px; background: #3a3a3e; vertical-align: middle; margin-right: 0.4rem; overflow: hidden; }
.bar i { display: block; height: 100%; background: #f5a623; }
</style>
