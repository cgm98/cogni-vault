import { defineStore } from 'pinia';
import { ref } from 'vue';
import { requestJson } from '../lib/api';
import type { Cerebro } from '../types/cerebro.types';

export const useCerebroStore = defineStore('cerebro', () => {
  const cerebros = ref<Cerebro[]>([]);
  const activeCerebro = ref<Cerebro | null>(null);
  const activeFacet = ref<string>('ALL');

  async function fetchCerebros() {
    cerebros.value = await requestJson<Cerebro[]>('/api/cerebros');
    if (activeCerebro.value) activeCerebro.value = cerebros.value.find(c => c.id === activeCerebro.value?.id) || null;
  }

  async function createCerebro(data: Partial<Cerebro>) {
    const created = await requestJson<Cerebro>('/api/cerebros', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    cerebros.value.push(created);
    activeCerebro.value = created;
    return created;
  }
  async function updateCerebro(id: string, data: Partial<Cerebro>) {
    const res = await fetch(`/api/cerebros/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (res.ok) {
      const updated = await res.json();
      const idx = cerebros.value.findIndex(c => c.id === id);
      if (idx !== -1) cerebros.value[idx] = updated;
      if (activeCerebro.value?.id === id) activeCerebro.value = updated;
      return updated;
    }
  }

  async function deleteCerebro(id: string) {
    const res = await fetch(`/api/cerebros/${id}`, { method: 'DELETE' });
    if (res.ok) {
      cerebros.value = cerebros.value.filter(c => c.id !== id);
      if (activeCerebro.value?.id === id) {
        activeCerebro.value = cerebros.value[0] || null;
      }
    }
  }

  function selectCerebro(id: string) {
    const found = cerebros.value.find(c => c.id === id);
    if (found) activeCerebro.value = found;
  }

  function setActiveCerebro(c: Cerebro | string | null) {
    if (typeof c === 'string') {
      const found = cerebros.value.find(item => item.id === c || item.slug === c);
      activeCerebro.value = found || null;
    } else {
      activeCerebro.value = c;
    }
  }

  function setActiveFacet(f: string) {
    activeFacet.value = f;
  }

  return {
    cerebros,
    activeCerebro,
    activeFacet,
    fetchCerebros,
    createCerebro,
    updateCerebro,
    deleteCerebro,
    selectCerebro,
    setActiveCerebro,
    setActiveFacet
  };
});

