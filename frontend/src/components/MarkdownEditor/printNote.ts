import DOMPurify from 'dompurify';
import { renderMarkdownDocument } from '../../lib/markdown';
import { renderMermaid } from '../../lib/mermaid';

export async function printNote(title: string, content: string) {
  const target = window.open('', '_blank');
  if (!target) throw new Error('Permite ventanas emergentes para imprimir la nota.');
  target.document.title = title;
  target.document.body.textContent = 'Preparando nota…';
  const result = renderMarkdownDocument(content);
  const article = target.document.createElement('article');
  article.className = 'markdown-reading';
  article.innerHTML = DOMPurify.sanitize(result.html);
  await Promise.all(result.diagrams.map(async diagram => {
    const host = article.querySelector('[data-mermaid-index="' + diagram.index + '"]');
    if (!host) return;
    try { host.innerHTML = await renderMermaid(diagram.code); }
    catch { const pre = target.document.createElement('pre'); pre.textContent = diagram.code; host.replaceChildren(pre); }
  }));
  if (target.closed) return;
  for (const style of document.querySelectorAll('style, link[rel="stylesheet"]')) target.document.head.append(style.cloneNode(true));
  const style = target.document.createElement('style');
  style.textContent = 'body{padding:32px;background:white!important;color:#111!important;--fg:#111;--muted:#555;--border:#ccc;--surface:#f4f4f4;--accent:#2557a7;max-width:900px;margin:auto}.markdown-reading{color:#111}.markdown-reading svg{max-width:100%;height:auto}.markdown-reading pre{white-space:pre-wrap}';
  target.document.head.append(style);
  const heading = target.document.createElement('h1'); heading.textContent = title;
  target.document.body.replaceChildren(heading, article);
  await target.document.fonts.ready;
  target.focus();
  setTimeout(() => { if (!target.closed) target.print(); }, 300);
}
