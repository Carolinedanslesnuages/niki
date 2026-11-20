<script setup>
/**
 * L'écran du terminal. Accessibilité : l'écran n'est PAS une zone annoncée (un « cat » de 200
 * lignes serait lu en entier) ; une annonce courte passe par une zone de statut séparée. L'écran
 * reste lisible à son rythme (focusable). Tab ne complète que si c'est possible : jamais de piège.
 */
import { ref, nextTick, watch } from 'vue';
import Morceau from './Morceau.vue';

const props = defineProps({ terminal: { type: Object, default: null } });
const emit = defineEmits(['couleur']);

const lignes = ref([]);
const saisie = ref('');
const annonce = ref('');
const invite = ref('~');
const ecran = ref(null);
const champ = ref(null);
const historique = [];
let position = 0;
let file = Promise.resolve();
let numero = 0;
const lent = typeof window !== 'undefined' && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const pause = (ms) => new Promise((r) => setTimeout(r, lent ? ms : 0));

function annoncer(message) {
  annonce.value = '';
  setTimeout(() => (annonce.value = message), 60);
}

function afficher(nouvelles, delai = 35) {
  file = file.then(async () => {
    for (const l of nouvelles) {
      lignes.value.push({ ...l, id: numero++ });
      await nextTick();
      if (ecran.value) ecran.value.scrollTop = ecran.value.scrollHeight;
      if (delai) await pause(delai);
    }
  });
  return file;
}

function lancer(commande) {
  if (!props.terminal) return;
  const r = props.terminal.executer(commande);
  if (!r) return;
  if (r.effacer) lignes.value = [];
  else afficher([r.echo], 0);
  if (r.couleur) emit('couleur', (nom) => afficher([{ classe: 'ok', morceaux: [`Coque : ${nom}.`] }], 0) && annoncer(`Coque : ${nom}.`));
  afficher(r.lignes, r.instantane ? 0 : 35);
  invite.value = props.terminal.invite();
  if (!r.couleur) annoncer(r.annonce);
}

function preparer(prefixe) {
  saisie.value = prefixe;
  champ.value && champ.value.focus();
}

function ouvrir(e) {
  lancer(e.dossier ? `cd ~/${e.chemin}` : `cat ~/${e.chemin}`);
}

function envoyer() {
  const valeur = saisie.value;
  if (valeur.trim()) {
    historique.push(valeur);
    position = historique.length;
  }
  saisie.value = '';
  lancer(valeur);
}

function touche(e) {
  if (e.key === 'Tab' && !e.shiftKey && saisie.value.trim() && props.terminal) {
    const r = props.terminal.completer(saisie.value);
    if (!r) return; // rien à compléter : Tab passe à l'élément suivant
    e.preventDefault();
    if (r.valeur) saisie.value = r.valeur;
    if (r.propositions) {
      afficher([r.propositions], 0);
      annoncer(r.annonce);
    }
  } else if (e.key === 'ArrowUp' && position > 0) {
    position--;
    saisie.value = historique[position];
    e.preventDefault();
  } else if (e.key === 'ArrowDown') {
    position = Math.min(historique.length, position + 1);
    saisie.value = historique[position] || '';
    e.preventDefault();
  }
}

watch(
  () => props.terminal,
  (t) => {
    if (!t) return;
    lignes.value = [];
    afficher(t.demarrage, 140).then(() => annoncer('Terminal prêt. Tapez une commande, ou utilisez les touches et les cartouches.'));
  },
  { immediate: true },
);

const heure = ref('--:--');
const majHeure = () => (heure.value = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }));
majHeure();
setInterval(majHeure, 20000);

defineExpose({ lancer, preparer });
</script>

<template>
  <section class="ecran-cadre" aria-labelledby="titre-terminal">
    <h2 id="titre-terminal" class="vh">Terminal</h2>
    <div class="ecran-barre">
      <span><span class="led" aria-hidden="true"></span>{{ terminal ? terminal.nomTerminal : '…' }}</span>
      <span aria-hidden="true">{{ heure }}</span>
    </div>
    <div ref="ecran" class="ecran" tabindex="0" role="region" aria-label="Écran du terminal">
      <div class="sortie">
        <p v-if="!terminal" class="chargement">Chargement des dossiers…</p>
        <div v-for="l in lignes" :key="l.id" :class="['ligne', l.classe]" :lang="l.langue"><Morceau v-for="(m, i) in l.morceaux" :key="i" :m="m" @ouvrir="ouvrir" /></div>
      </div>
    </div>
    <p class="vh" role="status" aria-live="polite">{{ annonce }}</p>
    <div class="balayage" aria-hidden="true"></div>
    <form class="saisie" autocomplete="off" @submit.prevent="envoyer">
      <label for="commande"><span class="vh">Commande, dossier {{ invite }}</span><span aria-hidden="true">{{ terminal ? terminal.prefixe : '' }}:{{ invite }}$</span></label>
      <input id="commande" ref="champ" v-model="saisie" name="commande" spellcheck="false" placeholder="tapez « aide »" aria-describedby="aide-saisie" @keydown="touche">
    </form>
    <p id="aide-saisie" class="vh">Tapez une commande puis Entrée. Exemples : aide, ls, cd projets, cat moi.txt, chercher gitleaks. Tab complète un nom quand c'est possible.</p>
  </section>
</template>
