/**
 * In-memory file system: the collected public repositories, plus a few files of the site.
 * A node is { content?, url?, lang?, folder? }. Pure functions, no DOM.
 */
export function createFileSystem(collectedFiles, { presentation = [] } = {}) {
  const nodes = { ...collectedFiles };
  nodes['moi.txt'] = { content: presentation.join('\n') };
  nodes['lisez-moi.txt'] = {
    content: [
      'Bienvenue dans mes dossiers.',
      '',
      "projets/   le code et la doc de mes outils, tels qu'ils sont sur GitHub",
      'moi.txt    qui je suis',
      '',
      'Essayez :  cd projets   ·   tree projets   ·   chercher README',
    ].join('\n'),
  };
  // Every file implies its parent folders.
  for (const path of Object.keys(nodes)) {
    const segments = path.split('/');
    for (let depth = 1; depth < segments.length; depth++) {
      const parent = segments.slice(0, depth).join('/');
      if (!nodes[parent]) nodes[parent] = { folder: true };
    }
  }
  const isFolder = (path) => path === '' || !!(nodes[path] && nodes[path].folder);
  const exists = (path) => path === '' || !!nodes[path];
  const nameOf = (path) => path.split('/').pop();
  const childrenOf = (folder) =>
    Object.keys(nodes)
      .filter((path) => path !== folder && (folder === '' ? !path.includes('/') : path.startsWith(folder + '/') && !path.slice(folder.length + 1).includes('/')))
      .sort((left, right) => Number(isFolder(right)) - Number(isFolder(left)) || left.localeCompare(right, 'fr'));
  return { nodes, isFolder, exists, nameOf, childrenOf };
}

/** "~/projets/x" from an internal path "projets/x". */
export const displayPath = (path) => '~' + (path ? '/' + path : '');

/** Resolves a typed path (relative, "..", "~", "/") from the current folder. */
export function resolvePath(currentFolder, typed) {
  if (typed === undefined || typed === '' || typed === '.') return currentFolder;
  if (typed === '~' || typed === '/') return '';
  const segments = typed.startsWith('/') || typed.startsWith('~') ? [] : currentFolder ? currentFolder.split('/') : [];
  for (const segment of typed.replace(/^~\/?/, '').replace(/^\//, '').split('/')) {
    if (!segment || segment === '.') continue;
    if (segment === '..') segments.pop();
    else segments.push(segment);
  }
  return segments.join('/');
}

export const withoutAccents = (text) => String(text).normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
