import DOMPurify from 'dompurify';
let engine: Promise<typeof import('mermaid')['default']> | undefined;
let sequence = 0;
let queue: Promise<unknown> = Promise.resolve();
function loadMermaid() {
  return engine ||= import('mermaid').then(({ default: mermaid }) => {
    mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: 'default', htmlLabels: false, suppressErrorRendering: true });
    return mermaid;
  }).catch(error => { engine = undefined; throw error; });
}
export function renderMermaid(code: string): Promise<string> {
  const task = queue.then(async () => {
    const mermaid = await loadMermaid();
    await document.fonts?.ready;
    const host = document.createElement('div');
    host.style.cssText = 'position:fixed;left:-100000px;top:0;width:1200px;visibility:hidden;pointer-events:none';
    document.body.append(host);
    try {
      const { svg } = await mermaid.render('note-mermaid-' + (++sequence), code, host);
      return DOMPurify.sanitize(svg, { USE_PROFILES: { svg: true, svgFilters: true } });
    } finally { host.remove(); }
  });
  queue = task.catch(() => undefined);
  return task;
}
