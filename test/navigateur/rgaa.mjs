// Vérifications RGAA dans Chromium, critère par critère (textes officiels lus avec Marguerite).
// Lancé par « npm run test:navigateur », site servi sur le port 4173. Échoue si un critère échoue.
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const URL = process.env.URL || 'http://localhost:4173/';
const axe = readFileSync('node_modules/axe-core/axe.min.js', 'utf8');
const res = [];
const ok = (critere, c, m) => { res.push(c); console.log(`${c ? '✅' : '❌'} ${critere} · ${m}`); };
const b = await chromium.launch();
const ouvrir = async (taille) => { const p = await b.newPage({ viewport: taille, reducedMotion: 'reduce' }); await p.goto(URL); await p.waitForSelector('text=Terminal prêt', { state: 'attached', timeout: 15000 }); return p; };
const debord = (p) => p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

let p = await ouvrir({ width: 1280, height: 900 });
// 12.7 lien d'évitement
await p.keyboard.press('Tab');
ok('12.7', (await p.evaluate(() => document.activeElement.textContent)) === 'Aller au terminal', "premier Tab : le lien d'évitement « Aller au terminal »");
await p.keyboard.press('Enter');
ok('12.7', (await p.evaluate(() => location.hash)) === '#commande', 'il mène au champ du terminal');
// 12.8 ordre de tabulation
await p.goto(URL); await p.waitForSelector('text=Terminal prêt', { state: 'attached' });
const ordre = [];
for (let i = 0; i < 12; i++) { await p.keyboard.press('Tab'); ordre.push(await p.evaluate(() => { const e = document.activeElement; return (e.getAttribute('aria-label') || e.id || e.textContent || '').trim().slice(0, 18); })); }
console.log('   ordre :', ordre.join(' → '));
const nbCartouches = await p.locator('button.cartouche').count();
const premiere = nbCartouches ? (await p.locator('button.cartouche b').first().textContent()).trim().slice(0, 10) : null;
const iTouche = ordre.indexOf('MOI'), iCart = premiere ? ordre.findIndex((x) => x.startsWith(premiere)) : Infinity;
const iChamp = ordre.indexOf('commande');
ok('12.8', ordre[1] === 'Écran du terminal' && iChamp > 1 && iTouche === iChamp + 1 && iCart > iTouche, `écran (et ses liens), champ, touches${premiere ? ', puis cartouches' : ''}`);
// 9.3 listes
await p.fill('#commande', 'ls ~'); await p.press('#commande', 'Enter'); await p.waitForTimeout(300);
ok('9.3', (await p.locator('.sortie ul.grille > li > button').count()) >= 2, 'liste de dossiers en <ul>/<li>');
if (nbCartouches) ok('9.3', (await p.locator('ul.liste-cartouches > li').count()) >= nbCartouches, 'cartouches en <ul>/<li>');
else ok('9.3', (await p.locator('.vide-message').count()) === 1, 'sans projet : message pour ajouter la première cartouche');
// 13.5 contenu cryptique : aucun trait, puce ou dessin lisible par un lecteur d'écran
await p.fill('#commande', 'tree ~'); await p.press('#commande', 'Enter');
await p.fill('#commande', 'projets'); await p.press('#commande', 'Enter');
await p.fill('#commande', 'nuages'); await p.press('#commande', 'Enter'); await p.waitForTimeout(400);
const cryptique = await p.evaluate(() => {
  const w = document.createTreeWalker(document.querySelector('.sortie'), NodeFilter.SHOW_TEXT);
  const trouves = [];
  while (w.nextNode()) { const n = w.currentNode; if (/[├└│─●◌]|\.{4,}|\(___/.test(n.nodeValue) && !n.parentElement.closest('[aria-hidden="true"]')) trouves.push(n.nodeValue.trim().slice(0, 30)); }
  return trouves;
});
ok('13.5', cryptique.length === 0, `aucun contenu cryptique restitué${cryptique.length ? ' : ' + cryptique.join(' | ') : ''}`);
ok('13.5', (await p.textContent('.sortie')).includes('Deux petits nuages, dessinés en caractères.'), 'le dessin a une alternative dans le contexte');
// 8.7 changement de langue
const licence = await p.evaluate(() => [...document.querySelectorAll('.sortie button.entree')].map((b) => b.textContent).find((t) => /LICEN[CS]E/i.test(t)));
await p.fill('#commande', 'chercher LICENSE'); await p.press('#commande', 'Enter'); await p.waitForTimeout(300);
const cheminLicence = await p.evaluate(() => { const b = [...document.querySelectorAll('.sortie button.entree')].find((x) => /\/LICEN[CS]E$/i.test(x.textContent)); return b ? b.textContent : null; });
if (cheminLicence) {
  await p.fill('#commande', `cat ~/${cheminLicence}`); await p.press('#commande', 'Enter'); await p.waitForTimeout(300);
  ok('8.7', (await p.locator('.sortie .ligne[lang=en]').count()) > 5, 'la licence en anglais est marquée lang="en"');
}
// 3.3 contraste du champ
const contraste = await p.evaluate(() => {
  const lum = (c) => { const [r, g, b] = c.match(/\d+/g).slice(0, 3).map(Number).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  const bord = getComputedStyle(document.querySelector('#commande')).borderBottomColor;
  const fond = getComputedStyle(document.querySelector('.ecran-cadre')).backgroundColor;
  const [a, bb] = [lum(bord), lum(fond)].sort((x, y) => y - x);
  return (a + 0.05) / (bb + 0.05);
});
ok('3.3', contraste >= 3, `bordure du champ : ${contraste.toFixed(1)}:1`);
// 10.7 focus visible sur chaque type d'élément
for (const sel of ['#commande', ...(nbCartouches ? ['button.cartouche'] : []), '.touche', '.sortie .entree', '.ecran']) {
  await p.focus(sel);
  const o = await p.evaluate((s) => { const e = document.activeElement; const st = getComputedStyle(e); return st.outlineStyle !== 'none' && parseFloat(st.outlineWidth) >= 2 || st.borderBottomStyle !== 'none' && e.id === 'commande'; }, sel);
  ok('10.7', o, `focus visible sur ${sel}`);
}
// 7.5 message de statut
ok('7.5', (await p.getAttribute('[role=status]', 'aria-live')) === 'polite', 'les annonces passent par un message de statut');
const a = await p.evaluate(async (axe) => { eval(axe); return (await window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] })).violations.map((v) => v.id); }, axe);
ok('axe', a.length === 0, `axe-core : ${a.length ? a.join(', ') : '0 violation'}`);
await p.close();

// 10.11 et 10.4 : 320 px de large, et l'équivalent d'un zoom à 200 %
for (const [crit, t] of [['10.11', { width: 320, height: 640 }], ['10.4', { width: 640, height: 450 }]]) {
  p = await ouvrir(t);
  ok(crit, (await debord(p)) <= 0, `${t.width} px : pas de défilement horizontal`);
  const sorties = await p.evaluate(() => { const cadre = document.querySelector('.ecran-cadre').getBoundingClientRect(); return [...document.querySelectorAll('.ecran, .saisie, .saisie input, .ecran-barre')].filter((e) => e.getBoundingClientRect().right > cadre.right + 1).map((e) => e.className || e.id); });
  ok(crit, sorties.length === 0, `${t.width} px : rien ne déborde du cadre de l'écran${sorties.length ? ' (' + sorties.join(', ') + ')' : ''}`);
  await p.close();
}
// 10.12 espacement du texte redéfini
p = await ouvrir({ width: 1280, height: 900 });
await p.addStyleTag({ content: '* { line-height: 1.5 !important; letter-spacing: .12em !important; word-spacing: .16em !important; } p { margin-bottom: 2em !important; }' });
const coupes = await p.evaluate(() => [...document.querySelectorAll('.cartouche b, .cartouche small, .touche, h1, .entete p')].filter((e) => e.scrollWidth > e.clientWidth + 1).map((e) => e.textContent.trim().slice(0, 20)));
ok('10.12', (await debord(p)) <= 0 && coupes.length === 0, `espacement redéfini : rien de coupé${coupes.length ? ' (' + coupes.join(', ') + ')' : ''}`);
await b.close();
console.log(`\n${res.filter(Boolean).length}/${res.length} vérifications réussies`);
if (res.some((x) => !x)) process.exit(1);
