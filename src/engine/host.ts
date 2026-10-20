/**
 * Hosts the jsCoq bundle (Coq 8.17 compiled by js_of_ocaml) on the page's main
 * thread.
 *
 * Why not a Web Worker: the js_of_ocaml bundle needs more stack to start than
 * browsers give dedicated workers (about 512 KB in Chromium), so
 * `new Worker(".../jscoq_worker.bc.js")` dies with "Maximum call stack size
 * exceeded". When the bundle is not inside a WorkerGlobalScope it instead
 * publishes a `jsCoq` object with `postMessage` (commands in) and `onmessage`
 * (events out), which is what we use. Coq runs synchronously, so the page
 * freezes briefly during a command; our proofs are tiny.
 */
export type WorkerMsg = unknown[];

interface JsCoqPort {
  postMessage(msg: unknown): void;
  onmessage: (msg: WorkerMsg) => void;
}

export class WorkerHost {
  private port!: JsCoqPort;
  onMessage: (msg: WorkerMsg) => void = () => {};

  static async create(scriptUrl: string): Promise<WorkerHost> {
    const h = new WorkerHost();
    await h.boot(scriptUrl);
    return h;
  }

  private async boot(scriptUrl: string) {
    const g = globalThis as any;
    // Coq plugins (.cma.js) are pulled in with importScripts; emulate it.
    g.importScripts ??= (...urls: string[]) => {
      for (const u of urls) {
        const x = new XMLHttpRequest();
        x.open('GET', new URL(u, scriptUrl).href, false);
        x.send();
        if (x.status !== 200) throw new Error(`importScripts failed: ${u}`);
        (0, eval)(x.responseText);
      }
    };
    const text = await (await fetch(scriptUrl)).text();
    (0, eval)(text);
    this.port = g.jsCoq;
    if (!this.port) throw new Error('jsCoq bundle did not publish its port');
    this.port.onmessage = (m) => this.onMessage(m);
  }

  send(msg: unknown[]) {
    this.port.postMessage(msg);
  }
}
