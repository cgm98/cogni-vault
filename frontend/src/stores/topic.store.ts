import { defineStore } from 'pinia';
import { ref } from 'vue';
import { requestJson } from '../lib/api';
import type { Topic } from '../types/cerebro.types';

export const useTopicStore = defineStore('topic', () => {
  const topics = ref<Topic[]>([]);
  const loading = ref(false);

  async function fetchTopics() {
    loading.value = true;
    try {
      const data = await requestJson<any[]>('/api/topics');
      topics.value = data;
    } finally {
      loading.value = false;
    }
  }

  async function createTopic(data: Partial<Topic>) {
    const res = await fetch('/api/topics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (res.ok) {
      const created = await res.json();
      topics.value.push(created);
      return created;
    }
  }

  async function updateTopic(id: string, data: Partial<Topic>) {
    const res = await fetch(`/api/topics/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (res.ok) {
      const updated = await res.json();
      const idx = topics.value.findIndex(t => t.id === id);
      if (idx !== -1) topics.value[idx] = updated;
      return updated;
    }
  }

  async function deleteTopic(id: string) {
    const res = await fetch(`/api/topics/${id}`, { method: 'DELETE' });
    if (res.ok) {
      topics.value = topics.value.filter(t => t.id !== id);
    }
  }

  return {
    topics,
    loading,
    fetchTopics,
    createTopic,
    updateTopic,
    deleteTopic
  };
});
