// End-to-end checks against the static export in ./out, in headless Chromium.
// Run `pnpm build` first. Uses the real jsCoq engine for the paste-mode checks.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { serve } from './serve.mjs';

const { server, url: base } = await serve('out');
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
const errors = [];
const open = async (path) => {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.on('pageerror', (e) => errors.push(`${path}: ${e.message}`));
  page.on('console', (m) => m.type() === 'error' && errors.push(`${path}: ${m.text()}`));
  await page.goto(base + path);
  await page.waitForSelector('.stepper, .editor, .gallery');
  return page;
};
const ok = (name) => console.log('✓', name);

// 1. Stepper: highlighting follows the step.
{
  const p = await open('tactics/split/#2');
  assert.equal(await p.locator('.sent.current').innerText(), 'intros P Q p q.');
  assert.equal(await p.locator('.sent.past').count(), 2, 'statement and Proof. are step 0');
  await p.click('text=Next →');
  assert.equal(await p.locator('.sent.current').innerText(), 'split.');
  assert.match(await p.locator('.term-panel pre.term').innerText(), /conj \?Goal \?Goal0/);
  assert.equal(await p.locator('.term-panel pre.term .tm.new:not(.hole)').first().innerText(), 'conj');
  assert.equal(await p.locator('.term-panel pre.term .tm.hole').count(), 2);
  assert.equal(await p.locator('.goal').count(), 2, 'one open goal per hole');
  assert.ok((await p.locator('.sent.future').count()) > 0);
  await p.keyboard.press('ArrowRight');
  assert.equal(await p.locator('.sent.current').innerText(), '-');
  await p.keyboard.press('End');
  assert.match(await p.locator('.qed').innerText(), /the kernel checks/);
  assert.match(await p.locator('.qed').innerText(), /Closed under the global context/);
  ok('stepper highlights, holes, goals, keyboard, Qed view');

  await p.goto(base + 'tactics/revert/#3');
  await p.waitForSelector('.term-panel pre.term');
  assert.match(await p.locator('.term-panel pre.term').innerText(), /\?Goal n\)/);
  assert.equal(await p.locator('.term-panel pre.term .tm.new:not(.hole)').allInnerTexts().then((a) => a.join('')), 'n');
  await p.click('.seg:has-text("Raw")');
  assert.match(await p.locator('pre.term.raw').innerText(), /^\(fun n : nat => \?Goal n\)$/);
  ok('revert is a hole applied to n, raw view is Coq text');

  await p.goto(base + 'tactics/induction/#8');
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

// 2. Tactics overview, navigation and the example picker.
{
  const p = await open('tactics/');
  assert.ok((await p.locator('.gcard').count()) >= 17);
  await p.locator('.gcard').nth(5).locator('a').click();
  await p.waitForSelector('.stepper');
  assert.match(p.url(), /\/tactics\/[a-z-]+\/#\d+$/);
  await p.selectOption('#example-select', 'revert');
  await p.waitForURL(/tactics\/revert\//);
  await p.close();
  ok('tactics overview and example picker');
}

// 3. SEO: static HTML contains the content, metadata is per page.
{
  const html = await (await fetch(base + 'tactics/split/')).text();
  assert.match(html, /<title>Proving a conjunction: split in Rocq \(Coq\)/);
  assert.match(html, /<link rel="canonical" href="https:\/\/stijnris\.github\.io\/rocq-proof-term-stepper\/tactics\/split\/"/);
  assert.match(html, /<meta property="og:title" content="Proving a conjunction: split in Rocq \(Coq\)"/);
  assert.match(html, /conj/);
  assert.match(html, /application\/ld\+json/);
  const sm = await (await fetch(base + 'sitemap.xml')).text();
  assert.ok((sm.match(/<loc>/g) ?? []).length >= 20);
  assert.equal((await fetch(base + 'robots.txt')).status, 200);
  assert.equal((await fetch(base + 'og.png')).status, 200);
  assert.equal((await fetch(base + 'nope/')).status, 404);
  ok('static HTML, metadata, sitemap, robots, og image, 404');
}

// 4. Paste mode with the real engine: run a new script, an erroring one, a second run.
{
  const p = await open('paste/');
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

  await p.click('text=Edit');
  await p.fill('textarea.editor', `Theorem u : 1 + 1 = 2.\nProof.\n  reflexivity.\nQed.`);
  await p.click('text=Run in Coq');
  await p.waitForSelector('.stepper', { timeout: 60_000 });
  ok('paste mode: second run in the same session');
  await p.close();
}

// 5. Library switch: Require Import Arith needs the bigger bundle.
{
  const p = await open('paste/');
  await p.selectOption('select[aria-label=Libraries]', 'arith');
  await p.fill('textarea.editor', `Require Import Arith.\nTheorem w : forall n : nat, n + 0 = n.\nProof.\n  intros n.\n  rewrite Nat.add_0_r.\n  reflexivity.\nQed.`);
  await p.click('text=Run in Coq');
  await p.waitForSelector('.stepper', { timeout: 240_000 });
  await p.keyboard.press('End');
  assert.match(await p.locator('.qed').innerText(), /the kernel checks/);
  await p.close();
  ok('paste mode with Arith library');
}

await browser.close();
server.close();
assert.deepEqual(errors, [], `console errors:\n${errors.join('\n')}`);
console.log('all e2e checks passed');
