<script setup lang="ts">
import { useAreaStore } from '../../stores/area.store';
import { useDomainStore } from '../../stores/domain.store';
import { useTopicStore } from '../../stores/topic.store';
import { useCerebroStore } from '../../stores/cerebro.store';
import { TemporalFacet } from '../../types/cerebro.types';
import './style.css';
import { ref, onMounted } from 'vue';

import Modal from '../../components/Modal/Index.vue';

const areaStore = useAreaStore();
const domainStore = useDomainStore();
const topicStore = useTopicStore();
const cerebroStore = useCerebroStore();

const activeTab = ref<'areas' | 'domains' | 'topics'>('domains');

const newAreaId = ref('');
const newAreaName = ref('');
const newAreaColor = ref('#10b981');
const newAreaDesc = ref('');
const newAreaCerebroId = ref('');
const newAreaFacet = ref<TemporalFacet>('PAST_MEMORY');

const newDomainId = ref('');
const newDomainName = ref('');
const newDomainColor = ref('#3b82f6');
const newDomainDesc = ref('');
const newDomainAreaId = ref('');
const newDomainFacet = ref<TemporalFacet>('PAST_MEMORY');

const newTopicId = ref('');
const newTopicName = ref('');
const newTopicColor = ref('#f59e0b');
const newTopicDesc = ref('');
const newTopicDomainId = ref('');
const newTopicFacet = ref<TemporalFacet>('PAST_MEMORY');

const showDeleteModal = ref(false);
const itemToDeleteId = ref('');
const itemToDeleteType = ref<'area'|'domain'|'topic'>('domain');

const toastMsg = ref(''); const toastType = ref<'success' | 'error'>('success'); const toastVisible = ref(false);

const triggerToast = (msg: string, type: 'success' | 'error' = 'success') => {
  toastMsg.value = msg; toastType.value = type; toastVisible.value = true;
  setTimeout(() => { toastVisible.value = false; }, 2500);
};

const getFacetBadge = (facet?: string) => {
  switch (facet) {
    case 'PAST_MEMORY':
      return { label: 'Pasado', symbol: '🏛️', cls: 'badge-past' };
    case 'PRESENT_DISCERNMENT':
      return { label: 'Presente', symbol: '⚖️', cls: 'badge-present' };
    case 'FUTURE_PROVIDENCE':
      return { label: 'Futuro', symbol: '🧭', cls: 'badge-future' };
    default:
      return { label: 'Pasado', symbol: '🏛️', cls: 'badge-past' };
  }
};

onMounted(async () => {
  try {
    await Promise.all([
      areaStore.fetchAreas(),
      domainStore.fetchDomains(),
      topicStore.fetchTopics(),
      cerebroStore.fetchCerebros()
    ]);
  } catch (e) { console.error(e); }
});

const handleRegisterArea = async () => {
  if (areaStore.loading) return;
  const name = newAreaName.value.trim();
  if (!name) return triggerToast('Nombre obligatorio', 'error');
  try {
    const id = newAreaId.value.trim() || name.toLowerCase().replace(/[^a-z0-9]/g, '-');
    await areaStore.createArea({
      id,
      name,
      color: newAreaColor.value,
      description: newAreaDesc.value,
      cerebro_id: newAreaCerebroId.value || undefined,
      temporal_facet: newAreaFacet.value
    });
    triggerToast('Área registrada', 'success');
    newAreaId.value = ''; newAreaName.value = ''; newAreaColor.value = '#10b981'; newAreaDesc.value = ''; newAreaCerebroId.value = ''; newAreaFacet.value = 'PAST_MEMORY';
  } catch (e: any) { triggerToast(e.message || 'Error', 'error'); }
};

const handleRegisterDomain = async () => {
  if (domainStore.loading) return;
  const name = newDomainName.value.trim();
  if (!name) return triggerToast('Nombre obligatorio', 'error');
  try {
    const id = newDomainId.value.trim() || name.toLowerCase().replace(/[^a-z0-9]/g, '-');
    await domainStore.createDomain({
      id,
      name,
      color: newDomainColor.value,
      description: newDomainDesc.value,
      area_id: newDomainAreaId.value || undefined,
      temporal_facet: newDomainFacet.value
    });
    triggerToast('Dominio registrado', 'success');
    newDomainId.value = ''; newDomainName.value = ''; newDomainColor.value = '#3b82f6'; newDomainDesc.value = ''; newDomainAreaId.value = ''; newDomainFacet.value = 'PAST_MEMORY';
  } catch (e: any) { triggerToast(e.message || 'Error', 'error'); }
};

const handleRegisterTopic = async () => {
  if (topicStore.loading) return;
  const name = newTopicName.value.trim();
  if (!name || !newTopicDomainId.value) return triggerToast('Nombre y Dominio obligatorios', 'error');
  try {
    const id = newTopicId.value.trim() || name.toLowerCase().replace(/[^a-z0-9]/g, '-');
    await topicStore.createTopic({
      id,
      domain_id: newTopicDomainId.value,
      name,
      color: newTopicColor.value,
      description: newTopicDesc.value,
      temporal_facet: newTopicFacet.value
    });
    triggerToast('Tema registrado', 'success');
    newTopicId.value = ''; newTopicName.value = ''; newTopicColor.value = '#f59e0b'; newTopicDesc.value = ''; newTopicDomainId.value = ''; newTopicFacet.value = 'PAST_MEMORY';
  } catch (e: any) { triggerToast(e.message || 'Error', 'error'); }
};

const clickDelete = (id: string, type: 'area'|'domain'|'topic') => {
  itemToDeleteId.value = id; itemToDeleteType.value = type; showDeleteModal.value = true;
};

const confirmDelete = async () => {
  showDeleteModal.value = false;
  try {
    if (itemToDeleteType.value === 'area') await areaStore.deleteArea(itemToDeleteId.value);
    else if (itemToDeleteType.value === 'domain') await domainStore.deleteDomain(itemToDeleteId.value);
    else await topicStore.deleteTopic(itemToDeleteId.value);
    triggerToast('Eliminado', 'success');
  } catch (e: any) { triggerToast(e.message || 'Error al eliminar', 'error'); }
};
</script>

<template>
  <div class="domains-container animate-fade-in">
    <header class="domains-header">
      <h1>Gestor de Taxonomía</h1>
      <p>Organiza tu grafo de conocimiento jerárquicamente en Cerebros, Áreas, Dominios y Temas rigiéndose por las facetas temporales.</p>
    </header>

    <div class="tabs-wrapper">
      <button class="tab-btn" :class="{ active: activeTab === 'areas' }" @click="activeTab = 'areas'">Áreas ({{ areaStore.areas?.length || 0 }})</button>
      <button class="tab-btn" :class="{ active: activeTab === 'domains' }" @click="activeTab = 'domains'">Dominios ({{ domainStore.domains?.length || 0 }})</button>
      <button class="tab-btn" :class="{ active: activeTab === 'topics' }" @click="activeTab = 'topics'">Temas ({{ topicStore.topics?.length || 0 }})</button>
    </div>

    <div class="domains-layout">
      <!-- PANEL FORMULARIO (Se adapta según la pestaña) -->
      <div class="domain-card form-card">
        <h2 v-if="activeTab === 'areas'">Registrar Área</h2>
        <h2 v-if="activeTab === 'domains'">Registrar Dominio</h2>
        <h2 v-if="activeTab === 'topics'">Registrar Tema</h2>
        
        <div class="field-group">
          <label>ID (opcional)</label>
          <input v-if="activeTab === 'areas'" v-model="newAreaId" type="text" placeholder="Ej: ciencias">
          <input v-if="activeTab === 'domains'" v-model="newDomainId" type="text" placeholder="Ej: fisica">
          <input v-if="activeTab === 'topics'" v-model="newTopicId" type="text" placeholder="Ej: cuantica">
        </div>

        <div class="field-group">
          <label>Nombre *</label>
          <input v-if="activeTab === 'areas'" v-model="newAreaName" type="text" placeholder="Ej: Ciencias Naturales">
          <input v-if="activeTab === 'domains'" v-model="newDomainName" type="text" placeholder="Ej: Física">
          <input v-if="activeTab === 'topics'" v-model="newTopicName" type="text" placeholder="Ej: Física Cuántica">
        </div>

        <!-- Cerebro Selector (Para Áreas) -->
        <div v-if="activeTab === 'areas'" class="field-group">
          <label>Cerebro Asignado</label>
          <select v-model="newAreaCerebroId" class="select-input">
            <option value="">Por defecto / Automático</option>
            <option v-for="c in cerebroStore.cerebros" :key="c.id" :value="c.id">{{ c.name }}</option>
          </select>
        </div>

        <!-- Padres Selectors -->
        <div v-if="activeTab === 'domains'" class="field-group">
          <label>Área Padre (Opcional)</label>
          <select v-model="newDomainAreaId" class="select-input">
            <option value="">Ninguna</option>
            <option v-for="a in areaStore.areas" :key="a.id" :value="a.id">{{ a.name }}</option>
          </select>
        </div>

        <div v-if="activeTab === 'topics'" class="field-group">
          <label>Dominio Padre *</label>
          <select v-model="newTopicDomainId" class="select-input">
            <option value="" disabled>Seleccionar dominio...</option>
            <option v-for="d in domainStore.domains" :key="d.id" :value="d.id">{{ d.name }}</option>
          </select>
        </div>

        <!-- Faceta Temporal Selector -->
        <div class="field-group">
          <label>Faceta Temporal *</label>
          <select v-if="activeTab === 'areas'" v-model="newAreaFacet" class="select-input">
            <option value="PAST_MEMORY">🏛️ I. Pasado / Memoria (Fundamentos, Canon)</option>
            <option value="PRESENT_DISCERNMENT">⚖️ II. Presente / Discernimiento (Activo, ADRs)</option>
            <option value="FUTURE_PROVIDENCE">🧭 III. Futuro / Providencia (Roadmaps, RFCs)</option>
          </select>
          <select v-if="activeTab === 'domains'" v-model="newDomainFacet" class="select-input">
            <option value="PAST_MEMORY">🏛️ I. Pasado / Memoria (Fundamentos, Canon)</option>
            <option value="PRESENT_DISCERNMENT">⚖️ II. Presente / Discernimiento (Activo, ADRs)</option>
            <option value="FUTURE_PROVIDENCE">🧭 III. Futuro / Providencia (Roadmaps, RFCs)</option>
          </select>
          <select v-if="activeTab === 'topics'" v-model="newTopicFacet" class="select-input">
            <option value="PAST_MEMORY">🏛️ I. Pasado / Memoria (Fundamentos, Canon)</option>
            <option value="PRESENT_DISCERNMENT">⚖️ II. Presente / Discernimiento (Activo, ADRs)</option>
            <option value="FUTURE_PROVIDENCE">🧭 III. Futuro / Providencia (Roadmaps, RFCs)</option>
          </select>
        </div>

        <div class="field-group">
          <label>Color</label>
          <div class="color-picker-row">
            <input v-if="activeTab === 'areas'" v-model="newAreaColor" type="color" class="color-input">
            <input v-if="activeTab === 'areas'" v-model="newAreaColor" type="text" class="text-input">
            
            <input v-if="activeTab === 'domains'" v-model="newDomainColor" type="color" class="color-input">
            <input v-if="activeTab === 'domains'" v-model="newDomainColor" type="text" class="text-input">

            <input v-if="activeTab === 'topics'" v-model="newTopicColor" type="color" class="color-input">
            <input v-if="activeTab === 'topics'" v-model="newTopicColor" type="text" class="text-input">
          </div>
        </div>

        <div class="field-group">
          <label>Descripción</label>
          <textarea v-if="activeTab === 'areas'" v-model="newAreaDesc" placeholder="Describe el área..." rows="3"></textarea>
          <textarea v-if="activeTab === 'domains'" v-model="newDomainDesc" placeholder="Describe el dominio..." rows="3"></textarea>
          <textarea v-if="activeTab === 'topics'" v-model="newTopicDesc" placeholder="Describe el tema..." rows="3"></textarea>
        </div>

        <button v-if="activeTab === 'areas'" @click="handleRegisterArea" class="btn-submit" :disabled="areaStore.loading">Registrar Área</button>
        <button v-if="activeTab === 'domains'" @click="handleRegisterDomain" class="btn-submit" :disabled="domainStore.loading">Registrar Dominio</button>
        <button v-if="activeTab === 'topics'" @click="handleRegisterTopic" class="btn-submit" :disabled="topicStore.loading">Registrar Tema</button>
      </div>

      <!-- PANEL LISTADOS -->
      <div class="domains-list-section">
        <!-- ÁREAS -->
        <div v-if="activeTab === 'areas'" class="domains-grid">
          <div v-for="a in areaStore.areas" :key="a.id" class="domain-card-item">
            <div class="card-header-color" :style="{ backgroundColor: a.color || '#555' }"></div>
            <div class="card-content">
              <div class="badges-top">
                <span v-if="a.cerebro_id" class="parent-badge cerebro-badge">
                  🧠 {{ cerebroStore.cerebros?.find(c => c.id === a.cerebro_id)?.name || 'Cerebro' }}
                </span>
                <span :class="['facet-tag', getFacetBadge(a.temporal_facet).cls]">
                  {{ getFacetBadge(a.temporal_facet).symbol }} {{ getFacetBadge(a.temporal_facet).label }}
                </span>
              </div>
              <div class="title-row">
                <h3>{{ a.name }}</h3><span class="id-badge">/{{ a.id }}</span>
              </div>
              <p class="desc">{{ a.description || 'Sin descripción' }}</p>
              <div class="footer-actions"><button @click="clickDelete(a.id, 'area')" class="btn-delete">Eliminar</button></div>
            </div>
          </div>
        </div>

        <!-- DOMINIOS -->
        <div v-if="activeTab === 'domains'" class="domains-grid">
          <div v-for="d in domainStore.domains" :key="d.id" class="domain-card-item">
            <div class="card-header-color" :style="{ backgroundColor: d.color }"></div>
            <div class="card-content">
              <div class="badges-top">
                <span class="parent-badge" v-if="d.area_id">📁 {{ areaStore.areas?.find(a => a.id === d.area_id)?.name || d.area_id }}</span>
                <span :class="['facet-tag', getFacetBadge(d.temporal_facet).cls]">
                  {{ getFacetBadge(d.temporal_facet).symbol }} {{ getFacetBadge(d.temporal_facet).label }}
                </span>
              </div>
              <div class="title-row">
                <h3>{{ d.name }}</h3><span class="id-badge">/{{ d.id }}</span>
              </div>
              <p class="desc">{{ d.description || 'Sin descripción' }}</p>
              <div class="footer-actions">
                <button v-if="!['core', 'rust', 'fp', 'system'].includes(d.id)" @click="clickDelete(d.id, 'domain')" class="btn-delete">Eliminar</button>
                <span v-else class="system-badge">Sistema</span>
              </div>
            </div>
          </div>
        </div>

        <!-- TEMAS -->
        <div v-if="activeTab === 'topics'" class="domains-grid">
          <div v-for="t in topicStore.topics" :key="t.id" class="domain-card-item">
            <div class="card-header-color" :style="{ backgroundColor: t.color || '#555' }"></div>
            <div class="card-content">
              <div class="badges-top">
                <span class="parent-badge" v-if="t.domain_id">🏷️ {{ domainStore.domains?.find(d => d.id === t.domain_id)?.name || t.domain_id }}</span>
                <span :class="['facet-tag', getFacetBadge(t.temporal_facet).cls]">
                  {{ getFacetBadge(t.temporal_facet).symbol }} {{ getFacetBadge(t.temporal_facet).label }}
                </span>
              </div>
              <div class="title-row">
                <h3>{{ t.name }}</h3><span class="id-badge">/{{ t.id }}</span>
              </div>
              <p class="desc">{{ t.description || 'Sin descripción' }}</p>
              <div class="footer-actions"><button @click="clickDelete(t.id, 'topic')" class="btn-delete">Eliminar</button></div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Toast y Modal -->
    <div class="toast-popup" :class="{ 'visible': toastVisible, 'success': toastType === 'success', 'error': toastType === 'error' }">
      {{ toastMsg }}
    </div>
    <Modal
      v-if="showDeleteModal"
      title="Confirmar Eliminación"
      message="¿Seguro que quieres eliminar este elemento de la taxonomía?"
      confirm-label="Eliminar"
      :destructive="true"
      @confirm="confirmDelete"
      @cancel="showDeleteModal = false"
    />
  </div>
</template>
