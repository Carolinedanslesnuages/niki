<script setup>
/**
 * The terminal screen. Accessibility: the screen is NOT a live region (a 200-line "cat" would be
 * read out entirely); a short announcement goes through a separate status region. The screen can
 * be read at one's own pace (focusable). Tab only completes when possible: never a keyboard trap.
 */
import { ref, nextTick, watch } from 'vue';
import LinePart from './LinePart.vue';

const props = defineProps({ terminal: { type: Object, default: null } });
const emit = defineEmits(['change-color']);

const lines = ref([]);
const input = ref('');
const announcement = ref('');
const prompt = ref('~');
const screen = ref(null);
const field = ref(null);
const history = [];
let historyPosition = 0;
let displayQueue = Promise.resolve();
let nextLineId = 0;
const animated = typeof window !== 'undefined' && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, animated ? milliseconds : 0));

function announce(message) {
  announcement.value = '';
  setTimeout(() => (announcement.value = message), 60);
}

function display(newLines, delayMs = 35) {
  displayQueue = displayQueue.then(async () => {
    for (const line of newLines) {
      lines.value.push({ ...line, lineId: nextLineId++ });
      await nextTick();
      if (screen.value) screen.value.scrollTop = screen.value.scrollHeight;
      if (delayMs) await wait(delayMs);
    }
  });
  return displayQueue;
}

function runCommand(command) {
  if (!props.terminal) return;
  const result = props.terminal.execute(command);
  if (!result) return;
  if (result.clearScreen) lines.value = [];
  else display([result.echo], 0);
  if (result.changeColor) {
    emit('change-color', (paletteName) => display([{ style: 'success', parts: [`Coque : ${paletteName}.`] }], 0) && announce(`Coque : ${paletteName}.`));
  }
  display(result.lines, result.instant ? 0 : 35);
  prompt.value = props.terminal.prompt();
  if (!result.changeColor) announce(result.announcement);
}

function prepare(prefix) {
  input.value = prefix;
  if (field.value) field.value.focus();
}

function openEntry(entry) {
  runCommand(entry.isFolder ? `cd ~/${entry.path}` : `cat ~/${entry.path}`);
}

function submit() {
  const value = input.value;
  if (value.trim()) {
    history.push(value);
    historyPosition = history.length;
  }
  input.value = '';
  runCommand(value);
}

function onKeydown(event) {
  if (event.key === 'Tab' && !event.shiftKey && input.value.trim() && props.terminal) {
    const completion = props.terminal.complete(input.value);
    if (!completion) return; // nothing to complete: Tab moves to the next element
    event.preventDefault();
    if (completion.value) input.value = completion.value;
    if (completion.suggestions) {
      display([completion.suggestions], 0);
      announce(completion.announcement);
    }
  } else if (event.key === 'ArrowUp' && historyPosition > 0) {
    historyPosition--;
    input.value = history[historyPosition];
    event.preventDefault();
  } else if (event.key === 'ArrowDown') {
    historyPosition = Math.min(history.length, historyPosition + 1);
    input.value = history[historyPosition] || '';
    event.preventDefault();
  }
}

watch(
  () => props.terminal,
  (terminal) => {
    if (!terminal) return;
    lines.value = [];
    display(terminal.bootLines, 140).then(() => announce('Terminal prêt. Tapez une commande, ou utilisez les touches et les cartouches.'));
  },
  { immediate: true },
);

const clock = ref('--:--');
const updateClock = () => (clock.value = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }));
updateClock();
setInterval(updateClock, 20000);

defineExpose({ runCommand, prepare });
</script>

<template>
  <section class="screen-frame" aria-labelledby="terminal-title">
    <h2 id="terminal-title" class="visually-hidden">Terminal</h2>
    <div class="screen-bar">
      <span><span class="status-light" aria-hidden="true"></span>{{ terminal ? terminal.terminalName : '…' }}</span>
      <span aria-hidden="true">{{ clock }}</span>
    </div>
    <div ref="screen" class="screen" tabindex="0" role="region" aria-label="Écran du terminal">
      <div class="output">
        <p v-if="!terminal" class="loading">Chargement des dossiers…</p>
        <div v-for="line in lines" :key="line.lineId" :class="['line', line.style]" :lang="line.lang"><LinePart v-for="(part, index) in line.parts" :key="index" :part="part" @open="openEntry" /></div>
      </div>
    </div>
    <p class="visually-hidden" role="status" aria-live="polite">{{ announcement }}</p>
    <div class="scanlines" aria-hidden="true"></div>
    <form class="command-line" autocomplete="off" @submit.prevent="submit">
      <label for="command"><span class="visually-hidden">Commande, dossier {{ prompt }}</span><span aria-hidden="true">{{ terminal ? terminal.promptPrefix : '' }}:{{ prompt }}$</span></label>
      <input id="command" ref="field" v-model="input" name="commande" spellcheck="false" placeholder="tapez « aide »" aria-describedby="command-help" @keydown="onKeydown">
    </form>
    <p id="command-help" class="visually-hidden">Tapez une commande puis Entrée. Exemples : aide, ls, cd projets, cat moi.txt, chercher gitleaks. Tab complète un nom quand c'est possible.</p>
  </section>
</template>
