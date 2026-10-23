import { defineStore } from 'pinia';
import { ref } from 'vue';
import { requestJson } from '../lib/api';
import type { Domain } from '../types/cerebro.types';

export const useDomainStore = defineStore('domain', () => {
  const domains = ref<Domain[]>([]);
  const loading = ref(false);

  async function fetchDomains() {
    loading.value = true;
    try {
      const data = await requestJson<any[]>('/api/domains');
      domains.value = data;
    } finally {
      loading.value = false;
    }
  }

  async function createDomain(data: Partial<Domain>) {
    const res = await fetch('/api/domains', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (res.ok) {
      const created = await res.json();
      domains.value.push(created);
      return created;
    }
  }

  async function updateDomain(id: string, data: Partial<Domain>) {
    const res = await fetch(`/api/domains/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (res.ok) {
      const updated = await res.json();
      const idx = domains.value.findIndex(d => d.id === id);
      if (idx !== -1) domains.value[idx] = updated;
      return updated;
    }
  }

  async function deleteDomain(id: string) {
    const res = await fetch(`/api/domains/${id}`, { method: 'DELETE' });
    if (res.ok) {
      domains.value = domains.value.filter(d => d.id !== id);
    }
  }

  return {
    domains,
    loading,
    fetchDomains,
    createDomain,
    updateDomain,
    deleteDomain
  };
});
