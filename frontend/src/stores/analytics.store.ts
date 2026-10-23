import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useAnalyticsStore = defineStore('analytics', () => {
  const loading = ref(false);
  const stats = ref<any>({ totalConcepts: 0, totalDomains: 0 });
  const dashboard = ref<any>({ stats: { totalConcepts: 0, totalDomains: 0 }, domainDist: [], gaps: [], events: [] });
  const gaps = ref<any[]>([]);
  const events = ref<any[]>([]);

  async function fetchAll() {
    loading.value = true;
    try {
      const s = await fetch('/api/analytics/stats').then(r => r.json()).catch(() => null);
      if (s?.stats) {
        stats.value = s.stats;
        dashboard.value.stats = s.stats;
        dashboard.value.domainDist = s.domainDist || [];
      }
      const g = await fetch('/api/analytics/gaps').then(r => r.json()).catch(() => null);
      if (Array.isArray(g)) {
        gaps.value = g;
        dashboard.value.gaps = g;
      }
      const e = await fetch('/api/analytics/events').then(r => r.json()).catch(() => null);
      if (Array.isArray(e)) {
        events.value = e;
        dashboard.value.events = e;
      }
    } finally {
      loading.value = false;
    }
  }

  return {
    loading,
    stats,
    dashboard,
    gaps,
    events,
    fetchAll,
    fetchDashboard: fetchAll
  };
});
