/**
 * The terminal: runs a command and returns lines to display, plus a short announcement for
 * screen readers (never the whole content). Pure functions, no DOM.
 *
 * A line: { style?, lang?, parts: [text | {entry} | {link} | {highlight} | {grid} | {code} | {decoration}] }
 * {decoration}: purely visual characters (tree branches, dots, bullets, drawings), hidden from
 * screen readers (RGAA 13.5: no cryptic content without an alternative).
 * Command names stay in French: they are the site's interface.
 */
import { createFileSystem, displayPath, resolvePath, withoutAccents } from './filesystem.js';

const textLine = (text, style) => ({ style, parts: [text] });
const decoration = (characters) => ({ decoration: characters });
const githubLink = (targetUrl, label) => ({ parts: [decoration('→ '), { link: { url: targetUrl, label } }] });
const MAX_FILE_LINES = 250;
const MAX_TREE_ENTRIES = 90;
const MAX_SEARCH_FILES = 25;
const INSTANT_COMMANDS = ['cat', 'less', 'more', 'tree', 'chercher', 'grep', 'find'];

function plainText(line) {
  return line.parts
    .map((part) => {
      if (typeof part === 'string') return part;
      if (part.decoration !== undefined) return '';
      if (part.entry) return part.entry.label + (part.entry.isFolder ? '/' : '');
      if (part.link) return part.link.label;
      if (part.grid) return part.grid.map((cell) => cell.entry.label).join(', ');
      return part.highlight ?? part.code ?? '';
    })
    .join('');
}

/** Splits a text around every occurrence of the (accent-free) term, marking the matches. */
function highlightParts(text, term) {
  const comparable = withoutAccents(text);
  const parts = [];
  let cursor = 0;
  let found = comparable.indexOf(term);
  while (found !== -1) {
    parts.push(text.slice(cursor, found), { highlight: text.slice(found, found + term.length) });
    cursor = found + term.length;
    found = comparable.indexOf(term, cursor);
  }
  parts.push(text.slice(cursor));
  return parts;
}

const statusLabel = (project) => (project.status === 'trial' ? "projet d'essai" : project.version || 'en cours');

export function createTerminal({ files, data }) {
  const fileSystem = createFileSystem(files, data);
  let currentFolder = '';
  const projects = data.projects || [];
  const terminalName = (data.terminal && data.terminal.name) || 'niki-os';
  const promptPrefix = (data.terminal && data.terminal.prompt) || 'niki';

  const entryFor = (path, label) => ({ entry: { path, label: label ?? fileSystem.nameOf(path), isFolder: fileSystem.isFolder(path) } });

  function list(typed) {
    const target = resolvePath(currentFolder, typed);
    if (!fileSystem.exists(target)) return { lines: [textLine(`ls : ${typed} : aucun fichier ou dossier de ce nom.`, 'warning')] };
    if (!fileSystem.isFolder(target)) return { lines: [{ parts: [entryFor(target)] }] };
    const children = fileSystem.childrenOf(target);
    if (!children.length) return { lines: [textLine('(dossier vide)', 'muted')], announcement: 'Dossier vide.' };
    const names = children.map((child) => fileSystem.nameOf(child) + (fileSystem.isFolder(child) ? ' (dossier)' : ''));
    return {
      lines: [{ parts: [{ grid: children.map((child) => entryFor(child)) }] }],
      announcement: `${children.length} éléments dans ${displayPath(target)} : ${names.join(', ')}`.slice(0, 400),
    };
  }

  function changeFolder(typed) {
    const target = resolvePath(currentFolder, typed || '~');
    if (!fileSystem.exists(target)) return { lines: [textLine(`cd : ${typed} : aucun dossier de ce nom.`, 'warning')] };
    if (!fileSystem.isFolder(target)) return { lines: [textLine(`cd : ${typed} est un fichier. Essayez « cat ${typed} ».`, 'warning')] };
    currentFolder = target;
    return list('');
  }

  function showFile(typed) {
    if (!typed) return { lines: [textLine('cat : quel fichier ? Exemple : cat moi.txt', 'warning')] };
    const target = resolvePath(currentFolder, typed);
    if (!fileSystem.exists(target)) return { lines: [textLine(`cat : ${typed} : aucun fichier de ce nom.`, 'warning')] };
    if (fileSystem.isFolder(target)) return { lines: [textLine(`cat : ${typed} est un dossier. Essayez « ls ${typed} ».`, 'warning')] };
    const file = fileSystem.nodes[target];
    if (typeof file.content !== 'string') {
      return { lines: [textLine(`${fileSystem.nameOf(target)} : fichier binaire ou trop gros pour l'écran.`, 'warning'), githubLink(file.url, 'le voir sur GitHub')] };
    }
    const contentLines = file.content.replace(/\n$/, '').split('\n');
    const lines = [
      { style: 'heading', parts: [decoration('── '), displayPath(target), decoration(' ──')] },
      ...contentLines.slice(0, MAX_FILE_LINES).map((text) => ({ ...textLine(text, 'file-line'), lang: file.lang })),
    ];
    if (contentLines.length > MAX_FILE_LINES) lines.push(textLine(`… ${contentLines.length - MAX_FILE_LINES} lignes de plus.`, 'muted'));
    if (file.url) lines.push(githubLink(file.url, 'ouvrir sur GitHub'));
    return { lines, announcement: `Fichier ${displayPath(target)} affiché, ${contentLines.length} lignes. L'écran du terminal se lit avec les flèches.` };
  }

  function tree(typed) {
    const target = resolvePath(currentFolder, typed);
    if (!fileSystem.isFolder(target)) return { lines: [textLine(`tree : ${typed || '.'} n'est pas un dossier.`, 'warning')] };
    const lines = [textLine(displayPath(target), 'heading')];
    let entryCount = 0;
    (function walk(folder, prefix, depth) {
      const children = fileSystem.childrenOf(folder);
      children.forEach((child, index) => {
        if (entryCount >= MAX_TREE_ENTRIES) return;
        entryCount++;
        const isLast = index === children.length - 1;
        lines.push({ parts: [decoration(prefix + (isLast ? '└── ' : '├── ')), entryFor(child)] });
        if (fileSystem.isFolder(child) && depth < 3) walk(child, prefix + (isLast ? '    ' : '│   '), depth + 1);
      });
    })(target, '', 1);
    if (entryCount >= MAX_TREE_ENTRIES) lines.push(textLine('… arborescence coupée. Descendez avec « cd ».', 'muted'));
    return { lines, announcement: `Arborescence de ${displayPath(target)}, ${lines.length - 1} lignes affichées.` };
  }

  function search(typed) {
    const term = withoutAccents((typed || '').trim());
    if (term.length < 2) return { lines: [textLine('chercher : au moins 2 caractères. Exemple : chercher squash', 'warning')] };
    const lines = [];
    let fileCount = 0;
    for (const path of Object.keys(fileSystem.nodes).sort((left, right) => left.localeCompare(right, 'fr'))) {
      if (currentFolder && !(path === currentFolder || path.startsWith(currentFolder + '/'))) continue;
      const nameMatches = withoutAccents(fileSystem.nameOf(path)).includes(term);
      const matches = [];
      const content = fileSystem.nodes[path].content;
      if (typeof content === 'string') {
        content.split('\n').forEach((line, index) => withoutAccents(line).includes(term) && matches.push([index + 1, line.trim()]));
      }
      if (!nameMatches && !matches.length) continue;
      fileCount++;
      if (fileCount > MAX_SEARCH_FILES) continue;
      lines.push({ parts: [entryFor(path, displayPath(path).slice(2)), matches.length ? `  (${matches.length})` : ''] });
      for (const [lineNumber, text] of matches.slice(0, 2)) {
        lines.push({ style: 'muted', parts: [`   ${lineNumber}: `, ...highlightParts(text.length > 90 ? text.slice(0, 90) + '…' : text, term)] });
      }
    }
    const where = currentFolder ? ` dans ${displayPath(currentFolder)}` : '';
    if (!fileCount) return { lines: [textLine(`Rien trouvé pour « ${typed} »${where}.`, 'warning')] };
    lines.unshift(textLine(`${fileCount} fichier(s) pour « ${typed} »${where} :`, 'heading'));
    if (fileCount > MAX_SEARCH_FILES) lines.push(textLine(`… et ${fileCount - MAX_SEARCH_FILES} autres. Précisez, ou descendez dans un dossier.`, 'muted'));
    return { lines, announcement: `${fileCount} fichier(s) trouvé(s) pour « ${typed} »${where}. Résultats affichés à l'écran.` };
  }

  function projectSummary(project) {
    return {
      lines: [
        textLine(`> ${project.name.toLowerCase()}  (${statusLabel(project)})`, 'heading'),
        textLine(project.description || project.tagline),
        { parts: ['Ses fichiers : ', entryFor(`projets/${project.folder}`, `~/projets/${project.folder}`)] },
        githubLink(project.url, `le dépôt ${project.name} sur GitHub`),
      ],
    };
  }

  function projectList() {
    const projectRow = (project) => ({
      style: project.status === 'in-progress' ? 'warning' : 'success',
      parts: [decoration(`  [${project.status === 'in-progress' ? '◌' : '●'}] `), `${project.command.padEnd(11)} ${statusLabel(project).padEnd(15)} ${project.tagline}`],
    });
    const upcomingRow = (upcoming) => ({
      style: 'warning',
      parts: [decoration('  [◌] '), `${upcoming.name.toLowerCase().padEnd(11)} ${'en préparation'.padEnd(15)} ${upcoming.tagline}`],
    });
    return {
      lines: [
        textLine('Cartouches installées :', 'heading'),
        ...projects.map(projectRow),
        ...(data.upcoming || []).map(upcomingRow),
        { parts: ['Parcourir : ', entryFor('projets', '~/projets')] },
      ],
    };
  }

  const commands = {
    aide: () => ({
      lines: [
        textLine('Commandes :', 'heading'),
        textLine("  ls [dossier]       ce qu'il y a ici"),
        textLine("  cd <dossier>       entrer (.. pour remonter, ~ pour l'accueil)"),
        textLine('  cat <fichier>      lire un fichier'),
        textLine("  tree [dossier]     l'arborescence"),
        textLine('  chercher <mots>    dans les noms et le contenu des fichiers'),
        textLine(`  ${projects.map((project) => project.command).join(' · ')}`),
        textLine('  pwd · moi · projets · couleur · effacer'),
        textLine('Tab complète les noms. ↑ ↓ rappellent les commandes. Tout est cliquable.', 'muted'),
      ],
    }),
    moi: () => ({ lines: (data.presentation || []).map((text, index) => textLine(text, index === 0 ? 'heading' : undefined)) }),
    projets: projectList,
    ls: list,
    cd: changeFolder,
    cat: showFile,
    tree,
    chercher: search,
    pwd: () => ({ lines: [textLine(displayPath(currentFolder))] }),
    nuages: () => ({
      lines: [
        { style: 'muted', parts: [decoration('      .--.        .--.')] },
        { style: 'muted', parts: [decoration('   .-(    ).  .-(    ).')] },
        { style: 'muted', parts: [decoration('  (___.__)__)(___.__)__)')] },
        textLine('Deux petits nuages, dessinés en caractères.', 'muted'),
        textLine("Vous m'avez trouvée.", 'heading'),
      ],
    }),
    sudo: () => ({ lines: [textLine('Pas de sudo ici. Juste du thé et des tests verts.', 'warning')] }),
    effacer: () => ({ lines: [], clearScreen: true, announcement: 'Écran effacé.' }),
    couleur: () => ({ lines: [], changeColor: true }),
  };
  for (const project of projects) commands[project.command] = () => projectSummary(project);
  Object.assign(commands, { help: commands.aide, clear: commands.effacer, whoami: commands.moi, grep: search, find: search, less: showFile, more: showFile, dir: list });

  function execute(input) {
    const trimmed = input.trim();
    if (!trimmed) return null;
    const [name, ...rest] = trimmed.split(/\s+/);
    const commandKey = withoutAccents(name);
    const handler = commands[commandKey];
    const result = handler ? handler(rest.join(' ')) : { lines: [textLine(`Commande inconnue : ${name}. Tapez « aide ».`, 'warning')] };
    const echo = textLine(`${promptPrefix}:${displayPath(currentFolder)}$ ${trimmed}`, 'muted');
    const announcement = result.announcement || result.lines.map(plainText).join(' ').slice(0, 240);
    return { ...result, echo, announcement, instant: INSTANT_COMMANDS.includes(commandKey) };
  }

  /** Completes the input: returns the new value, or suggestions, or null. */
  function complete(value) {
    const words = value.split(/\s+/);
    if (words.length < 2) {
      const candidates = Object.keys(commands).filter((command) => command.startsWith(value.toLowerCase()));
      return candidates.length === 1 && candidates[0] !== value ? { value: candidates[0] + ' ' } : null;
    }
    const partial = words.pop();
    const lastSlash = partial.lastIndexOf('/');
    const typedFolder = lastSlash >= 0 ? partial.slice(0, lastSlash + 1) : '';
    const folder = resolvePath(currentFolder, typedFolder || '.');
    if (!fileSystem.isFolder(folder)) return null;
    const candidates = fileSystem.childrenOf(folder).filter((child) => fileSystem.nameOf(child).startsWith(partial.slice(lastSlash + 1)));
    if (candidates.length === 1) {
      const [only] = candidates;
      const completed = [...words, typedFolder + fileSystem.nameOf(only) + (fileSystem.isFolder(only) ? '/' : ' ')].join(' ');
      return completed === value ? null : { value: completed };
    }
    if (candidates.length > 1) {
      return { suggestions: { parts: [{ grid: candidates.map((child) => entryFor(child)) }] }, announcement: `${candidates.length} possibilités affichées à l'écran.` };
    }
    return null;
  }

  const fileCount = Object.keys(fileSystem.nodes).filter((path) => !fileSystem.nodes[path].folder).length;
  const bootLines = [
    textLine(`${terminalName.toUpperCase()}  ·  démarrage`, 'heading'),
    { style: 'success', parts: ['mémoire ', decoration('........... '), 'curiosité illimitée'] },
    { style: 'success', parts: ['fichiers ', decoration('.......... '), `${fileCount} montés dans ~/projets`] },
    { style: 'warning', parts: ['café ', decoration('.............. '), 'à recharger'] },
    textLine(''),
    textLine(data.tagline || ''),
    { style: 'muted', parts: ['Tapez « aide », ouvrez ', entryFor('lisez-moi.txt'), projects.length ? ', ou insérez une cartouche.' : '.'] },
  ];

  return { execute, complete, bootLines, terminalName, promptPrefix, prompt: () => displayPath(currentFolder), entryFor };
}
