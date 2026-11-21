// Runs the site in Chromium: boot, commands, clicks, keyboard, accessibility (axe-core).
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

const SITE_URL = process.env.URL || 'http://localhost:4173/';
const AXE_SOURCE = readFileSync('node_modules/axe-core/axe.min.js', 'utf8');
let failureCount = 0;
const check = (passed, message) => {
  if (!passed) failureCount++;
  console.log((passed ? '✅ ' : '❌ ') + message);
};
const withoutAccents = (text) => text.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
const browser = await chromium.launch();
const errors = [];

for (const [deviceName, viewport] of [['ordinateur', { width: 1280, height: 900 }], ['telephone', { width: 390, height: 844 }]]) {
  const page = await browser.newPage({ viewport, reducedMotion: 'reduce' });
  page.on('pageerror', (error) => errors.push(`${deviceName} : ${error.message}`));
  page.on('console', (message) => message.type() === 'error' && errors.push(`${deviceName} console : ${message.text()}`));
  await page.goto(SITE_URL);
  await page.waitForSelector('text=Terminal prêt', { state: 'attached', timeout: 15000 });
  check(true, `${deviceName} : démarrage, annonce « Terminal prêt »`);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check(overflow <= 0, `${deviceName} : pas de défilement horizontal (${overflow}px)`);
  if (deviceName === 'ordinateur') {
    await page.fill('#command', 'cat lisez');
    await page.press('#command', 'Tab');
    check((await page.inputValue('#command')) === 'cat lisez-moi.txt ', 'Tab complète « lisez-moi.txt »');
    await page.press('#command', 'Enter');
    await page.waitForTimeout(300);
    check((await page.textContent('.output')).includes('Bienvenue dans mes dossiers'), 'cat lisez-moi.txt affiche le fichier');
    await page.fill('#command', 'chercher bienvenue');
    await page.press('#command', 'Enter');
    await page.waitForTimeout(300);
    check((await page.locator('.output mark').count()) > 0, 'chercher : mots surlignés');
    await page.click('.key:has-text("DOSSIERS")');
    await page.waitForTimeout(300);
    check((await page.locator('.output ul.grid').count()) > 0, 'touche DOSSIERS : liste affichée');
    const cartridgeCount = await page.locator('button.cartridge').count();
    if (cartridgeCount) {
      const cartridgeName = (await page.locator('button.cartridge b').first().textContent()).trim();
      await page.locator('button.cartridge').first().click();
      await page.waitForTimeout(300);
      const shown = (await page.textContent('.output')).toLowerCase();
      check(shown.includes('> ' + withoutAccents(cartridgeName).slice(0, 4)), `cartouche ${cartridgeName} : résumé affiché`);
    } else {
      check((await page.locator('.empty-message').count()) === 1, 'sans projet : message pour ajouter la première cartouche');
    }
    const paletteBefore = await page.getAttribute('main.deck', 'data-palette');
    await page.click('button[aria-label="Changer la couleur du boîtier"]');
    await page.waitForTimeout(200);
    check((await page.getAttribute('main.deck', 'data-palette')) !== paletteBefore, 'touche couleur : la coque change');
    // Keyboard trap: Tab with nothing to complete must leave the field.
    await page.fill('#command', 'zzz');
    await page.focus('#command');
    await page.keyboard.press('Tab');
    check((await page.evaluate(() => document.activeElement && document.activeElement.id)) !== 'command', 'Tab sans complétion : le focus sort du champ');
  }
  await page.addScriptTag({ content: AXE_SOURCE });
  const axeResult = await page.evaluate(async () => await window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] }));
  check(axeResult.violations.length === 0, `${deviceName} : axe-core WCAG 2.1 AA, ${axeResult.violations.length} violation(s)`);
  for (const violation of axeResult.violations) {
    console.log(`   - ${violation.id} (${violation.impact}) : ${violation.help} · ${violation.nodes.length} élément(s) · ${violation.nodes[0].target.join(' ')}`);
  }
  await page.close();
}
check(errors.length === 0, `aucune erreur JavaScript${errors.length ? ' : ' + errors.join(' | ') : ''}`);
await browser.close();
if (failureCount) process.exit(1);
