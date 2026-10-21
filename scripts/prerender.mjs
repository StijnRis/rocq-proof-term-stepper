// Post-build step: writes static, crawlable HTML into dist/ (run after `vite build`).
//   dist/tactics/index.html          overview of every tactic
//   dist/tactics/<id>/index.html     one page per example with the real recorded terms
//   dist/sitemap.xml, dist/404.html
// The content comes from the same recorded Coq traces the app uses.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'vite';
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from './site.mjs';

const server = await createServer({ logLevel: 'error', server: { middlewareMode: true }, appType: 'custom' });
const { EXAMPLES } = await server.ssrLoadModule('/src/data/examples.ts');
const { tacticInfo } = await server.ssrLoadModule('/src/data/tactics.ts');
const { analyze } = await server.ssrLoadModule('/src/core/analyze.ts');
await server.close();
const gallery = JSON.parse(readFileSync('src/data/gallery.json', 'utf8'));

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const trunc = (s, n) => (s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s);

/** Term text with built fragment and holes marked, as in the app. */
function termHtml(view) {
  const p = view.parsed;
  if (!p) return esc((view.step.term ?? []).map((s) => s.t).join(''));
  let out = '';
  let pos = 0;
  p.tokens.forEach((t, i) => {
    const gap = p.text.slice(pos, t.start);
    const prev = p.tokens[i - 1];
    const joined = gap && prev && view.marks.has(prev.id) && view.marks.has(t.id) && prev.kind !== 'hole' && t.kind !== 'hole';
    out += joined ? `<span class="new">${esc(gap)}</span>` : esc(gap);
    const cls = [t.kind === 'hole' ? 'hole' : '', view.marks.has(t.id) && t.kind !== 'hole' ? 'new' : ''].filter(Boolean).join(' ');
    out += cls ? `<span class="${cls}">${esc(t.text)}</span>` : esc(t.text);
    pos = t.end;
  });
  return out + esc(p.text.slice(pos));
}

function shell({ path, title, description, body, ld }) {
  const url = SITE_URL + path;
  const root = path.split('/').filter(Boolean).map(() => '..').join('/') || '.';
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}" />
<link rel="canonical" href="${url}" />
<meta name="theme-color" content="#0b8a7d" />
<meta property="og:type" content="article" />
<meta property="og:site_name" content="${SITE_NAME}" />
<meta property="og:title" content="${esc(title)}" />
<meta property="og:description" content="${esc(description)}" />
<meta property="og:url" content="${url}" />
<meta property="og:image" content="${SITE_URL}og.png" />
<meta name="twitter:card" content="summary_large_image" />
<link rel="icon" type="image/svg+xml" href="${root}/favicon.svg" />
<link rel="stylesheet" href="${root}/static.css" />
${ld ? `<script type="application/ld+json">${JSON.stringify(ld)}</script>` : ''}
</head>
<body>
<div class="wrap">
<header class="topbar"><a class="brand" href="${root}/">λ ${SITE_NAME}</a><nav aria-label="Main"><a href="${root}/">Stepper</a><a href="${root}/tactics/">Tactics</a><a href="${root}/#/gallery">Gallery</a><a href="${root}/#/paste">Paste your own</a></nav></header>
<main>
${body}
</main>
<footer class="site">Terms are real <code>Show Proof.</code> output of Coq 8.17.1 (jsCoq), recorded in the repository. <a href="https://github.com/StijnRis/rocq-proof-term-stepper">Source on GitHub</a>.</footer>
</div>
</body>
</html>
`;
}

const write = (path, html) => {
  const file = path.endsWith('.html') ? `dist/${path}` : `dist/${path}index.html`;
  mkdirSync(file.replace(/\/[^/]*$/, ''), { recursive: true });
  writeFileSync(file, html);
};

const urls = [''];
const cards = [];

for (const ex of EXAMPLES) {
  const trace = gallery[ex.id];
  if (!trace) continue;
  const focusIdx = Math.max(0, trace.steps.findIndex((s) => s.kind === 'tactic' && new RegExp(ex.focus.source).test(s.text)));
  const info = tacticInfo(trace.steps[focusIdx]?.text ?? ex.tactic);
  const views = trace.steps.map((_, i) => analyze(trace, i));
  const focusBuilt = views[focusIdx]?.built;
  const path = `tactics/${ex.id}/`;
  urls.push(path);
  cards.push({ ex, path });

  const steps = views
    .map((v) => {
      const s = v.step;
      if (s.kind === 'qed') {
        const q = s.qed;
        return `<li><code>${esc(s.text)}</code> The kernel type-checks the finished term against the statement.${q?.check ? `<pre><code>${esc(q.check)}</code></pre>` : ''}${q?.assumptions ? `<p class="muted">Print Assumptions: ${esc(q.assumptions)}</p>` : ''}</li>`;
      }
      if (s.kind === 'error') return `<li><code>${esc(s.text)}</code> Coq reports: ${esc(s.error ?? '')}</li>`;
      const what =
        s.kind === 'start'
          ? 'Starts with a single hole whose type is the statement.'
          : v.built
            ? `Built <code class="new">${esc(trunc(v.built, 200))}</code>.`
            : 'Builds no new structure.';
      return `<li><code>${esc(trunc(s.text, 120))}</code> ${what}<pre><code>${termHtml(v)}</code></pre>${s.holes.length ? `<p class="muted">${s.holes.length} open ${s.holes.length === 1 ? 'goal' : 'goals'}: ${s.holes.map((h) => `<span class="hole">${esc(h.name)}</span>`).join(' ')}</p>` : '<p class="muted">No holes left: the term is complete.</p>'}</li>`;
    })
    .join('\n');

  const title = `${ex.title}: ${ex.tactic} in Rocq (Coq)`;
  const description = trunc(`${ex.blurb} Step-by-step example with the real Show Proof output${focusBuilt ? `: ${focusBuilt}` : ''}.`, 158);
  const others = EXAMPLES.filter((e) => e.id !== ex.id)
    .map((e) => `<li><a href="../${e.id}/">${esc(e.tactic)}</a> <span class="muted">${esc(e.title)}</span></li>`)
    .join('');
  const body = `<h1>${esc(ex.title)}: <code>${esc(ex.tactic)}</code> in Rocq (Coq)</h1>
<p class="lead">${esc(ex.blurb)}</p>
${info ? `<p>General shape: <code>${esc(info.builds)}</code>. ${esc(info.note)}</p>` : ''}
<a class="cta" href="../../#/ex/${ex.id}/${focusIdx}">Step through this proof interactively →</a>
<h2>The script</h2>
<pre><code>${esc(ex.script)}</code></pre>
<h2>Step by step: the proof term after each sentence</h2>
<p class="muted">Recorded from Coq with <code>Show Proof.</code> after every sentence. <span class="new">Teal</span> is what the sentence built; <span class="hole">?Goal</span> pills are holes still to fill.</p>
<ol class="steps">
${steps}
</ol>
<h2>Other tactics</h2>
<ul>${others}</ul>`;
  write(
    path,
    shell({
      path,
      title,
      description,
      body,
      ld: {
        '@context': 'https://schema.org',
        '@type': 'TechArticle',
        headline: title,
        description,
        inLanguage: 'en',
        url: SITE_URL + path,
        about: ['Rocq', 'Coq', 'proof term', ex.tactic],
        isPartOf: { '@type': 'WebSite', name: SITE_NAME, url: SITE_URL },
      },
    }),
  );
}

// Overview page.
write(
  'tactics/',
  shell({
    path: 'tactics/',
    title: 'Rocq (Coq) tactics and the proof terms they build',
    description: trunc('One example per Rocq tactic with the real proof term it builds: intro, apply, exact, reflexivity, destruct, induction, split, left, right, assert, rewrite, assumption, discriminate, revert, exists.', 158),
    body: `<h1>Rocq (Coq) tactics and the proof terms they build</h1>
<p class="lead">${esc(SITE_DESCRIPTION)}</p>
<ul class="grid">${cards.map(({ ex, path }) => `<li><a href="../${path}"><strong>${esc(ex.tactic)}</strong><small>${esc(ex.title)}</small></a></li>`).join('')}</ul>`,
  }),
);
urls.push('tactics/');

// Sitemap, 404.
const today = new Date().toISOString().slice(0, 10);
writeFileSync(
  'dist/sitemap.xml',
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${SITE_URL}${u}</loc><lastmod>${today}</lastmod></url>`).join('\n')}\n</urlset>\n`,
);
writeFileSync(
  'dist/404.html',
  shell({
    path: '404.html',
    title: 'Page not found · ' + SITE_NAME,
    description: 'This page does not exist.',
    body: `<h1>Page not found</h1><p class="lead">That page does not exist.</p><p><a class="cta" href="../">Open the stepper</a> <a href="../tactics/">Browse the tactics</a></p>`,
  }).replace(/<link rel="canonical"[^>]*>\n/, '<meta name="robots" content="noindex" />\n').replace(/(href|src)="\.\.?\//g, `$1="${SITE_URL}`),
);
console.log(`prerendered ${urls.length} pages + sitemap + 404`);
