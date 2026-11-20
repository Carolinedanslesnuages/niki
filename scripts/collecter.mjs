#!/usr/bin/env node
/**
 * Collecte, depuis GitHub, ce que le site affiche : pour chaque projet de site.config.json,
 * sa description, sa dernière version et ses fichiers (le texte des petits fichiers lisibles).
 *
 * Sécurité : seuls les dépôts PUBLICS sont collectés. Un dépôt privé, absent ou renommé arrête
 * la collecte avec un message clair : on ne publie jamais par erreur.
 *
 * Écrit src/donnees/projets.json et src/donnees/fichiers.json. GITHUB_TOKEN facultatif (quota).
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';

const API = 'https://api.github.com';
const BRUT = 'https://raw.githubusercontent.com';
const TEXTE = /\.(md|ya?ml|sh|ts|vue|js|mjs|cjs|css|html|txt|toml|json|csv)$|(^|\/)(LICENSE|Dockerfile)$/i;
const TAILLE_MAX = 40000;
const DOSSIERS_IGNORES = /(^|\/)(node_modules|dist)(\/|$)/;
/** Fichiers rédigés en anglais (RGAA 8.7 : le changement de langue est signalé). */
const EN_ANGLAIS = /(^|\/)LICEN[CS]E(\.md|\.txt)?$/i;

const entetes = { Accept: 'application/vnd.github+json', 'User-Agent': 'site-cyberdeck' };
if (process.env.GITHUB_TOKEN) entetes.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

async function api(chemin) {
  const r = await fetch(API + chemin, { headers: entetes });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`GitHub ${chemin} : ${r.status} ${await r.text()}`);
  return r.json();
}

/** Chemin gardé sur le site : pas de dossier d'outillage caché (sauf .github), pas de dépendances. */
export function garder(chemin) {
  if (DOSSIERS_IGNORES.test(chemin) || /(^|\/)package-lock\.json$/.test(chemin)) return false;
  const premier = chemin.split('/')[0];
  return !premier.startsWith('.') || premier === '.github';
}

async function collecterProjet(compte, p) {
  const depot = await api(`/repos/${compte}/${p.depot}`);
  if (!depot) throw new Error(`Dépôt introuvable : ${compte}/${p.depot}. Vérifiez son nom exact (majuscules comprises) dans site.config.json.`);
  if (depot.private || depot.visibility !== 'public') throw new Error(`${compte}/${p.depot} n'est pas public : il ne sera jamais publié sur le site.`);
  if (depot.name !== p.depot) throw new Error(`${compte}/${p.depot} a été renommé en « ${depot.name} » : mettez à jour site.config.json.`);
  const version = await api(`/repos/${compte}/${p.depot}/releases/latest`);
  const branche = depot.default_branch;
  const arbre = await api(`/repos/${compte}/${p.depot}/git/trees/${encodeURIComponent(branche)}?recursive=1`);
  const dossier = p.dossier || p.depot.toLowerCase();
  const fichiers = {};
  for (const e of arbre.tree) {
    if (!garder(e.path)) continue;
    const chemin = `projets/${dossier}/${e.path}`;
    if (e.type === 'tree') {
      fichiers[chemin] = { d: 1 };
      continue;
    }
    const f = { u: `${depot.html_url}/blob/${branche}/${e.path}` };
    if (EN_ANGLAIS.test(e.path)) f.l = 'en';
    if (TEXTE.test(e.path) && e.size <= TAILLE_MAX) {
      const r = await fetch(`${BRUT}/${compte}/${p.depot}/${branche}/${e.path.split('/').map(encodeURIComponent).join('/')}`);
      if (r.ok) f.c = await r.text();
    }
    fichiers[chemin] = f;
  }
  return {
    projet: {
      nom: p.nom || depot.name.charAt(0).toUpperCase() + depot.name.slice(1),
      commande: dossier.normalize('NFD').replace(/\p{Diacritic}/gu, ''),
      dossier,
      accroche: p.accroche || depot.description || '',
      description: depot.description || '',
      version: version ? version.tag_name : null,
      etat: p.etat || (version ? 'en-ligne' : 'en-cours'),
      url: depot.html_url,
    },
    fichiers,
  };
}

async function principal() {
  const config = JSON.parse(await readFile(new URL('../site.config.json', import.meta.url), 'utf8'));
  // Compte par défaut : le propriétaire du dépôt (GitHub Actions le fournit).
  config.compte = config.compte || process.env.GITHUB_REPOSITORY_OWNER || '';
  config.pseudo = config.pseudo || config.compte || 'mon-cyberdeck';
  config.terminal = { nom: 'niki-os', invite: 'niki', ...(config.terminal || {}) };
  config.projets = config.projets || [];
  config.bientot = config.bientot || [];
  if (config.projets.length && !config.compte) throw new Error('Indiquez votre compte GitHub dans « compte » de site.config.json.');
  const projets = [];
  const fichiers = {};
  for (const p of config.projets) {
    const r = await collecterProjet(config.compte, p);
    projets.push(r.projet);
    Object.assign(fichiers, r.fichiers);
    console.log(`${r.projet.nom} : ${Object.values(r.fichiers).filter((f) => !f.d).length} fichiers${r.projet.version ? `, ${r.projet.version}` : ''}`);
  }
  await mkdir(new URL('../src/donnees/', import.meta.url), { recursive: true });
  await writeFile(new URL('../src/donnees/projets.json', import.meta.url), JSON.stringify({ ...config, projets }, null, 2));
  await writeFile(new URL('../src/donnees/fichiers.json', import.meta.url), JSON.stringify(fichiers));
  console.log(`Collecte terminée : ${projets.length} projets.`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  principal().catch((e) => {
    console.error(`collecte : ${e.message}`);
    process.exit(1);
  });
}
