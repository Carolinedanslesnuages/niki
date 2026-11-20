import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { readFileSync, existsSync } from 'node:fs';

/** Titre, description et compte de la page, depuis les données collectées (ou la config). */
function pageDepuisConfig() {
  const fichier = existsSync('src/donnees/projets.json') ? 'src/donnees/projets.json' : 'site.config.json';
  const c = JSON.parse(readFileSync(fichier, 'utf8'));
  const echapper = (t) => String(t || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  return {
    name: 'page-depuis-config',
    transformIndexHtml: (html) =>
      html.replaceAll('%PSEUDO%', echapper(c.pseudo || c.compte || 'Mon cyberdeck')).replaceAll('%ACCROCHE%', echapper(c.accroche)).replaceAll('%COMPTE%', echapper(c.compte)),
  };
}

// Les fichiers des projets forment un gros morceau chargé après le premier affichage : c'est voulu.
export default defineConfig({ plugins: [vue(), pageDepuisConfig()], build: { chunkSizeWarningLimit: 900 } });
