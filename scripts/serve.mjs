// Minimal static file server (for the e2e run and `pnpm start`). Usage: node scripts/serve.mjs <dir> [basePath]
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.txt': 'text/plain', '.xml': 'application/xml', '.webmanifest': 'application/manifest+json', '.coq-pkg': 'application/zip' };

export function serve(dir, base = '/rocq-proof-term-stepper', port = 0) {
  const server = createServer(async (req, res) => {
    let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (path.startsWith(base)) path = path.slice(base.length) || '/';
    else {
      res.writeHead(404).end('outside base path');
      return;
    }
    let file = join(dir, normalize(path));
    try {
      if ((await stat(file)).isDirectory()) file = join(file, 'index.html');
    } catch {}
    try {
      const body = await readFile(file);
      res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' }).end(body);
    } catch {
      try {
        res.writeHead(404, { 'content-type': 'text/html' }).end(await readFile(join(dir, '404.html')));
      } catch {
        res.writeHead(404).end('not found');
      }
    }
  });
  return new Promise((r) => server.listen(port, () => r({ server, url: `http://localhost:${server.address().port}${base}/` })));
}

if (process.argv[1].endsWith('serve.mjs')) {
  const { url } = await serve(process.argv[2] ?? 'out', undefined, 3000);
  console.log('serving', url);
}
