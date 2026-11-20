/**
 * Système de fichiers en mémoire : les dépôts publics collectés, plus quelques fichiers du site.
 * Fonctions pures, sans DOM.
 */
export function creerFS(fichiers, { presentation = [] } = {}) {
  const FS = { ...fichiers };
  FS['moi.txt'] = { c: presentation.join('\n') };
  FS['lisez-moi.txt'] = {
    c: [
      'Bienvenue dans mes dossiers.',
      '',
      "projets/   le code et la doc de mes outils, tels qu'ils sont sur GitHub",
      'moi.txt    qui je suis',
      '',
      'Essayez :  cd projets   ·   tree projets   ·   chercher README',
    ].join('\n'),
  };
  // Chaque fichier implique ses dossiers parents.
  for (const chemin of Object.keys(FS)) {
    const morceaux = chemin.split('/');
    for (let i = 1; i < morceaux.length; i++) {
      const parent = morceaux.slice(0, i).join('/');
      if (!FS[parent]) FS[parent] = { d: 1 };
    }
  }
  const estDossier = (c) => c === '' || !!(FS[c] && FS[c].d);
  const existe = (c) => c === '' || !!FS[c];
  const nomDe = (c) => c.split('/').pop();
  const enfants = (dossier) =>
    Object.keys(FS)
      .filter((c) => c !== dossier && (dossier === '' ? !c.includes('/') : c.startsWith(dossier + '/') && !c.slice(dossier.length + 1).includes('/')))
      .sort((a, b) => Number(estDossier(b)) - Number(estDossier(a)) || a.localeCompare(b, 'fr'));
  return { FS, estDossier, existe, nomDe, enfants };
}

/** « ~/projets/x » depuis un chemin interne « projets/x ». */
export const affichable = (c) => '~' + (c ? '/' + c : '');

/** Résout un chemin tapé (relatif, « .. », « ~ », « / ») depuis le dossier courant. */
export function resoudre(ici, arg) {
  if (arg === undefined || arg === '' || arg === '.') return ici;
  if (arg === '~' || arg === '/') return '';
  const base = arg.startsWith('/') || arg.startsWith('~') ? [] : ici ? ici.split('/') : [];
  for (const p of arg.replace(/^~\/?/, '').replace(/^\//, '').split('/')) {
    if (!p || p === '.') continue;
    if (p === '..') base.pop();
    else base.push(p);
  }
  return base.join('/');
}

export const sansAccent = (t) => String(t).normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
