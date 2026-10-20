type Kid = Node | string | null | undefined | false;

/** Tiny hyperscript helper: h('div', {class: 'x', onclick: fn}, child, 'text'). */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props?: Record<string, unknown> | null,
  ...kids: Kid[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props ?? {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v as EventListener);
    else if (k === 'class') el.className = String(v);
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, String(v));
  }
  for (const kid of kids) {
    if (kid === null || kid === undefined || kid === false) continue;
    el.append(typeof kid === 'string' ? document.createTextNode(kid) : kid);
  }
  return el;
}

export const clear = (el: Element) => el.replaceChildren();
