import { reactive } from 'vue';
import { useDocumentStore } from '../stores/useDocumentStore';

// Solo tipos que renderizan el contenteditable genérico `.block-editor`
// (BlockRenderer.vue, rama `v-else`) — table/code/math/image tienen su
// propio DOM y quedan fuera de esta primera versión.
const SEARCHABLE_TYPES = ['paragraph', 'h1', 'h2', 'h3', 'quote', 'bulleted-list', 'numbered-list', 'checkbox', 'toggle'];

interface Match {
  blockId: string;
  start: number;
  end: number;
}

const escapeRegExp = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function useFindReplace() {
  const store = useDocumentStore();

  const state = reactive({
    visible: false,
    query: '',
    replaceQuery: '',
    matches: [] as Match[],
    currentIndex: -1,
  });

  const flattenSearchable = (blocks = store.blocks): string[] => {
    const ids: string[] = [];
    for (const b of blocks) {
      if (SEARCHABLE_TYPES.includes(b.type)) ids.push(b.id);
      if (b.children) ids.push(...flattenSearchable(b.children));
    }
    return ids;
  };

  // Offset de texto plano -> nodo de texto real + offset dentro de ese nodo,
  // mismo patrón que restoreCaret (useDocumentStore.ts).
  const locate = (el: HTMLElement, charOffset: number): { node: Text; offset: number } | null => {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let remaining = charOffset;
    while (walker.nextNode()) {
      const node = walker.currentNode as Text;
      const len = node.textContent?.length || 0;
      if (remaining <= len) return { node, offset: remaining };
      remaining -= len;
    }
    return null;
  };

  const rangeFor = (match: Match): Range | null => {
    const el = document.getElementById(`block-${match.blockId}`);
    if (!el) return null;
    const startPos = locate(el, match.start);
    const endPos = locate(el, match.end);
    if (!startPos || !endPos) return null;
    const range = document.createRange();
    range.setStart(startPos.node, startPos.offset);
    range.setEnd(endPos.node, endPos.offset);
    return range;
  };

  // Rangos [start, end) (en offsets de texto plano, mismo espacio que
  // locate/rangeFor) de los spans decorados por decorateInline: wiki-link,
  // tag-link, inline-math.
  const DECORATED_SELECTOR = '.wiki-link, .tag-link, .inline-math';
  const getDecoratedRanges = (el: HTMLElement): { start: number; end: number }[] => {
    const ranges: { start: number; end: number }[] = [];
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let offset = 0;
    let node: Node | null;
    while ((node = walker.nextNode())) {
      const len = node.textContent?.length || 0;
      const decorated = (node.parentElement)?.closest(DECORATED_SELECTOR);
      if (decorated) {
        const last = ranges[ranges.length - 1];
        if (last && last.end === offset) last.end = offset + len;
        else ranges.push({ start: offset, end: offset + len });
      }
      offset += len;
    }
    return ranges;
  };

  // Un match es seguro de reemplazar si, para cada span decorado, cae
  // enteramente fuera de él o enteramente dentro (reemplazar el span
  // completo también es seguro: Range.deleteContents lo borra entero).
  // Es INSEGURO si cruza justo un borde: dejaría el span con un fragmento
  // de "[[nota" o "#etiq" o LaTeX a medio texto en block.content.
  const crossesDecoratedBoundary = (el: HTMLElement, start: number, end: number): boolean =>
    getDecoratedRanges(el).some(({ start: s, end: e }) => {
      const overlaps = start < e && end > s;
      if (!overlaps) return false;
      const fullyInside = start >= s && end <= e;
      const fullyCovers = start <= s && end >= e;
      return !fullyInside && !fullyCovers;
    });

  const search = (): void => {
    state.matches = [];
    state.currentIndex = -1;
    const query = state.query;
    if (!query) return;

    const re = new RegExp(escapeRegExp(query), 'gi');
    for (const id of flattenSearchable()) {
      const el = document.getElementById(`block-${id}`);
      if (!el) continue;
      const text = el.textContent || '';
      let m: RegExpExecArray | null;
      while ((m = re.exec(text))) {
        const start = m.index;
        const end = m.index + m[0].length;
        // Match a caballo entre texto normal y un [[wikilink]]/#tag/$fórmula$:
        // se excluye para no corromper el span al reemplazar.
        if (crossesDecoratedBoundary(el, start, end)) continue;
        state.matches.push({ blockId: id, start, end });
      }
    }
    if (state.matches.length) goTo(0);
  };

  // Resaltado efímero: selección nativa del navegador sobre el match, sin
  // tocar block.content ni disparar saveSnapshot.
  const goTo = (index: number): void => {
    if (!state.matches.length) return;
    const n = state.matches.length;
    state.currentIndex = ((index % n) + n) % n;
    const range = rangeFor(state.matches[state.currentIndex]);
    if (!range) return;
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
    range.startContainer.parentElement?.closest('[id^="block-"]')?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  };

  const next = (): void => goTo(state.currentIndex + 1);
  const prev = (): void => goTo(state.currentIndex - 1);

  // Reemplazo real: pasa por store.updateBlock, sí queda en el historial de undo.
  const replaceCurrent = (): void => {
    if (state.currentIndex < 0 || !state.matches.length) return;
    const match = state.matches[state.currentIndex];
    const el = document.getElementById(`block-${match.blockId}`);
    const range = rangeFor(match);
    if (!el || !range) return;

    range.deleteContents();
    if (state.replaceQuery) range.insertNode(document.createTextNode(state.replaceQuery));
    el.normalize();
    store.updateBlock(match.blockId, { content: el.innerHTML });

    const keepIndex = state.currentIndex;
    search();
    if (state.matches.length) goTo(Math.min(keepIndex, state.matches.length - 1));
  };

  // Reemplazar todo: mutación directa (bypass updateBlock) + un solo
  // saveSnapshot al final, mismo cuidado que store.deleteBlocks().
  const replaceAll = (): void => {
    if (!state.matches.length) return;
    const byBlock = new Map<string, Match[]>();
    for (const m of state.matches) {
      if (!byBlock.has(m.blockId)) byBlock.set(m.blockId, []);
      byBlock.get(m.blockId)!.push(m);
    }

    for (const [blockId, matchesInBlock] of byBlock) {
      const el = document.getElementById(`block-${blockId}`);
      if (!el) continue;
      // De atrás para adelante: así el reemplazo no corre los offsets de los matches previos.
      const sorted = [...matchesInBlock].sort((a, b) => b.start - a.start);
      for (const m of sorted) {
        const range = rangeFor(m);
        if (!range) continue;
        range.deleteContents();
        if (state.replaceQuery) range.insertNode(document.createTextNode(state.replaceQuery));
      }
      el.normalize();
      const block = store._findBlock(store.blocks, blockId);
      if (block) block.content = el.innerHTML;
    }

    store.saveSnapshot();
    search();
  };

  const open = (): void => {
    state.visible = true;
  };

  const close = (): void => {
    state.visible = false;
    state.query = '';
    state.replaceQuery = '';
    state.matches = [];
    state.currentIndex = -1;
    window.getSelection()?.removeAllRanges();
  };

  return { state, search, next, prev, replaceCurrent, replaceAll, open, close };
}
