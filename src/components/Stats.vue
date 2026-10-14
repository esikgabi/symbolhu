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
</script>

<template>
  <section class="stats">
    <h2>Statistics</h2>
    <p v-if="!rows.length">No games played yet.</p>
    <table v-else>
      <thead><tr><th>Char</th><th>Asks</th><th>Hits</th><th>Recent miss %</th><th>Times mastered</th></tr></thead>
      <tbody>
        <tr v-for="r in rows" :key="r.c">
          <td class="c">{{ r.c }}</td><td>{{ r.asks }}</td><td>{{ r.hits }}</td><td>{{ r.miss }}</td><td>{{ r.masteredCount }}</td>
        </tr>
      </tbody>
    </table>
    <h3>Games</h3>
    <ul>
      <li v-for="g in games" :key="g.date">
        {{ new Date(g.date).toLocaleString() }} · {{ g.chars.join(" ") }} · {{ g.rounds.length }} rounds ·
        mastered {{ g.rounds.reduce((n, r) => n + r.mastered.length, 0) }}/{{ g.chars.length }}
      </li>
    </ul>
    <button @click="$emit('back')">Back</button>
  </section>
</template>

<style scoped>
table { border-collapse: collapse; margin: 0 auto 1rem; }
th, td { padding: 0.3rem 0.9rem; text-align: center; border-bottom: 1px solid #444; }
.c { font-size: 1.4rem; font-weight: 700; }
ul { list-style: none; padding: 0; }
</style>
