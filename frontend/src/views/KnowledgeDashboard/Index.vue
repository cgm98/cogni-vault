<script setup lang="ts">
import { onMounted, computed } from 'vue';
import '../../assets/styles/group-dashboard.css';
import { useAnalyticsStore } from '../../stores/analytics.store';
import { useReviewStore } from '../../stores/review.store';
import { useDomainStore } from '../../stores/domain.store';
import { useTopicStore } from '../../stores/topic.store';
import { useAreaStore } from '../../stores/area.store';

const analyticsStore = useAnalyticsStore();
const reviewStore = useReviewStore();
const domainStore = useDomainStore();
const topicStore = useTopicStore();
const areaStore = useAreaStore();

const loading = computed(() => analyticsStore.loading);

onMounted(() => {
  Promise.all([
    analyticsStore.fetchDashboard(),
    reviewStore.fetchDueCounts(),
    domainStore.fetchDomains(),
    topicStore.fetchTopics(),
    areaStore.fetchAreas()
  ]);
});

const retentionPercentage = computed(() => {
  const avg = analyticsStore.dashboard.stats.avgMemoryStrength;
  return typeof avg === 'number' && Number.isFinite(avg) ? Math.round(avg * 100) : null;
});

const getDomainName = (domainId: string) => {
  const d = domainStore.domains.find(x => x.id === domainId || x.name === domainId);
  return d ? d.name : domainId;
};

const getDomainColor = (domainId: string) => {
  const d = domainStore.domains.find(x => x.id === domainId || x.name === domainId);
  return d ? d.color : '#888888';
};
</script>

<template>
  <div class="gdash-wrapper animate-fade-in">
    <div class="gdash-container">
      <header class="gdash-header">
        <div class="gdash-header-icon">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path>
            <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>
          </svg>
        </div>
        <div>
          <h1>Conocimiento</h1>
          <p class="subtitle">Resumen de tus notas, dominios de conocimiento y repasos.</p>
        </div>
      </header>

      <template v-if="loading">
        <div class="gdash-skeleton">
          <div class="gdash-sk-card"></div>
          <div class="gdash-sk-card"></div>
          <div class="gdash-sk-card"></div>
          <div class="gdash-sk-card"></div>
        </div>
      </template>

      <template v-else>
        <div class="gdash-kpis">
          <div class="gdash-kpi-card">
            <span class="label">Conceptos</span>
            <span class="value">{{ analyticsStore.dashboard.stats.totalConcepts }}</span>
            <span class="desc">Notas registradas</span>
          </div>
          <div class="gdash-kpi-card">
            <span class="label">Retención</span>
            <span class="value" :class="retentionPercentage !== null && retentionPercentage < 75 ? 'warning' : 'success'">
              {{ retentionPercentage !== null ? retentionPercentage + '%' : '—' }}
            </span>
            <span class="desc">Fuerza de memoria promedio</span>
          </div>
          <div class="gdash-kpi-card">
            <span class="label">Repasos hoy</span>
            <span class="value" :class="reviewStore.dueCounts.dueToday > 0 ? 'warning' : ''">{{ reviewStore.dueCounts.dueToday ?? '—' }}</span>
            <span class="desc">Conceptos vencidos hoy</span>
          </div>
          <div class="gdash-kpi-card">
            <span class="label">Dominios</span>
            <span class="value">{{ analyticsStore.dashboard.stats.totalDomains }}</span>
            <span class="desc">Ámbitos de conocimiento</span>
          </div>
        </div>

        <div class="gdash-grid">
          <div class="gdash-main-col">
            <div class="gdash-section">
              <div class="gdash-section-header">
                <div>
                  <h3>Distribución de dominios</h3>
                  <p class="card-subtitle">Conceptos agrupados por dominio de conocimiento</p>
                </div>
              </div>
              <div class="gdash-section-body">
                <div v-if="analyticsStore.dashboard.domainDist.length === 0" class="gdash-empty">
                  Todavía no hay conceptos clasificados por dominio.
                </div>
                <div v-else class="gdash-list">
                  <div v-for="dom in analyticsStore.dashboard.domainDist" :key="dom.domainId" class="gdash-list-item">
                    <div class="gdash-list-item-main" style="flex: 1;">
                      <span class="gdash-list-item-title">{{ dom.domainName || getDomainName(dom.domainId) }}</span>
                      <div class="gdash-progress-bar">
                        <div class="gdash-progress-fill" :style="{ width: (analyticsStore.dashboard.stats.totalConcepts > 0 ? dom.count / analyticsStore.dashboard.stats.totalConcepts * 100 : 0) + '%', background: getDomainColor(dom.domainId) }"></div>
                      </div>
                    </div>
                    <span class="gdash-badge">{{ dom.count }}</span>
                  </div>
                </div>
              </div>
            </div>

            <div class="gdash-section">
              <div class="gdash-section-header">
                <div>
                  <h3>Brechas y alertas</h3>
                  <p class="card-subtitle">Conceptos en riesgo o desarticulados</p>
                </div>
                <span class="gdash-badge" :class="{ warning: analyticsStore.dashboard.gaps.length > 0 }">{{ analyticsStore.dashboard.gaps.length }}</span>
              </div>
              <div class="gdash-section-body">
                <div v-if="analyticsStore.dashboard.gaps.length === 0" class="gdash-empty">
                  Tu base de conocimiento no tiene brechas críticas.
                </div>
                <div v-else class="gdash-list">
                  <div v-for="gap in analyticsStore.dashboard.gaps" :key="gap.id" class="gdash-list-item">
                    <div class="gdash-list-item-main">
                      <span class="gdash-list-item-title">{{ gap.title }}</span>
                      <span class="gdash-list-item-meta">{{ gap.reason }}</span>
                    </div>
                    <span v-if="gap.severity > 0.6" class="gdash-badge error">Urgente</span>
                  </div>
                </div>
              </div>
            </div>

          </div>

          <div class="gdash-side-col">
            <div class="gdash-section">
              <div class="gdash-section-header">
                <h3>Acciones rápidas</h3>
              </div>
              <div class="gdash-section-body">
                <div class="gdash-actions-stack">
                  <RouterLink to="/notes" class="gdash-action-row">
                    <div class="gdash-action-icon">
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
                    </div>
                    <div class="gdash-action-details">
                      <span class="title">Notas</span>
                      <span class="desc">Bóveda de conceptos</span>
                    </div>
                  </RouterLink>
                  <RouterLink to="/taxonomy" class="gdash-action-row">
                    <div class="gdash-action-icon">
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline></svg>
                    </div>
                    <div class="gdash-action-details">
                      <span class="title">Taxonomía</span>
                      <span class="desc">Áreas, dominios y temas</span>
                    </div>
                  </RouterLink>
                  <RouterLink to="/challenge" class="gdash-action-row">
                    <div class="gdash-action-icon">
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                    </div>
                    <div class="gdash-action-details">
                      <span class="title">Repasos</span>
                      <span class="desc">Sesión de repetición espaciada</span>
                    </div>
                  </RouterLink>
                </div>
              </div>
            </div>

            <div class="gdash-section">
              <div class="gdash-section-header">
                <h3>Taxonomía</h3>
              </div>
              <div class="gdash-section-body">
                <div class="gdash-list">
                  <div class="gdash-list-item">
                    <span class="gdash-list-item-title">Áreas</span>
                    <span class="gdash-badge">{{ areaStore.areas.length }}</span>
                  </div>
                  <div class="gdash-list-item">
                    <span class="gdash-list-item-title">Dominios</span>
                    <span class="gdash-badge">{{ domainStore.domains.length }}</span>
                  </div>
                  <div class="gdash-list-item">
                    <span class="gdash-list-item-title">Temas</span>
                    <span class="gdash-badge">{{ topicStore.topics.length }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

