// End-to-end checks against the production build, in headless Chromium.
// Run `pnpm build` first. Uses the real jsCoq engine for the paste-mode checks.
import { preview } from 'vite';
import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const server = await preview({ preview: { port: 0 }, logLevel: 'error' });
const base = server.resolvedUrls.local[0];
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
const errors = [];
const open = async (hash) => {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.on('pageerror', (e) => errors.push(`${hash}: ${e.message}`));
  page.on('console', (m) => m.type() === 'error' && errors.push(`${hash}: ${m.text()}`));
  await page.goto(base + hash);
  return page;
};
const ok = (name) => console.log('✓', name);

// 1. Stepper on a recorded example: highlighting follows the step.
{
  const p = await open('#/ex/split/1');
  assert.equal(await p.locator('.sent.current').innerText(), 'intros P Q p q.');
  assert.equal(await p.locator('.sent.past').count(), 2, 'statement and Proof. are step 0');
  await p.click('text=Next →');
  assert.equal(await p.locator('.sent.current').innerText(), 'split.');
  assert.match(await p.locator('pre.term').innerText(), /conj \?Goal \?Goal0/);
  assert.equal(await p.locator('pre.term .tm.new:not(.hole)').first().innerText(), 'conj');
  assert.equal(await p.locator('pre.term .tm.hole').count(), 2);
  assert.equal(await p.locator('.goal').count(), 2, 'one open goal per hole');
  assert.equal(await p.locator('.sent.future').count() > 0, true);
  await p.keyboard.press('ArrowRight');
  assert.equal(await p.locator('.sent.current').innerText(), '-');
  await p.keyboard.press('End');
  assert.match(await p.locator('.qed').innerText(), /the kernel checks/);
  assert.match(await p.locator('.qed').innerText(), /Closed under the global context/);
  ok('stepper highlights, holes, goals, keyboard, Qed view');

  await p.goto(base + '#/ex/revert/2');
  assert.match(await p.locator('pre.term').innerText(), /\?Goal n\)/);
  assert.equal(await p.locator('pre.term .tm.new:not(.hole)').allInnerTexts().then((a) => a.join('')), 'n');
  await p.click('.seg:has-text("Raw")');
  assert.match(await p.locator('pre.term.raw').innerText(), /^\(fun n : nat => \?Goal n\)$/);
  ok('revert is a hole applied to n, raw view is Coq text');

  await p.goto(base + '#/ex/induction/7');
  await p.click('.seg:has-text("Induction tree")');
  await p.waitForSelector('.ih-arrow', { state: 'attached' });
  assert.match(await p.locator('.ind').innerText(), /nat_ind/);
  assert.equal(await p.locator('.ind .node.case').count(), 2);
  ok('induction tree with IH arrow');

  await p.hover('.sent.current');
  await p.waitForSelector('.card');
  assert.match(await p.locator('.card').innerText(), /builds/i);
  ok('hover card');
  await p.close();
}

// 1b. Titles follow the route, play advances, skip link keeps the route, autoplay stops on manual step.
{
  const p = await open('#/ex/apply/0');
  assert.match(await p.title(), /Applying a hypothesis: apply H · step 1\/6/);
  await p.click('button:has-text("Play")');
  await p.waitForFunction(() => document.querySelector('.steplabel')?.textContent?.includes('Step 3'), null, { timeout: 15000 });
  await p.click('button:has-text("Pause")');
  assert.match(await p.locator('#live').innerText().catch(async () => await p.locator('#live').textContent()), /Step \d of 6/);
  await p.keyboard.press('Tab');
  await p.focus('.skip');
  await p.keyboard.press('Enter');
  assert.match(p.url(), /#\/ex\/apply\//);
  await p.goto(base + '#/gallery');
  assert.match(await p.title(), /Tactic gallery/);
  await p.close();
  ok('titles, play/pause, live region, skip link');
}

// 1c. Prerendered static pages exist and are indexable.
{
  const page = await browser.newPage();
  const res = await page.goto(base + 'tactics/split/');
  assert.equal(res.status(), 200);
  assert.match(await page.title(), /Proving a conjunction: split/);
  assert.equal(await page.locator('link[rel=canonical]').getAttribute('href'), 'https://stijnris.github.io/rocq-proof-term-stepper/tactics/split/');
  assert.match(await page.locator('ol.steps').innerText(), /conj \?Goal \?Goal0/);
  assert.ok((await page.locator('script[type="application/ld+json"]').count()) === 1);
  const sm = await (await page.goto(base + 'sitemap.xml')).text();
  assert.ok((sm.match(/<loc>/g) ?? []).length >= 19);
  assert.equal((await page.goto(base + 'robots.txt')).status(), 200);
  assert.equal((await page.goto(base + 'og.png')).status(), 200);
  await page.close();
  ok('prerendered pages, sitemap, robots, og image');
}

// 2. Gallery lists one card per example.
{
  const p = await open('#/gallery');
  assert.ok((await p.locator('.gcard').count()) >= 17);
  await p.locator('.gcard').nth(5).locator('button').click();
  await p.waitForSelector('.cols');
  assert.match(page_hash(p), /#\/ex\//);
  await p.close();
  ok('gallery');
}
function page_hash(p) {
  return p.url().slice(p.url().indexOf('#'));
}

// 3. Paste mode with the real engine: run a new script and an erroring one.
{
  const p = await open('#/paste');
  await p.fill('textarea.editor', `Theorem t : forall P : Prop, P -> P /\\ P.\nProof.\n  intros P p.\n  split.\n  - exact p.\n  - assumption.\nQed.`);
  await p.click('text=Run in Coq');
  await p.waitForSelector('.stepper', { timeout: 180_000 });
  assert.match(await p.locator('.blurb').innerText(), /Coq 8\.17/);
  await p.keyboard.press('End');
  assert.match(await p.locator('.qed').innerText(), /t\n?: forall P : Prop, P -> P \/\\ P/);
  ok('paste mode runs real Coq and reaches Qed');

  await p.click('text=Edit');
  await p.fill('textarea.editor', `Theorem t : forall P : Prop, P -> P.\nProof.\n  intros P p.\n  exac p.\nQed.`);
  await p.click('text=Run in Coq');
  await p.waitForSelector('.errbox', { timeout: 180_000 });
  assert.match(await p.locator('.errbox').innerText(), /exac/);
  ok('paste mode shows Coq errors');

  // A second run in the same page reuses the engine (reset works).
  await p.click('text=Edit');
  await p.fill('textarea.editor', `Theorem u : 1 + 1 = 2.\nProof.\n  reflexivity.\nQed.`);
  await p.click('text=Run in Coq');
  await p.waitForSelector('.stepper', { timeout: 60_000 });
  assert.match(await p.locator('pre.term').first().innerText(), /\?Goal|eq_refl/);
  ok('paste mode: second run in the same session');
  await p.close();
}

// 4. Library switch: Require Import Arith needs the bigger bundle.
{
  const p = await open('#/paste');
  await p.selectOption('select:not(.examples)', 'arith');
  await p.fill('textarea.editor', `Require Import Arith.\nTheorem w : forall n : nat, n + 0 = n.\nProof.\n  intros n.\n  rewrite Nat.add_0_r.\n  reflexivity.\nQed.`);
  await p.click('text=Run in Coq');
  await p.waitForSelector('.stepper', { timeout: 240_000 });
  await p.keyboard.press('End');
  assert.match(await p.locator('.qed').innerText(), /the kernel checks/);
  await p.close();
  ok('paste mode with Arith library');
}

await browser.close();
await server.close();
assert.deepEqual(errors, [], `console errors:\n${errors.join('\n')}`);
console.log('all e2e checks passed');
