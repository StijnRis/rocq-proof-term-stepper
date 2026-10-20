// Dev helper: screenshots of the built app (run `pnpm build` first).
import { preview } from 'vite';
import { chromium } from 'playwright';

const server = await preview({ preview: { port: 0 }, logLevel: 'error' });
const base = server.resolvedUrls.local[0];
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
const out = process.env.SHOTS ?? '.scratch/shots';
const jobs = JSON.parse(process.argv[2] ?? '[]'); // [{name, hash, w, h, scheme, click}]
for (const j of jobs) {
  const page = await browser.newPage({ viewport: { width: j.w ?? 1280, height: j.h ?? 900 }, colorScheme: j.scheme ?? 'light' });
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  await page.goto(base + (j.hash ?? ''));
  await page.waitForTimeout(400);
  for (const sel of j.click ?? []) await page.click(sel);
  if (j.hover) await page.hover(j.hover);
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${out}/${j.name}.png`, fullPage: j.full ?? false });
  console.log(j.name, errs.length ? 'ERRORS ' + errs.join(' | ') : 'ok');
  await page.close();
}
await browser.close();
await server.close();
