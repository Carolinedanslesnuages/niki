import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { readFileSync, existsSync } from 'node:fs';

/** Page title, description and account, from the collected data (or from the config). */
function pageFromConfig() {
  const collected = existsSync('src/data/projects.json');
  const source = JSON.parse(readFileSync(collected ? 'src/data/projects.json' : 'site.config.json', 'utf8'));
  // Collected data has English keys; site.config.json keeps its public French keys.
  const page = collected
    ? { nickname: source.nickname, tagline: source.tagline, account: source.account }
    : { nickname: source.pseudo, tagline: source.accroche, account: source.compte };
  const escapeHtml = (text) => String(text || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  return {
    name: 'page-from-config',
    transformIndexHtml: (html) => html
      .replaceAll('%PSEUDO%', escapeHtml(page.nickname || page.account || 'Mon cyberdeck'))
      .replaceAll('%ACCROCHE%', escapeHtml(page.tagline))
      .replaceAll('%COMPTE%', escapeHtml(page.account)),
  };
}

// Project files form a large chunk loaded after the first paint: this is intended.
export default defineConfig({ plugins: [vue(), pageFromConfig()], build: { chunkSizeWarningLimit: 900 } });
