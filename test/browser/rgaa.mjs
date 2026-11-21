// RGAA checks in Chromium, criterion by criterion (official texts read with Marguerite).
// Run by "npm run test:browser", site served on port 4173. Fails when a criterion fails.
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

const SITE_URL = process.env.URL || 'http://localhost:4173/';
const AXE_SOURCE = readFileSync('node_modules/axe-core/axe.min.js', 'utf8');
const AXE_RULES = { runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] };
const results = [];
const check = (criterion, passed, message) => {
  results.push(passed);
  console.log(`${passed ? '✅' : '❌'} ${criterion} · ${message}`);
};
const browser = await chromium.launch();
const openPage = async (viewport, reducedMotion = 'reduce') => {
  const page = await browser.newPage({ viewport, reducedMotion });
  await page.goto(SITE_URL);
  await page.waitForSelector('text=Terminal prêt', { state: 'attached', timeout: 15000 });
  return page;
};
const horizontalOverflow = (page) => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
const runCommand = async (page, command, waitMs = 0) => {
  await page.fill('#command', command);
  await page.press('#command', 'Enter');
  if (waitMs) await page.waitForTimeout(waitMs);
};

let page = await openPage({ width: 1280, height: 900 });
// 12.7 skip link
await page.keyboard.press('Tab');
check('12.7', (await page.evaluate(() => document.activeElement.textContent)) === 'Aller au terminal', "premier Tab : le lien d'évitement « Aller au terminal »");
await page.keyboard.press('Enter');
check('12.7', (await page.evaluate(() => location.hash)) === '#command', 'il mène au champ du terminal');
// 12.8 tab order
await page.goto(SITE_URL);
await page.waitForSelector('text=Terminal prêt', { state: 'attached' });
const tabOrder = [];
for (let step = 0; step < 12; step++) {
  await page.keyboard.press('Tab');
  tabOrder.push(await page.evaluate(() => {
    const element = document.activeElement;
    return (element.getAttribute('aria-label') || element.id || element.textContent || '').trim().slice(0, 18);
  }));
}
console.log('   ordre :', tabOrder.join(' → '));
const cartridgeCount = await page.locator('button.cartridge').count();
const firstCartridgeName = cartridgeCount ? (await page.locator('button.cartridge b').first().textContent()).trim().slice(0, 10) : null;
const firstKey = tabOrder.indexOf('MOI');
const firstCartridge = firstCartridgeName ? tabOrder.findIndex((label) => label.startsWith(firstCartridgeName)) : Infinity;
const commandField = tabOrder.indexOf('command');
check('12.8', tabOrder[1] === 'Écran du terminal' && commandField > 1 && firstKey === commandField + 1 && firstCartridge > firstKey, `écran (et ses liens), champ, touches${firstCartridgeName ? ', puis cartouches' : ''}`);
// 9.3 lists
await runCommand(page, 'ls ~', 300);
check('9.3', (await page.locator('.output ul.grid > li > button').count()) >= 2, 'liste de dossiers en <ul>/<li>');
if (cartridgeCount) check('9.3', (await page.locator('ul.cartridge-list > li').count()) >= cartridgeCount, 'cartouches en <ul>/<li>');
else check('9.3', (await page.locator('.empty-message').count()) === 1, 'sans projet : message pour ajouter la première cartouche');
// 13.5 cryptic content: no branch, bullet or drawing readable by a screen reader
await runCommand(page, 'tree ~');
await runCommand(page, 'projets');
await runCommand(page, 'nuages', 400);
const crypticTexts = await page.evaluate(() => {
  const walker = document.createTreeWalker(document.querySelector('.output'), NodeFilter.SHOW_TEXT);
  const found = [];
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (/[├└│─●◌]|\.{4,}|\(___/.test(node.nodeValue) && !node.parentElement.closest('[aria-hidden="true"]')) found.push(node.nodeValue.trim().slice(0, 30));
  }
  return found;
});
check('13.5', crypticTexts.length === 0, `aucun contenu cryptique restitué${crypticTexts.length ? ' : ' + crypticTexts.join(' | ') : ''}`);
check('13.5', (await page.textContent('.output')).includes('Deux petits nuages, dessinés en caractères.'), 'le dessin a une alternative dans le contexte');
// 8.7 change of language (when a collected project has a licence in English)
await runCommand(page, 'chercher LICENSE', 300);
const licencePath = await page.evaluate(() => {
  const entry = [...document.querySelectorAll('.output button.entry')].find((button) => /\/LICEN[CS]E$/i.test(button.textContent));
  return entry ? entry.textContent : null;
});
if (licencePath) {
  await runCommand(page, `cat ~/${licencePath}`, 300);
  check('8.7', (await page.locator('.output .line[lang=en]').count()) > 5, 'la licence en anglais est marquée lang="en"');
}
// 3.3 field contrast
const contrastRatio = await page.evaluate(() => {
  const luminance = (color) => {
    const [red, green, blue] = color.match(/\d+/g).slice(0, 3).map(Number).map((channel) => {
      const value = channel / 255;
      return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
  };
  const border = getComputedStyle(document.querySelector('#command')).borderBottomColor;
  const background = getComputedStyle(document.querySelector('.screen-frame')).backgroundColor;
  const [lighter, darker] = [luminance(border), luminance(background)].sort((first, second) => second - first);
  return (lighter + 0.05) / (darker + 0.05);
});
check('3.3', contrastRatio >= 3, `bordure du champ : ${contrastRatio.toFixed(1)}:1`);
// 10.7 visible focus on every kind of element
for (const selector of ['#command', ...(cartridgeCount ? ['button.cartridge'] : []), '.key', '.output .entry', '.screen']) {
  await page.focus(selector);
  const visible = await page.evaluate(() => {
    const element = document.activeElement;
    const style = getComputedStyle(element);
    return (style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) >= 2) || (style.borderBottomStyle !== 'none' && element.id === 'command');
  });
  check('10.7', visible, `focus visible sur ${selector}`);
}
// 7.5 status message
check('7.5', (await page.getAttribute('[role=status]', 'aria-live')) === 'polite', 'les annonces passent par un message de statut');
const axeViolations = await page.evaluate(async ({ source, rules }) => {
  eval(source);
  return (await window.axe.run(document, rules)).violations.map((violation) => violation.id);
}, { source: AXE_SOURCE, rules: AXE_RULES });
check('axe', axeViolations.length === 0, `axe-core : ${axeViolations.length ? axeViolations.join(', ') : '0 violation'}`);
await page.close();

// 10.11 and 10.4: 320 px wide, and the equivalent of a 200 % zoom
for (const [criterion, viewport] of [['10.11', { width: 320, height: 640 }], ['10.4', { width: 640, height: 450 }]]) {
  page = await openPage(viewport);
  check(criterion, (await horizontalOverflow(page)) <= 0, `${viewport.width} px : pas de défilement horizontal`);
  const overflowing = await page.evaluate(() => {
    const frame = document.querySelector('.screen-frame').getBoundingClientRect();
    return [...document.querySelectorAll('.screen, .command-line, .command-line input, .screen-bar')]
      .filter((element) => element.getBoundingClientRect().right > frame.right + 1)
      .map((element) => element.className || element.id);
  });
  check(criterion, overflowing.length === 0, `${viewport.width} px : rien ne déborde du cadre de l'écran${overflowing.length ? ' (' + overflowing.join(', ') + ')' : ''}`);
  await page.close();
}
// 10.12 text spacing overridden
page = await openPage({ width: 1280, height: 900 });
await page.addStyleTag({ content: '* { line-height: 1.5 !important; letter-spacing: .12em !important; word-spacing: .16em !important; } p { margin-bottom: 2em !important; }' });
const clipped = await page.evaluate(() => [...document.querySelectorAll('.cartridge b, .cartridge small, .key, h1, .site-header p')]
  .filter((element) => element.scrollWidth > element.clientWidth + 1)
  .map((element) => element.textContent.trim().slice(0, 20)));
check('10.12', (await horizontalOverflow(page)) <= 0 && clipped.length === 0, `espacement redéfini : rien de coupé${clipped.length ? ' (' + clipped.join(', ') + ')' : ''}`);
await browser.close();
console.log(`\n${results.filter(Boolean).length}/${results.length} vérifications réussies`);
if (results.some((passed) => !passed)) process.exit(1);
