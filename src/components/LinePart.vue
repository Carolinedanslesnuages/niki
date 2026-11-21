<script setup>
/** One part of a terminal line: text, clickable entry, link, highlighted word, grid… */
defineProps({ part: { type: [String, Object], required: true } });
const emit = defineEmits(['open']);
const entryName = (entry) => entry.label + (entry.isFolder ? '/' : '');
</script>

<template>
  <template v-if="typeof part === 'string'">{{ part }}</template>
  <span v-else-if="part.decoration !== undefined" aria-hidden="true">{{ part.decoration }}</span>
  <button v-else-if="part.entry" type="button" :class="['entry', { folder: part.entry.isFolder }]" @click="emit('open', part.entry)">{{ entryName(part.entry) }}</button>
  <a v-else-if="part.link" :href="part.link.url" target="_blank" rel="noopener">{{ part.link.label }}<span class="visually-hidden"> (nouvel onglet)</span></a>
  <mark v-else-if="part.highlight !== undefined">{{ part.highlight }}</mark>
  <code v-else-if="part.code !== undefined">{{ part.code }}</code>
  <ul v-else-if="part.grid" class="grid">
    <li v-for="cell in part.grid" :key="cell.entry.path">
      <button type="button" :class="['entry', { folder: cell.entry.isFolder }]" @click="emit('open', cell.entry)">{{ entryName(cell.entry) }}</button>
    </li>
  </ul>
</template>
