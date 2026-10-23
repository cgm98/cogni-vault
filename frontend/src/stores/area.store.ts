import { defineStore } from 'pinia';
import { ref } from 'vue';
import { requestJson } from '../lib/api';
import type { Area } from '../types/cerebro.types';

export const useAreaStore = defineStore('area', () => {
  const areas = ref<Area[]>([]);
  const loading = ref(false);

  async function fetchAreas(cerebroId?: string) {
    loading.value = true;
    try {
      const url = cerebroId ? `/api/areas?cerebroId=${cerebroId}` : '/api/areas';
      const data = await requestJson<any[]>(url);
      areas.value = data;
    } finally {
      loading.value = false;
    }
  }

  async function createArea(data: Partial<Area>) {
    const res = await fetch('/api/areas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (res.ok) {
      const created = await res.json();
      areas.value.push(created);
      return created;
    }
  }

  async function updateArea(id: string, data: Partial<Area>) {
    const res = await fetch(`/api/areas/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (res.ok) {
      const updated = await res.json();
      const idx = areas.value.findIndex(a => a.id === id);
      if (idx !== -1) areas.value[idx] = updated;
      return updated;
    }
  }

  async function deleteArea(id: string) {
    const res = await fetch(`/api/areas/${id}`, { method: 'DELETE' });
    if (res.ok) {
      areas.value = areas.value.filter(a => a.id !== id);
    }
  }

  return {
    areas,
    loading,
    fetchAreas,
    createArea,
    updateArea,
    deleteArea
  };
});
