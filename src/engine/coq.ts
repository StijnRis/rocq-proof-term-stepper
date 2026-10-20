import { unzipSync } from 'fflate';
import { WorkerHost, type WorkerMsg } from './host';
import type { Pp } from './pp';

/**
 * Minimal client for the jsCoq protocol (see node_modules/jscoq/backend/coq-worker.ts
 * for the reference implementation we mirror): load library archives into the
 * worker's virtual file system, `Init`, then `Add`/`Exec` one sentence at a time.
 */

export interface CoqMessage {
  level: string; // Debug | Info | Notice | Warning | Error
  pp: Pp;
}

export interface ExecResult {
  ok: boolean;
  messages: CoqMessage[];
  error?: Pp;
}

export interface RawHyp {
  names: string[];
  body: Pp | null;
  type: Pp;
}
export interface RawGoal {
  hyps: RawHyp[]; // newest first, as Coq stores them
  ty: Pp;
}

interface Waiter<T> {
  resolve: (v: T) => void;
}

export interface CoqOptions {
  /** URL prefix where jscoq_worker.bc.js and *.coq-pkg live. */
  base: string;
  /** Library bundles to load, e.g. ['init'] or ['init', 'coq-base']. */
  packages?: string[];
  onStatus?: (s: string) => void;
}

const SENTENCE_TIMEOUT_MS = 60_000;

export class Coq {
  version = '';
  private host!: WorkerHost;
  private ready = new Waiter0<number>();
  private nextSid = 0;
  private tip = 0;
  private firstSid = 0;
  private chainStart?: number;

  private added = new Set<number>();
  private processed = new Set<number>();
  private messages = new Map<number, CoqMessage[]>();
  private errors = new Map<number, Pp>();
  private lastError?: Pp;
  private goalWaiter?: Waiter<RawGoal[] | null>;
  private waiters: (() => void)[] = [];

  static async create(opts: CoqOptions): Promise<Coq> {
    const c = new Coq();
    await c.boot(opts);
    return c;
  }

  private notify() {
    for (const w of this.waiters.splice(0)) w();
  }

  private async until(cond: () => boolean, what: string): Promise<void> {
    if (cond()) return;
    await new Promise<void>((resolve, reject) => {
      const t = setTimeout(() => reject(new Error(`Timed out waiting for ${what}`)), SENTENCE_TIMEOUT_MS);
      const check = () => {
        if (cond()) {
          clearTimeout(t);
          resolve();
        } else this.waiters.push(check);
      };
      this.waiters.push(check);
    });
  }

  private onMessage = (m: WorkerMsg) => {
    switch (m[0]) {
      case 'CoqInfo':
        this.version = String(m[1]).split('\n')[0];
        break;
      case 'Ready':
        this.ready.resolve(m[1] as number);
        break;
      case 'Added':
        this.added.add(m[1] as number);
        break;
      case 'Feedback': {
        const fb = m[1] as { span_id: number; contents: unknown[] };
        const kind = fb.contents[0];
        if (kind === 'Processed') this.processed.add(fb.span_id);
        else if (kind === 'Message') {
          const [, level, , pp] = fb.contents as [string, string[], unknown, Pp];
          const list = this.messages.get(fb.span_id) ?? [];
          list.push({ level: level[0], pp });
          this.messages.set(fb.span_id, list);
          if (level[0] === 'Error') {
            this.errors.set(fb.span_id, pp);
            this.lastError = pp;
          }
        }
        break;
      }
      case 'CoqExn': {
        const e = m[1] as { pp: Pp; sids?: number[] };
        this.lastError = e.pp;
        for (const s of e.sids ?? []) this.errors.set(s, e.pp);
        break;
      }
      case 'GoalInfo': {
        const g = m[2] as { goals: { ty: Pp; hyp: [{ 0: string; 1: string }[], Pp | null, Pp][] }[] } | null;
        this.goalWaiter?.resolve(
          g
            ? g.goals.map((goal) => ({
                ty: goal.ty,
                hyps: goal.hyp.map(([ids, body, type]) => ({
                  names: ids.map((id) => id[1]),
                  body,
                  type,
                })),
              }))
            : null,
        );
        break;
      }
      case 'Log':
      case 'LibProgress':
        break;
    }
    this.notify();
  };

  private async boot(opts: CoqOptions) {
    const status = opts.onStatus ?? (() => {});
    status('Starting Coq…');
    this.host = await WorkerHost.create(`${opts.base}jscoq_worker.bc.js`);
    this.host.onMessage = this.onMessage;

    const libPath: [string[], string[]][] = [];
    for (const pkg of opts.packages ?? ['init']) {
      status(`Loading library ${pkg}…`);
      const buf = await (await fetch(`${opts.base}${pkg}.coq-pkg`)).arrayBuffer();
      const files = unzipSync(new Uint8Array(buf));
      for (const [name, bytes] of Object.entries(files)) {
        this.host.send(['Put', `/lib/${name}`, bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)]);
      }
      const manifest = JSON.parse(new TextDecoder().decode(files['coq-pkg.json'])) as {
        modules: Record<string, unknown>;
      };
      const prefixes = new Set(Object.keys(manifest.modules).map((m) => m.replace(/[.][^.]+$/, '')));
      for (const p of prefixes) libPath.push([p.split('.'), ['/lib']]);
    }

    status('Initialising Coq…');
    this.host.send(['Init', { implicit_libs: false, coq_options: [], debug: { coq: false, stm: false }, lib_path: libPath }]);
    this.host.send(['NewDoc', { lib_init: ['Coq.Init.Prelude'] }]);
    this.tip = this.firstSid = await this.ready.promise;
    this.nextSid = this.tip + 1;
    status('Ready');
  }

  /** Runs one sentence on top of the current state. */
  async exec(sentence: string): Promise<ExecResult> {
    const sid = this.nextSid++;
    this.chainStart ??= sid;
    this.lastError = undefined;
    this.host.send(['Add', this.tip, sid, sentence, false]);
    await this.until(() => this.added.has(sid) || this.lastError !== undefined, `parse of «${sentence}»`);
    if (!this.added.has(sid)) return { ok: false, messages: [], error: this.lastError };
    this.host.send(['Exec', sid]);
    await this.until(() => this.processed.has(sid) || this.errors.has(sid), `«${sentence}»`);
    const messages = this.messages.get(sid) ?? [];
    const error = this.errors.get(sid);
    if (error) return { ok: false, messages, error };
    this.tip = sid;
    return { ok: true, messages };
  }

  /** Structured goals of the current state, or null outside proof mode. */
  async goals(): Promise<RawGoal[] | null> {
    return new Promise((resolve) => {
      this.goalWaiter = { resolve };
      this.host.send(['Query', this.tip, 0, ['Goals']]);
    });
  }

  /** Forgets every sentence run so far (back to the empty document). */
  reset() {
    if (this.chainStart !== undefined) {
      this.host.send(['Cancel', this.chainStart]);
      this.chainStart = undefined;
    }
    this.tip = this.firstSid;
  }
}

class Waiter0<T> {
  promise: Promise<T>;
  resolve!: (v: T) => void;
  constructor() {
    this.promise = new Promise((r) => (this.resolve = r));
  }
}
