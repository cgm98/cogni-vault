// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { createDocumentStore } from './useDocumentStore';
import type { Block } from '../../../Utils/markdownBlocks';

const block = (id: string): Block => ({ id, type: 'paragraph', content: id });

describe('moveBlock - drag & drop reorder', () => {
  it('soltar "después de C" en [A,B,C,D] arrastrando A da [B,C,A,D] (bug: off-by-one dejaba [B,C,D,A])', () => {
    const store = createDocumentStore();
    store.init([block('A'), block('B'), block('C'), block('D')]);

    // Igual que onDrop en useDragReorder.ts: targetIdx de C (=2) + 1 para dropPosition 'after'
    store.moveBlock('A', 2 + 1, null);

    expect(store.blocks.map(b => b.id)).toEqual(['B', 'C', 'A', 'D']);
  });

  it('soltar "antes de C" en [A,B,C,D] arrastrando A da [B,A,C,D]', () => {
    const store = createDocumentStore();
    store.init([block('A'), block('B'), block('C'), block('D')]);

    store.moveBlock('A', 2, null); // targetIdx de C, dropPosition 'before'

    expect(store.blocks.map(b => b.id)).toEqual(['B', 'A', 'C', 'D']);
  });

  it('mover hacia atrás en el mismo array no se ve afectado (no hay off-by-one)', () => {
    const store = createDocumentStore();
    store.init([block('A'), block('B'), block('C'), block('D')]);

    store.moveBlock('D', 0, null); // soltar D antes de A

    expect(store.blocks.map(b => b.id)).toEqual(['D', 'A', 'B', 'C']);
  });

  it('mover al final del array (después del último) coloca el bloque al final', () => {
    const store = createDocumentStore();
    store.init([block('A'), block('B'), block('C')]);

    store.moveBlock('A', 3, null); // después de C (targetIdx 2 + 1)

    expect(store.blocks.map(b => b.id)).toEqual(['B', 'C', 'A']);
  });
});
