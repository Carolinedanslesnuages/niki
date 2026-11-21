<script setup>
/** The cyberdeck: terminal screen, cartridge bay (the projects), keys and stickers. */
import { ref, shallowRef, onMounted } from 'vue';
import Terminal from './components/Terminal.vue';
import { createTerminal } from './terminal/engine.js';
import siteData from './data/projects.json';

const terminal = shallowRef(null);
const terminalView = ref(null);
/** Palette names are shown to the visitor ("Coque : menthe"): they stay in French. */
const PALETTES = ['bonbon', 'menthe', 'peche'];
const PALETTE_STORAGE_KEY = `${(siteData.terminal && siteData.terminal.prompt) || 'niki'}-palette`;
const palette = ref(PALETTES.includes(siteData.palette) ? siteData.palette : 'bonbon');

try {
  const saved = localStorage.getItem(PALETTE_STORAGE_KEY);
  if (PALETTES.includes(saved)) palette.value = saved;
} catch {
  /* storage unavailable: default palette */
}

onMounted(async () => {
  // The files (several hundred KB) arrive after the first paint.
  const { default: files } = await import('./data/files.json');
  terminal.value = createTerminal({ files, data: siteData });
});

function changeColor(confirmColor) {
  palette.value = PALETTES[(PALETTES.indexOf(palette.value) + 1) % PALETTES.length];
  try {
    localStorage.setItem(PALETTE_STORAGE_KEY, palette.value);
  } catch {
    /* nothing to do */
  }
  confirmColor(palette.value);
}

const statusLabel = (project) => (project.status === 'trial' ? 'essai' : project.version || 'en cours');
const runOnTerminal = (command) => terminalView.value && terminalView.value.runCommand(command);
</script>

<template>
  <a class="skip-link" href="#command">Aller au terminal</a>
  <div class="page">
    <header class="site-header">
      <h1>{{ siteData.nickname }}<span aria-hidden="true">_</span></h1>
      <p>{{ siteData.tagline }}</p>
    </header>

    <main class="deck" :data-palette="palette">
      <span class="screw top-left"></span><span class="screw top-right"></span><span class="screw bottom-left"></span><span class="screw bottom-right"></span>
      <svg class="sticker cloud" width="92" height="56" viewBox="0 0 92 56" aria-hidden="true">
        <path d="M22 50 C6 50 4 30 18 28 C16 12 38 6 46 18 C52 6 76 8 74 26 C90 26 90 50 72 50 Z" fill="#fff7fc" stroke="#2b1d3f" stroke-width="3" stroke-linejoin="round" />
        <circle cx="38" cy="36" r="2.6" fill="#2b1d3f" /><circle cx="56" cy="36" r="2.6" fill="#2b1d3f" />
        <path d="M43 42 Q47 46 51 42" fill="none" stroke="#2b1d3f" stroke-width="2.4" stroke-linecap="round" />
        <circle cx="32" cy="41" r="3.4" fill="#ff9fd2" /><circle cx="62" cy="41" r="3.4" fill="#ff9fd2" />
      </svg>
      <svg class="sticker heart" width="40" height="38" viewBox="0 0 40 38" aria-hidden="true">
        <path d="M20 34 C4 22 2 12 8 7 C13 3 18 5 20 10 C22 5 27 3 32 7 C38 12 36 22 20 34 Z" fill="#ff6fbf" stroke="#2b1d3f" stroke-width="3" stroke-linejoin="round" />
      </svg>
      <span class="sticker words">{{ siteData.words.join(' · ') }}</span>

      <Terminal ref="terminalView" :terminal="terminal" @change-color="changeColor" />

      <nav class="keys" aria-label="Commandes rapides">
        <button class="key" type="button" @click="runOnTerminal('moi')">MOI</button>
        <button class="key" type="button" @click="runOnTerminal('projets')">PROJETS</button>
        <button class="key" type="button" @click="runOnTerminal('ls ~')">DOSSIERS</button>
        <button class="key" type="button" @click="terminalView.prepare('chercher ')">CHERCHER</button>
        <button class="key" type="button" @click="runOnTerminal('aide')">AIDE</button>
        <button class="key" type="button" @click="runOnTerminal('effacer')">EFFACER</button>
        <span class="spacer"></span>
        <span class="switch">Couleur
          <button class="key pink" type="button" aria-label="Changer la couleur du boîtier" @click="runOnTerminal('couleur')">◐</button>
        </span>
      </nav>

      <aside class="bay" aria-labelledby="bay-title">
        <h2 id="bay-title">Cartouches</h2>
        <p v-if="!siteData.projects.length && !siteData.upcoming.length" class="empty-message">Aucune cartouche pour l'instant. Ajoutez vos dépôts publics dans <code>site.config.json</code>, rubrique « projets ».</p>
        <ul v-else class="cartridge-list">
        <li v-for="project in siteData.projects" :key="project.folder"><button class="cartridge" type="button" @click="runOnTerminal(project.command)">
          <span class="slot" aria-hidden="true"></span>
          <span><b>{{ project.name }}</b><small>{{ project.tagline }}</small></span>
          <span :class="['status', { pending: project.status === 'in-progress' }]"><i aria-hidden="true"></i>{{ statusLabel(project) }}</span>
        </button></li>
        <li v-for="upcoming in siteData.upcoming" :key="upcoming.name" class="cartridge empty">
          <span class="slot" aria-hidden="true" style="opacity: 0.35"></span>
          <span><b>{{ upcoming.name }}</b><small>{{ upcoming.tagline }}</small></span>
          <span class="status pending"><i aria-hidden="true"></i>bientôt</span>
        </li>
        </ul>
      </aside>
    </main>

    <footer class="site-footer">
      <span>Projets open source · fichiers repris de GitHub chaque nuit.</span>
      <a :href="`https://github.com/${siteData.account}`">github.com/{{ siteData.account }}</a>
    </footer>
  </div>
</template>
