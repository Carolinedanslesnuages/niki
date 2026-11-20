<script setup>
/** Un morceau d'une ligne du terminal : texte, entrée cliquable, lien, mot surligné, grille. */
defineProps({ m: { type: [String, Object], required: true } });
const emit = defineEmits(['ouvrir']);
const nom = (e) => e.libelle + (e.dossier ? '/' : '');
</script>

<template>
  <template v-if="typeof m === 'string'">{{ m }}</template>
  <span v-else-if="m.deco !== undefined" aria-hidden="true">{{ m.deco }}</span>
  <button v-else-if="m.entree" type="button" :class="['entree', { dossier: m.entree.dossier }]" @click="emit('ouvrir', m.entree)">{{ nom(m.entree) }}</button>
  <a v-else-if="m.lien" :href="m.lien.url" target="_blank" rel="noopener">{{ m.lien.libelle }}<span class="vh"> (nouvel onglet)</span></a>
  <mark v-else-if="m.marque !== undefined">{{ m.marque }}</mark>
  <code v-else-if="m.code !== undefined">{{ m.code }}</code>
  <ul v-else-if="m.grille" class="grille">
    <li v-for="g in m.grille" :key="g.entree.chemin"><button type="button" :class="['entree', { dossier: g.entree.dossier }]" @click="emit('ouvrir', g.entree)">{{ nom(g.entree) }}</button></li>
  </ul>
</template>
