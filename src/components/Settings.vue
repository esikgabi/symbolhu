<script setup lang="ts">
import { ref } from "vue";
import { defaultPool, layout } from "../layout";
import { sanitizeSettings, type Settings } from "../engine/settings";

const props = defineProps<{ settings: Settings }>();
const emit = defineEmits<{ save: [s: Settings]; cancel: [] }>();

const pool = ref(props.settings.pool.join(" "));
const gameSize = ref(props.settings.gameSize);
const timeoutSec = ref(props.settings.timeoutSec);
const hitsPerChar = ref(props.settings.hitsPerChar);
const maxRounds = ref(props.settings.maxRounds);

function save() {
  emit("save", sanitizeSettings(
    {
      pool: Array.from(pool.value.replace(/\s/g, "")),
      gameSize: gameSize.value,
      timeoutSec: timeoutSec.value,
      hitsPerChar: hitsPerChar.value,
      maxRounds: maxRounds.value,
    },
    (c) => c in layout,
    defaultPool(),
  ));
}
</script>

<template>
  <section class="settings">
    <h2>Settings</h2>
    <label>Characters to practise (pool)
      <textarea v-model="pool" rows="3" />
    </label>
    <button type="button" @click="pool = defaultPool().join(' ')">Reset pool to all layout symbols</button>
    <label>Characters per game <input v-model.number="gameSize" type="number" min="1" max="50" /></label>
    <label>Timeout (seconds) <input v-model.number="timeoutSec" type="number" min="0.5" max="60" step="0.5" /></label>
    <label>Hits per character per round <input v-model.number="hitsPerChar" type="number" min="1" max="20" /></label>
    <label>Max rounds <input v-model.number="maxRounds" type="number" min="1" max="100" /></label>
    <p class="muted">Invalid values and characters not on the Hungarian layout are replaced by defaults / dropped.</p>
    <div class="actions"><button @click="save">Save</button><button @click="emit('cancel')">Cancel</button></div>
  </section>
</template>

<style scoped>
.settings { display: flex; flex-direction: column; gap: 0.8rem; max-width: 480px; margin: 0 auto; }
label { display: flex; flex-direction: column; gap: 0.3rem; }
textarea { font-size: 1.3rem; letter-spacing: 0.2em; }
.muted { color: #999; font-size: 0.85rem; }
.actions { display: flex; gap: 0.6rem; }
</style>
