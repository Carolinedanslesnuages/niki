/**
 * Le terminal : interprète une commande et renvoie des lignes à afficher, plus une annonce courte
 * pour les lecteurs d'écran (jamais tout le contenu). Fonctions pures, sans DOM.
 *
 * Une ligne : { classe?, morceaux: [texte | {entree} | {lien} | {marque} | {grille} | {code} | {deco}] }
 * {deco} : caractères purement visuels (traits d'arborescence, pointillés, puces, dessins),
 * ignorés des lecteurs d'écran (RGAA 13.5 : pas de contenu cryptique sans alternative).
 */
import { creerFS, affichable, resoudre, sansAccent } from './fichiers.js';

const L = (texte, classe) => ({ classe, morceaux: [texte] });
const D = (deco) => ({ deco });
const lienGitHub = (url, libelle) => ({ morceaux: [D('→ '), { lien: { url, libelle } }] });
const entree = (fs, chemin, libelle) => ({ entree: { chemin, libelle: libelle ?? fs.nomDe(chemin), dossier: fs.estDossier(chemin) } });
const texteDe = (ligne) =>
  ligne.morceaux
    .map((m) => (typeof m === 'string' ? m : m.deco !== undefined ? '' : m.entree ? m.entree.libelle + (m.entree.dossier ? '/' : '') : m.lien ? m.lien.libelle : m.marque ?? m.code ?? (m.grille ? m.grille.map((e) => e.entree.libelle).join(', ') : '')))
    .join('');

export function creerTerminal({ fichiers, donnees }) {
  const fs = creerFS(fichiers, donnees);
  const nomTerminal = (donnees.terminal && donnees.terminal.nom) || 'niki-os';
  const prefixe = (donnees.terminal && donnees.terminal.invite) || 'niki';
  let ici = '';
  const projets = donnees.projets || [];

  function ls(arg) {
    const cible = resoudre(ici, arg);
    if (!fs.existe(cible)) return { lignes: [L(`ls : ${arg} : aucun fichier ou dossier de ce nom.`, 'att')] };
    if (!fs.estDossier(cible)) return { lignes: [{ morceaux: [entree(fs, cible)] }] };
    const liste = fs.enfants(cible);
    if (!liste.length) return { lignes: [L('(dossier vide)', 'moi')], annonce: 'Dossier vide.' };
    const noms = liste.map((c) => fs.nomDe(c) + (fs.estDossier(c) ? ' (dossier)' : ''));
    return { lignes: [{ morceaux: [{ grille: liste.map((c) => entree(fs, c)) }] }], annonce: `${liste.length} éléments dans ${affichable(cible)} : ${noms.join(', ')}`.slice(0, 400) };
  }

  function cd(arg) {
    const cible = resoudre(ici, arg || '~');
    if (!fs.existe(cible)) return { lignes: [L(`cd : ${arg} : aucun dossier de ce nom.`, 'att')] };
    if (!fs.estDossier(cible)) return { lignes: [L(`cd : ${arg} est un fichier. Essayez « cat ${arg} ».`, 'att')] };
    ici = cible;
    return ls('');
  }

  function cat(arg) {
    if (!arg) return { lignes: [L('cat : quel fichier ? Exemple : cat moi.txt', 'att')] };
    const cible = resoudre(ici, arg);
    if (!fs.existe(cible)) return { lignes: [L(`cat : ${arg} : aucun fichier de ce nom.`, 'att')] };
    if (fs.estDossier(cible)) return { lignes: [L(`cat : ${arg} est un dossier. Essayez « ls ${arg} ».`, 'att')] };
    const f = fs.FS[cible];
    if (typeof f.c !== 'string') {
      return { lignes: [L(`${fs.nomDe(cible)} : fichier binaire ou trop gros pour l'écran.`, 'att'), lienGitHub(f.u, 'le voir sur GitHub')] };
    }
    const contenu = f.c.replace(/\n$/, '').split('\n');
    const max = 250;
    const lignes = [{ classe: 'titre', morceaux: [D('── '), affichable(cible), D(' ──')] }, ...contenu.slice(0, max).map((t) => ({ ...L(t, 'fichier'), langue: f.l }))];
    if (contenu.length > max) lignes.push(L(`… ${contenu.length - max} lignes de plus.`, 'moi'));
    if (f.u) lignes.push(lienGitHub(f.u, 'ouvrir sur GitHub'));
    return { lignes, annonce: `Fichier ${affichable(cible)} affiché, ${contenu.length} lignes. L'écran du terminal se lit avec les flèches.` };
  }

  function tree(arg) {
    const cible = resoudre(ici, arg);
    if (!fs.estDossier(cible)) return { lignes: [L(`tree : ${arg || '.'} n'est pas un dossier.`, 'att')] };
    const lignes = [L(affichable(cible), 'titre')];
    let compte = 0;
    (function parcourir(dossier, prefixe, profondeur) {
      const liste = fs.enfants(dossier);
      liste.forEach((c, i) => {
        if (compte >= 90) return;
        compte++;
        const dernier = i === liste.length - 1;
        lignes.push({ morceaux: [D(prefixe + (dernier ? '└── ' : '├── ')), entree(fs, c)] });
        if (fs.estDossier(c) && profondeur < 3) parcourir(c, prefixe + (dernier ? '    ' : '│   '), profondeur + 1);
      });
    })(cible, '', 1);
    if (compte >= 90) lignes.push(L('… arborescence coupée. Descendez avec « cd ».', 'moi'));
    return { lignes, annonce: `Arborescence de ${affichable(cible)}, ${lignes.length - 1} lignes affichées.` };
  }

  function surligner(texte, terme) {
    const brut = sansAccent(texte);
    const morceaux = [];
    let i = 0;
    let trouve = brut.indexOf(terme);
    while (trouve !== -1) {
      morceaux.push(texte.slice(i, trouve), { marque: texte.slice(trouve, trouve + terme.length) });
      i = trouve + terme.length;
      trouve = brut.indexOf(terme, i);
    }
    morceaux.push(texte.slice(i));
    return morceaux;
  }

  function chercher(arg) {
    const terme = sansAccent((arg || '').trim());
    if (terme.length < 2) return { lignes: [L('chercher : au moins 2 caractères. Exemple : chercher squash', 'att')] };
    const lignes = [];
    let total = 0;
    for (const c of Object.keys(fs.FS).sort((a, b) => a.localeCompare(b, 'fr'))) {
      if (ici && !(c === ici || c.startsWith(ici + '/'))) continue;
      const nomTrouve = sansAccent(fs.nomDe(c)).includes(terme);
      const occurrences = [];
      if (typeof fs.FS[c].c === 'string') fs.FS[c].c.split('\n').forEach((l, n) => sansAccent(l).includes(terme) && occurrences.push([n + 1, l.trim()]));
      if (!nomTrouve && !occurrences.length) continue;
      total++;
      if (total > 25) continue;
      lignes.push({ morceaux: [entree(fs, c, affichable(c).slice(2)), occurrences.length ? `  (${occurrences.length})` : ''] });
      for (const [n, t] of occurrences.slice(0, 2)) lignes.push({ classe: 'moi', morceaux: [`   ${n}: `, ...surligner(t.length > 90 ? t.slice(0, 90) + '…' : t, terme)] });
    }
    const ou = ici ? ` dans ${affichable(ici)}` : '';
    if (!total) return { lignes: [L(`Rien trouvé pour « ${arg} »${ou}.`, 'att')] };
    lignes.unshift(L(`${total} fichier(s) pour « ${arg} »${ou} :`, 'titre'));
    if (total > 25) lignes.push(L(`… et ${total - 25} autres. Précisez, ou descendez dans un dossier.`, 'moi'));
    return { lignes, annonce: `${total} fichier(s) trouvé(s) pour « ${arg} »${ou}. Résultats affichés à l'écran.` };
  }

  function resumeProjet(p) {
    const etat = p.etat === 'essai' ? "projet d'essai" : p.version || 'en cours';
    return {
      lignes: [
        L(`> ${p.nom.toLowerCase()}  (${etat})`, 'titre'),
        L(p.description || p.accroche),
        { morceaux: ['Ses fichiers : ', entree(fs, `projets/${p.dossier}`, `~/projets/${p.dossier}`)] },
        lienGitHub(p.url, `le dépôt ${p.nom} sur GitHub`),
      ],
    };
  }

  const commandes = {
    aide: () => ({
      lignes: [
        L('Commandes :', 'titre'),
        L("  ls [dossier]       ce qu'il y a ici"),
        L("  cd <dossier>       entrer (.. pour remonter, ~ pour l'accueil)"),
        L('  cat <fichier>      lire un fichier'),
        L("  tree [dossier]     l'arborescence"),
        L('  chercher <mots>    dans les noms et le contenu des fichiers'),
        L(`  ${projets.map((p) => p.commande).join(' · ')}`),
        L('  pwd · moi · projets · couleur · effacer'),
        L('Tab complète les noms. ↑ ↓ rappellent les commandes. Tout est cliquable.', 'moi'),
      ],
    }),
    moi: () => ({ lignes: (donnees.presentation || []).map((t, i) => L(t, i === 0 ? 'titre' : undefined)) }),
    projets: () => ({
      lignes: [
        L('Cartouches installées :', 'titre'),
        ...projets.map((p) => ({ classe: p.etat === 'en-cours' ? 'att' : 'ok', morceaux: [D(`  [${p.etat === 'en-cours' ? '◌' : '●'}] `), `${p.commande.padEnd(11)} ${(p.etat === 'essai' ? "projet d'essai" : p.version || 'en cours').padEnd(15)} ${p.accroche}`] })),
        ...(donnees.bientot || []).map((b) => ({ classe: 'att', morceaux: [D('  [◌] '), `${b.nom.toLowerCase().padEnd(11)} ${'en préparation'.padEnd(15)} ${b.accroche}`] })),
        { morceaux: ['Parcourir : ', entree(fs, 'projets', '~/projets')] },
      ],
    }),
    ls,
    cd,
    cat,
    tree,
    chercher,
    pwd: () => ({ lignes: [L(affichable(ici))] }),
    nuages: () => ({
      lignes: [
        { classe: 'moi', morceaux: [D('      .--.        .--.')] },
        { classe: 'moi', morceaux: [D('   .-(    ).  .-(    ).')] },
        { classe: 'moi', morceaux: [D('  (___.__)__)(___.__)__)')] },
        L('Deux petits nuages, dessinés en caractères.', 'moi'),
        L("Vous m'avez trouvée.", 'titre'),
      ],
    }),
    sudo: () => ({ lignes: [L('Pas de sudo ici. Juste du thé et des tests verts.', 'att')] }),
    effacer: () => ({ lignes: [], effacer: true, annonce: 'Écran effacé.' }),
    couleur: () => ({ lignes: [], couleur: true }),
  };
  for (const p of projets) commandes[p.commande] = () => resumeProjet(p);
  Object.assign(commandes, { help: commandes.aide, clear: commandes.effacer, whoami: commandes.moi, grep: chercher, find: chercher, less: cat, more: cat, dir: ls });

  function executer(saisie) {
    const propre = saisie.trim();
    if (!propre) return null;
    const [nom, ...reste] = propre.split(/\s+/);
    const cle = sansAccent(nom);
    const fonction = commandes[cle];
    const r = fonction ? fonction(reste.join(' ')) : { lignes: [L(`Commande inconnue : ${nom}. Tapez « aide ».`, 'att')] };
    const echo = L(`${prefixe}:${affichable(ici)}$ ${propre}`, 'moi');
    const annonce = r.annonce || r.lignes.map(texteDe).join(' ').slice(0, 240);
    return { ...r, echo, annonce, instantane: ['cat', 'less', 'more', 'tree', 'chercher', 'grep', 'find'].includes(cle) };
  }

  /** Complétion de la saisie : renvoie la nouvelle valeur, ou des propositions, ou null. */
  function completer(valeur) {
    const morceaux = valeur.split(/\s+/);
    if (morceaux.length < 2) {
      const possibles = Object.keys(commandes).filter((c) => c.startsWith(valeur.toLowerCase()));
      return possibles.length === 1 && possibles[0] !== valeur ? { valeur: possibles[0] + ' ' } : null;
    }
    const partiel = morceaux.pop();
    const coupe = partiel.lastIndexOf('/');
    const dossierTape = coupe >= 0 ? partiel.slice(0, coupe + 1) : '';
    const dossier = resoudre(ici, dossierTape || '.');
    if (!fs.estDossier(dossier)) return null;
    const possibles = fs.enfants(dossier).filter((c) => fs.nomDe(c).startsWith(partiel.slice(coupe + 1)));
    if (possibles.length === 1) {
      const c = possibles[0];
      const nouvelle = [...morceaux, dossierTape + fs.nomDe(c) + (fs.estDossier(c) ? '/' : ' ')].join(' ');
      return nouvelle === valeur ? null : { valeur: nouvelle };
    }
    if (possibles.length > 1) return { propositions: { morceaux: [{ grille: possibles.map((c) => entree(fs, c)) }] }, annonce: `${possibles.length} possibilités affichées à l'écran.` };
    return null;
  }

  const nbFichiers = Object.keys(fs.FS).filter((c) => !fs.FS[c].d).length;
  const demarrage = [
    L(`${nomTerminal.toUpperCase()}  ·  démarrage`, 'titre'),
    { classe: 'ok', morceaux: ['mémoire ', D('........... '), 'curiosité illimitée'] },
    { classe: 'ok', morceaux: ['fichiers ', D('.......... '), `${nbFichiers} montés dans ~/projets`] },
    { classe: 'att', morceaux: ['café ', D('.............. '), 'à recharger'] },
    L(''),
    L(donnees.accroche || ''),
    { classe: 'moi', morceaux: ['Tapez « aide », ouvrez ', entree(fs, 'lisez-moi.txt'), projets.length ? ', ou insérez une cartouche.' : '.'] },
  ];

  return { executer, completer, demarrage, nomTerminal, prefixe, invite: () => affichable(ici), entreeVers: (chemin) => entree(fs, chemin) };
}
