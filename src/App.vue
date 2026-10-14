<script setup lang="ts">
import { onMounted, ref } from "vue";
import Practice from "./components/Practice.vue";
import Settings from "./components/Settings.vue";
import Stats from "./components/Stats.vue";
import { loadData, saveData, type Data } from "./store";
import type { GameRecord, StatsMap } from "./engine/rules";
import type { Settings as SettingsT } from "./engine/settings";

const data = ref<Data>();
const screen = ref<"menu" | "practice" | "settings" | "stats">("menu");
const gameId = ref(0);

onMounted(async () => (data.value = await loadData()));

function start() {
  gameId.value++;
  screen.value = "practice";
}
async function onFinished(game: GameRecord, stats: StatsMap) {
  data.value = { ...data.value!, stats, games: [...data.value!.games, game] };
  saveData(data.value).catch((e) => console.error("save failed", e));
}
async function onPartial(stats: StatsMap) {
  data.value = { ...data.value!, stats };
  saveData(data.value).catch((e) => console.error("save failed", e));
}
async function onSaveSettings(settings: SettingsT) {
  data.value = { ...data.value!, settings };
  saveData(data.value).catch((e) => console.error("save failed", e));
  screen.value = "menu";
}
</script>

<template>
  <main v-if="data">
    <div v-if="screen === 'menu'" class="menu">
      <h1>symbolhu</h1>
      <p>Practise Hungarian-layout symbols on a Mac keyboard.</p>
      <button class="primary" @click="start">Start game</button>
      <button @click="screen = 'stats'">Statistics</button>
      <button @click="screen = 'settings'">Settings</button>
    </div>
    <Practice v-else-if="screen === 'practice'" :key="gameId" :settings="data.settings" :stats="data.stats" @finished="onFinished" @partial="onPartial" @quit="screen = 'menu'" />
    <Settings v-else-if="screen === 'settings'" :settings="data.settings" @save="onSaveSettings" @cancel="screen = 'menu'" />
    <Stats v-else :stats="data.stats" :games="data.games" @back="screen = 'menu'" />
  </main>
</template>

<style>
:root { color-scheme: dark; font-family: -apple-system, system-ui, sans-serif; background: #1c1c1e; color: #eee; }
body { margin: 0; }
main { padding: 1.5rem; min-height: 100vh; box-sizing: border-box; }
button { font: inherit; padding: 0.5rem 1.1rem; border-radius: 8px; border: 1px solid #666; background: #333; color: #eee; cursor: pointer; }
button.primary { background: #f5a623; color: #000; border-color: #f5a623; font-weight: 700; }
input, textarea { font: inherit; padding: 0.4rem; border-radius: 6px; border: 1px solid #666; background: #2a2a2e; color: #eee; }
.menu { display: flex; flex-direction: column; align-items: center; gap: 0.8rem; margin-top: 12vh; }
</style>
