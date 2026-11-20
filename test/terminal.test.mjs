import { test } from 'node:test';
import assert from 'node:assert/strict';
import { creerTerminal } from '../src/terminal/moteur.js';
import { resoudre } from '../src/terminal/fichiers.js';
import { garder } from '../scripts/collecter.mjs';

const fichiers = {
  'projets/constance/README.md': { c: '# Constance\n\nGitleaks vérifié.\nLigne 4', u: 'https://github.com/x/constance/blob/main/README.md' },
  'projets/constance/titre-pr/verifier.sh': { c: 'echo titre', u: 'u' },
  'projets/constance/image.png': { u: 'https://github.com/x/constance/blob/main/image.png' },
  'projets/irene/AGENTS.md': { c: "Irène protège contre l'arnaque.", u: 'u' },
};
const donnees = {
  accroche: 'Bonjour.',
  presentation: ['carolinedanslesnuages', 'Curieuse.'],
  projets: [
    { nom: 'Constance', commande: 'constance', dossier: 'constance', accroche: 'Règles', description: 'Les mêmes règles', version: 'v1.0.0', etat: 'en-ligne', url: 'https://github.com/x/constance' },
    { nom: 'Irène', commande: 'irene', dossier: 'irene', accroche: 'Alerte', description: 'Extension', version: null, etat: 'essai', url: 'https://github.com/x/Irene' },
  ],
  bientot: [{ nom: 'Olympe', accroche: 'Skills' }],
};
const terminal = () => creerTerminal({ fichiers, donnees });
const texte = (r) => r.lignes.map((l) => l.morceaux.map((m) => (typeof m === 'string' ? m : JSON.stringify(m))).join('')).join('\n');

test('chemins : relatifs, .., ~, /', () => {
  assert.equal(resoudre('projets/a', '..'), 'projets');
  assert.equal(resoudre('projets/a', '~'), '');
  assert.equal(resoudre('projets/a', '/projets'), 'projets');
  assert.equal(resoudre('projets', 'a/b'), 'projets/a/b');
  assert.equal(resoudre('projets', ''), 'projets');
});

test('naviguer : cd, ls, pwd, invite', () => {
  const t = terminal();
  const r = t.executer('cd projets');
  assert.equal(t.invite(), '~/projets');
  assert.match(r.annonce, /2 éléments dans ~\/projets : constance \(dossier\), irene \(dossier\)/);
  t.executer('cd constance');
  assert.equal(t.executer('pwd').lignes[0].morceaux[0], '~/projets/constance');
  assert.match(t.executer('cd ..').annonce, /~\/projets/);
  assert.match(texte(t.executer('cd nulle-part')), /aucun dossier/);
  assert.match(texte(t.executer('cd ~/projets/constance/README.md')), /est un fichier/);
});

test('lire un fichier, un binaire, un dossier', () => {
  const t = terminal();
  const r = t.executer('cat projets/constance/README.md');
  assert.equal(r.instantane, true);
  assert.match(r.annonce, /Fichier ~\/projets\/constance\/README\.md affiché, 4 lignes/);
  assert.match(texte(r), /Gitleaks vérifié/);
  assert.match(texte(t.executer('cat projets/constance/image.png')), /binaire/);
  assert.match(texte(t.executer('cat projets')), /est un dossier/);
});

test('un fichier en anglais est marqué comme tel (RGAA 8.7)', () => {
  const t = creerTerminal({ fichiers: { ...fichiers, 'projets/constance/LICENSE': { c: 'MIT License\nPermission is hereby granted', l: 'en', u: 'u' } }, donnees });
  const r = t.executer('cat projets/constance/LICENSE');
  assert.ok(r.lignes.filter((l) => l.classe === 'fichier').every((l) => l.langue === 'en'));
  assert.ok(t.executer('cat projets/constance/README.md').lignes.filter((l) => l.classe === 'fichier').every((l) => l.langue === undefined));
});

test('chercher dans les noms et le contenu, sans accents, dans le dossier courant', () => {
  const t = terminal();
  const r = t.executer('chercher GITLEAKS');
  assert.match(r.annonce, /1 fichier\(s\)/);
  assert.ok(r.lignes.some((l) => l.morceaux.some((m) => m.marque === 'Gitleaks')));
  assert.match(t.executer('chercher arnaqué').annonce, /1 fichier/);
  t.executer('cd projets/irene');
  assert.match(texte(t.executer('chercher gitleaks')), /Rien trouvé .* dans ~\/projets\/irene/);
});

test('projets et commandes de chaque projet', () => {
  const t = terminal();
  const p = texte(t.executer('projets'));
  assert.match(p, /constance\s+v1\.0\.0/);
  assert.match(p, /irene\s+projet d'essai/);
  assert.match(p, /olympe\s+en préparation/);
  assert.match(texte(t.executer('irène')), /Extension/);
  assert.match(texte(t.executer('constance')), /github\.com\/x\/constance/);
});

test('effacer, couleur, inconnue, vide', () => {
  const t = terminal();
  assert.equal(t.executer('effacer').effacer, true);
  assert.equal(t.executer('couleur').couleur, true);
  assert.match(texte(t.executer('nimporte')), /Commande inconnue/);
  assert.equal(t.executer('   '), null);
});

test('complétion : commande, chemin unique, plusieurs propositions, rien', () => {
  const t = terminal();
  assert.deepEqual(t.completer('chE'), { valeur: 'chercher ' });
  assert.deepEqual(t.completer('cd pro'), { valeur: 'cd projets/' });
  assert.match(t.completer('cd projets/').annonce, /2 possibilités/);
  assert.equal(t.completer('cd zzz'), null);
  assert.match(t.completer('cd projets/constance/').annonce, /3 possibilités/);
  assert.equal(t.completer('xyz'), null);
});

test('les annonces restent courtes', () => {
  const t = terminal();
  for (const cmd of ['aide', 'projets', 'tree', 'cat projets/constance/README.md', 'chercher e']) assert.ok(t.executer(cmd).annonce.length <= 400, cmd);
});

test('collecte : dossiers cachés et dépendances écartés', () => {
  assert.equal(garder('src/a.ts'), true);
  assert.equal(garder('.github/workflows/ci.yml'), true);
  assert.equal(garder('.claude/skills/x/SKILL.md'), false);
  assert.equal(garder('.agents/x'), false);
  assert.equal(garder('node_modules/x/index.js'), false);
  assert.equal(garder('a/dist/b.js'), false);
  assert.equal(garder('package-lock.json'), false);
});

test('nom du terminal et invite configurables', () => {
  const t = creerTerminal({ fichiers: {}, donnees: { ...donnees, projets: [], terminal: { nom: 'deck-os', invite: 'deck' } } });
  assert.equal(t.nomTerminal, 'deck-os');
  assert.match(t.executer('pwd').echo.morceaux[0], /^deck:~\$ pwd$/);
  assert.match(t.demarrage[0].morceaux[0], /^DECK-OS/);
});

test('sans aucun projet, le terminal fonctionne', () => {
  const t = creerTerminal({ fichiers: {}, donnees: { presentation: ['Bonjour'], projets: [] } });
  assert.match(t.executer('ls').annonce, /2 éléments dans ~ : lisez-moi\.txt, moi\.txt/);
  assert.match(t.executer('projets').lignes[0].morceaux[0], /Cartouches installées/);
  assert.equal(t.nomTerminal, 'niki-os');
});
