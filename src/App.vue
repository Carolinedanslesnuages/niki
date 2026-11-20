<script setup>
/** Le cyberdeck : écran-terminal, baie de cartouches (les projets), touches et autocollants. */
import { ref, shallowRef, onMounted } from 'vue';
import Terminal from './composants/Terminal.vue';
import { creerTerminal } from './terminal/moteur.js';
import donnees from './donnees/projets.json';

const terminal = shallowRef(null);
const vue = ref(null);
const palettes = ['bonbon', 'menthe', 'peche'];
const palette = ref(palettes.includes(donnees.palette) ? donnees.palette : 'bonbon');
const cle = `${(donnees.terminal && donnees.terminal.invite) || 'niki'}-palette`;

try {
  const p = localStorage.getItem(cle);
  if (palettes.includes(p)) palette.value = p;
} catch {
  /* stockage indisponible : palette par défaut */
}

onMounted(async () => {
  // Les fichiers (plusieurs centaines de Ko) arrivent après le premier affichage.
  const { default: fichiers } = await import('./donnees/fichiers.json');
  terminal.value = creerTerminal({ fichiers, donnees });
});

function changerCouleur(confirmer) {
  palette.value = palettes[(palettes.indexOf(palette.value) + 1) % palettes.length];
  try {
    localStorage.setItem(cle, palette.value);
  } catch {
    /* rien à faire */
  }
  confirmer(palette.value);
}

const etat = (p) => (p.etat === 'essai' ? 'essai' : p.version || 'en cours');
</script>

<template>
  <a class="evitement" href="#commande">Aller au terminal</a>
  <div class="page">
    <header class="entete">
      <h1>{{ donnees.pseudo }}<span aria-hidden="true">_</span></h1>
      <p>{{ donnees.accroche }}</p>
    </header>

    <main class="deck" :data-palette="palette">
      <span class="vis hg"></span><span class="vis hd"></span><span class="vis bg"></span><span class="vis bd"></span>
      <svg class="sticker nuage" width="92" height="56" viewBox="0 0 92 56" aria-hidden="true">
        <path d="M22 50 C6 50 4 30 18 28 C16 12 38 6 46 18 C52 6 76 8 74 26 C90 26 90 50 72 50 Z" fill="#fff7fc" stroke="#2b1d3f" stroke-width="3" stroke-linejoin="round" />
        <circle cx="38" cy="36" r="2.6" fill="#2b1d3f" /><circle cx="56" cy="36" r="2.6" fill="#2b1d3f" />
        <path d="M43 42 Q47 46 51 42" fill="none" stroke="#2b1d3f" stroke-width="2.4" stroke-linecap="round" />
        <circle cx="32" cy="41" r="3.4" fill="#ff9fd2" /><circle cx="62" cy="41" r="3.4" fill="#ff9fd2" />
      </svg>
      <svg class="sticker coeur" width="40" height="38" viewBox="0 0 40 38" aria-hidden="true">
        <path d="M20 34 C4 22 2 12 8 7 C13 3 18 5 20 10 C22 5 27 3 32 7 C38 12 36 22 20 34 Z" fill="#ff6fbf" stroke="#2b1d3f" stroke-width="3" stroke-linejoin="round" />
      </svg>
      <span class="sticker mots">{{ donnees.mots.join(' · ') }}</span>

      <Terminal ref="vue" :terminal="terminal" @couleur="changerCouleur" />

      <nav class="touches" aria-label="Commandes rapides">
        <button class="touche" type="button" @click="vue.lancer('moi')">MOI</button>
        <button class="touche" type="button" @click="vue.lancer('projets')">PROJETS</button>
        <button class="touche" type="button" @click="vue.lancer('ls ~')">DOSSIERS</button>
        <button class="touche" type="button" @click="vue.preparer('chercher ')">CHERCHER</button>
        <button class="touche" type="button" @click="vue.lancer('aide')">AIDE</button>
        <button class="touche" type="button" @click="vue.lancer('effacer')">EFFACER</button>
        <span class="espace"></span>
        <span class="interrupteur">Couleur
          <button class="touche rose" type="button" aria-label="Changer la couleur du boîtier" @click="vue.lancer('couleur')">◐</button>
        </span>
      </nav>

      <aside class="baie" aria-labelledby="titre-baie">
        <h2 id="titre-baie">Cartouches</h2>
        <p v-if="!donnees.projets.length && !donnees.bientot.length" class="vide-message">Aucune cartouche pour l'instant. Ajoutez vos dépôts publics dans <code>site.config.json</code>, rubrique « projets ».</p>
        <ul v-else class="liste-cartouches">
        <li v-for="p in donnees.projets" :key="p.dossier"><button class="cartouche" type="button" @click="vue && vue.lancer(p.commande)">
          <span class="fente" aria-hidden="true"></span>
          <span><b>{{ p.nom }}</b><small>{{ p.accroche }}</small></span>
          <span :class="['etat', { prep: p.etat === 'en-cours' }]"><i aria-hidden="true"></i>{{ etat(p) }}</span>
        </button></li>
        <li v-for="b in donnees.bientot" :key="b.nom" class="cartouche vide">
          <span class="fente" aria-hidden="true" style="opacity: 0.35"></span>
          <span><b>{{ b.nom }}</b><small>{{ b.accroche }}</small></span>
          <span class="etat prep"><i aria-hidden="true"></i>bientôt</span>
        </li>
        </ul>
      </aside>
    </main>

    <footer class="pied">
      <span>Projets open source · fichiers repris de GitHub chaque nuit.</span>
      <a :href="`https://github.com/${donnees.compte}`">github.com/{{ donnees.compte }}</a>
    </footer>
  </div>
</template>
