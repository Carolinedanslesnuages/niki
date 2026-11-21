import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTerminal } from '../src/terminal/engine.js';
import { resolvePath } from '../src/terminal/filesystem.js';
import { keepPath } from '../scripts/collect.mjs';

const FILES = {
  'projets/constance/README.md': { content: '# Constance\n\nGitleaks vérifié.\nLigne 4', url: 'https://github.com/x/constance/blob/main/README.md' },
  'projets/constance/titre-pr/check.sh': { content: 'echo titre', url: 'u' },
  'projets/constance/image.png': { url: 'https://github.com/x/constance/blob/main/image.png' },
  'projets/irene/AGENTS.md': { content: "Irène protège contre l'arnaque.", url: 'u' },
};
const SITE_DATA = {
  tagline: 'Bonjour.',
  presentation: ['carolinedanslesnuages', 'Curieuse.'],
  projects: [
    {
      name: 'Constance', command: 'constance', folder: 'constance', tagline: 'Règles', description: 'Les mêmes règles', version: 'v1.0.0', status: 'released', url: 'https://github.com/x/constance',
    },
    {
      name: 'Irène', command: 'irene', folder: 'irene', tagline: 'Alerte', description: 'Extension', version: null, status: 'trial', url: 'https://github.com/x/Irene',
    },
  ],
  upcoming: [{ name: 'Olympe', tagline: 'Skills' }],
};
const newTerminal = () => createTerminal({ files: FILES, data: SITE_DATA });
const screenText = (result) => result.lines.map((line) => line.parts.map((part) => (typeof part === 'string' ? part : JSON.stringify(part))).join('')).join('\n');

test('chemins : relatifs, .., ~, /', () => {
  assert.equal(resolvePath('projets/a', '..'), 'projets');
  assert.equal(resolvePath('projets/a', '~'), '');
  assert.equal(resolvePath('projets/a', '/projets'), 'projets');
  assert.equal(resolvePath('projets', 'a/b'), 'projets/a/b');
  assert.equal(resolvePath('projets', ''), 'projets');
});

test('naviguer : cd, ls, pwd, invite', () => {
  const terminal = newTerminal();
  const result = terminal.execute('cd projets');
  assert.equal(terminal.prompt(), '~/projets');
  assert.match(result.announcement, /2 éléments dans ~\/projets : constance \(dossier\), irene \(dossier\)/);
  terminal.execute('cd constance');
  assert.equal(terminal.execute('pwd').lines[0].parts[0], '~/projets/constance');
  assert.match(terminal.execute('cd ..').announcement, /~\/projets/);
  assert.match(screenText(terminal.execute('cd nulle-part')), /aucun dossier/);
  assert.match(screenText(terminal.execute('cd ~/projets/constance/README.md')), /est un fichier/);
});

test('lire un fichier, un binaire, un dossier', () => {
  const terminal = newTerminal();
  const result = terminal.execute('cat projets/constance/README.md');
  assert.equal(result.instant, true);
  assert.match(result.announcement, /Fichier ~\/projets\/constance\/README\.md affiché, 4 lignes/);
  assert.match(screenText(result), /Gitleaks vérifié/);
  assert.match(screenText(terminal.execute('cat projets/constance/image.png')), /binaire/);
  assert.match(screenText(terminal.execute('cat projets')), /est un dossier/);
});

test('un fichier en anglais est marqué comme tel (RGAA 8.7)', () => {
  const files = { ...FILES, 'projets/constance/LICENSE': { content: 'MIT License\nPermission is hereby granted', lang: 'en', url: 'u' } };
  const terminal = createTerminal({ files, data: SITE_DATA });
  const fileLines = (command) => terminal.execute(command).lines.filter((line) => line.style === 'file-line');
  assert.ok(fileLines('cat projets/constance/LICENSE').every((line) => line.lang === 'en'));
  assert.ok(fileLines('cat projets/constance/README.md').every((line) => line.lang === undefined));
});

test('chercher dans les noms et le contenu, sans accents, dans le dossier courant', () => {
  const terminal = newTerminal();
  const result = terminal.execute('chercher GITLEAKS');
  assert.match(result.announcement, /1 fichier\(s\)/);
  assert.ok(result.lines.some((line) => line.parts.some((part) => part.highlight === 'Gitleaks')));
  assert.match(terminal.execute('chercher arnaqué').announcement, /1 fichier/);
  terminal.execute('cd projets/irene');
  assert.match(screenText(terminal.execute('chercher gitleaks')), /Rien trouvé .* dans ~\/projets\/irene/);
});

test('projets et commandes de chaque projet', () => {
  const terminal = newTerminal();
  const projectList = screenText(terminal.execute('projets'));
  assert.match(projectList, /constance\s+v1\.0\.0/);
  assert.match(projectList, /irene\s+projet d'essai/);
  assert.match(projectList, /olympe\s+en préparation/);
  assert.match(screenText(terminal.execute('irène')), /Extension/);
  assert.match(screenText(terminal.execute('constance')), /github\.com\/x\/constance/);
});

test('effacer, couleur, inconnue, vide', () => {
  const terminal = newTerminal();
  assert.equal(terminal.execute('effacer').clearScreen, true);
  assert.equal(terminal.execute('couleur').changeColor, true);
  assert.match(screenText(terminal.execute('nimporte')), /Commande inconnue/);
  assert.equal(terminal.execute('   '), null);
});

test('complétion : commande, chemin unique, plusieurs propositions, rien', () => {
  const terminal = newTerminal();
  assert.deepEqual(terminal.complete('chE'), { value: 'chercher ' });
  assert.deepEqual(terminal.complete('cd pro'), { value: 'cd projets/' });
  assert.match(terminal.complete('cd projets/').announcement, /2 possibilités/);
  assert.equal(terminal.complete('cd zzz'), null);
  assert.match(terminal.complete('cd projets/constance/').announcement, /3 possibilités/);
  assert.equal(terminal.complete('xyz'), null);
});

test('les annonces restent courtes', () => {
  const terminal = newTerminal();
  for (const command of ['aide', 'projets', 'tree', 'cat projets/constance/README.md', 'chercher e']) {
    assert.ok(terminal.execute(command).announcement.length <= 400, command);
  }
});

test('collecte : dossiers cachés et dépendances écartés', () => {
  assert.equal(keepPath('src/a.ts'), true);
  assert.equal(keepPath('.github/workflows/ci.yml'), true);
  assert.equal(keepPath('.claude/skills/x/SKILL.md'), false);
  assert.equal(keepPath('.agents/x'), false);
  assert.equal(keepPath('node_modules/x/index.js'), false);
  assert.equal(keepPath('a/dist/b.js'), false);
  assert.equal(keepPath('package-lock.json'), false);
});

test('nom du terminal et invite configurables', () => {
  const terminal = createTerminal({ files: {}, data: { ...SITE_DATA, projects: [], terminal: { name: 'deck-os', prompt: 'deck' } } });
  assert.equal(terminal.terminalName, 'deck-os');
  assert.match(terminal.execute('pwd').echo.parts[0], /^deck:~\$ pwd$/);
  assert.match(terminal.bootLines[0].parts[0], /^DECK-OS/);
});

test('sans aucun projet, le terminal fonctionne', () => {
  const terminal = createTerminal({ files: {}, data: { presentation: ['Bonjour'], projects: [] } });
  assert.match(terminal.execute('ls').announcement, /2 éléments dans ~ : lisez-moi\.txt, moi\.txt/);
  assert.match(terminal.execute('projets').lines[0].parts[0], /Cartouches installées/);
  assert.equal(terminal.terminalName, 'niki-os');
});
