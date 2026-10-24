<template>
  <aside class="epistemic-inspector w-80 sm:w-96 border-l border-slate-800 bg-slate-900/95 flex flex-col h-full text-slate-200 text-xs overflow-hidden select-none">
    <!-- Header -->
    <div class="p-3 border-b border-slate-800 flex items-center justify-between bg-slate-900">
      <div class="flex items-center gap-2">
        <ShieldCheck class="w-4 h-4 text-emerald-400" />
        <span class="font-semibold text-slate-100 text-xs uppercase tracking-wider">Inspector Epistémico</span>
      </div>
      <button
        @click="emit('close')"
        class="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition"
        title="Cerrar panel epistémico"
      >
        <X class="w-4 h-4" />
      </button>
    </div>

    <!-- Contenido Scrollable -->
    <div class="flex-1 overflow-y-auto p-3 space-y-4">
      <!-- Loading State -->
      <div v-if="epistemicStore.loadingGraph" class="p-6 text-center text-slate-500">
        Cargando subgrafo epistémico...
      </div>

      <div v-else-if="!activeConceptId" class="p-6 text-center text-slate-500">
        Selecciona una nota para inspeccionar sus afirmaciones y anclas de evidencia.
      </div>

      <template v-else>
        <!-- Formulario para Proponer Nueva Afirmación -->
        <div class="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800 space-y-2">
          <div class="font-medium text-slate-300 text-[11px] uppercase tracking-wider flex items-center gap-1.5">
            <PlusCircle class="w-3.5 h-3.5 text-blue-400" />
            <span>Proponer Afirmación (Claim)</span>
          </div>
          <textarea
            v-model="newStatement"
            rows="2"
            placeholder="Afirmación empírica o matemática..."
            class="w-full bg-slate-900 border border-slate-800 rounded p-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
          ></textarea>
          <input
            v-model="newConditions"
            type="text"
            placeholder="Condiciones de validez (e.g. T > 300K, 1 atm)"
            class="w-full bg-slate-900 border border-slate-800 rounded p-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
          />
          <button
            @click="handleCreateClaim"
            :disabled="!newStatement.trim() || isCreatingClaim"
            class="w-full py-1 rounded bg-blue-600 text-white font-medium hover:bg-blue-500 disabled:opacity-50 transition"
          >
            {{ isCreatingClaim ? 'Registrando...' : 'Registrar Afirmación' }}
          </button>
        </div>

        <!-- Lista de Afirmaciones del Concepto -->
        <div class="space-y-3">
          <div class="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between">
            <span>Afirmaciones Registradas ({{ claims.length }})</span>
          </div>

          <div v-if="claims.length === 0" class="p-4 text-center text-slate-500 bg-slate-950/40 rounded border border-slate-800/60">
            Esta nota no tiene afirmaciones formalizadas. Propón una arriba para rastrear su evidencia.
          </div>

          <div
            v-for="claim in claims"
            :key="claim.id"
            class="p-3 rounded-lg bg-slate-950 border border-slate-800/80 space-y-2 text-xs"
          >
            <!-- Cabecera de la Afirmación -->
            <div class="flex items-start justify-between gap-2">
              <span
                class="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider shrink-0"
                :class="getStatusBadgeClass(claim.status)"
              >
                {{ claim.status }}
              </span>
              <span class="text-[10px] text-slate-500 font-mono">{{ claim.provenance }}</span>
            </div>

            <!-- Proposición / Statement -->
            <p class="text-slate-100 font-medium leading-relaxed">
              {{ claim.statement }}
            </p>

            <div v-if="claim.conditions" class="text-[11px] text-slate-400 font-mono bg-slate-900/80 px-2 py-0.5 rounded border border-slate-800/50">
              Condiciones: {{ claim.conditions }}
            </div>

            <!-- Evidencias Vinculadas a este Claim -->
            <div class="pt-2 border-t border-slate-800/60 space-y-1.5">
              <span class="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">
                Evidencia Respaldada ({{ getEvidenceForClaim(claim.id).length }})
              </span>

              <div
                v-for="ev in getEvidenceForClaim(claim.id)"
                :key="ev.anchor.id"
                class="p-2 rounded bg-slate-900 border border-slate-800 flex flex-col gap-1"
              >
                <div class="flex items-center justify-between">
                  <span
                    class="px-1 py-0.2 rounded text-[9px] font-bold uppercase"
                    :class="ev.support_type === 'SUPPORTS' ? 'bg-emerald-500/20 text-emerald-300' : ev.support_type === 'REFUTES' ? 'bg-rose-500/20 text-rose-300' : 'bg-slate-700 text-slate-300'"
                  >
                    {{ ev.support_type }}
                  </span>
                  <button
                    @click="handleUnlinkEvidence(claim.id, ev.anchor.id)"
                    class="text-slate-500 hover:text-rose-400 transition"
                    title="Desvincular evidencia"
                  >
                    <Trash2 class="w-3 h-3" />
                  </button>
                </div>
                <blockquote class="italic text-[11px] text-slate-300 pl-1.5 border-l border-slate-700">
                  "{{ ev.anchor.exact_quote }}"
                </blockquote>
                <span class="text-[10px] text-slate-500 truncate">
                  Fuente: {{ ev.source.title }}
                </span>
              </div>
            </div>

            <!-- Acciones de Revisión -->
            <div class="pt-2 flex items-center justify-between gap-1.5">
              <div class="flex items-center gap-1">
                <button
                  v-if="claim.status !== 'VERIFIED'"
                  @click="handleReview(claim.id, 'VERIFIED')"
                  class="px-2 py-1 rounded bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-600/30 font-medium transition text-[10px]"
                  title="Promover a VERIFIED (Requiere al menos 1 ancla SUPPORTS)"
                >
                  Verificar
                </button>
                <button
                  v-if="claim.status !== 'DEPRECATED'"
                  @click="handleReview(claim.id, 'DEPRECATED')"
                  class="px-2 py-1 rounded bg-slate-800 text-slate-400 hover:bg-slate-700 transition text-[10px]"
                >
                  Obsoleta
                </button>
              </div>

              <!-- Botón de Búsqueda Asistida con Abstención -->
              <button
                @click="handleSearchCandidates(claim)"
                class="flex items-center gap-1 px-2 py-1 rounded bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-600/30 transition text-[10px]"
                title="Buscar evidencia candidata en el corpus con FTS5 y sqlite-vec"
              >
                <Sparkles class="w-3 h-3 text-indigo-400" />
                <span>Buscar Evidencia</span>
              </button>
            </div>

            <!-- Panel de Candidatos Sugeridos (con Invariante de Abstención) -->
            <div v-if="activeClaimForCandidates === claim.id && epistemicStore.candidatesResponse" class="mt-2 p-2.5 rounded bg-indigo-950/40 border border-indigo-500/30 space-y-2">
              <div class="flex items-center justify-between text-[11px] font-semibold text-indigo-300">
                <span>Resultados de Inferencia</span>
                <button @click="activeClaimForCandidates = null" class="text-slate-500 hover:text-white">✕</button>
              </div>

              <!-- Caso ABSTAIN: Invariante Estricto -->
              <div v-if="epistemicStore.candidatesResponse.status === 'ABSTAIN'" class="p-2 rounded bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px] space-y-1">
                <div class="font-bold flex items-center gap-1">
                  <AlertTriangle class="w-3.5 h-3.5 shrink-0" />
                  <span>Abstención Epistémica</span>
                </div>
                <p class="leading-relaxed text-[10px]">
                  Señal fáctica insuficiente en el corpus (&lt; θ = {{ epistemicStore.candidatesResponse.threshold_applied }}). El sistema no genera citas inventadas cuando falta respaldo empírico.
                </p>
              </div>

              <!-- Caso CANDIDATES_FOUND -->
              <div v-else class="space-y-1.5">
                <div
                  v-for="cand in epistemicStore.candidatesResponse.candidates"
                  :key="cand.anchor_id"
                  class="p-2 rounded bg-slate-900 border border-slate-800 space-y-1 text-[11px]"
                >
                  <div class="flex items-center justify-between">
                    <span class="font-bold text-indigo-300 text-[10px]">
                      {{ Math.round(cand.confidence_score * 100) }}% Afinidad
                    </span>
                    <span
                      class="px-1 py-0.2 rounded text-[9px] font-bold"
                      :class="cand.potential_relation === 'REFUTES' ? 'bg-rose-500/20 text-rose-300' : 'bg-emerald-500/20 text-emerald-300'"
                    >
                      Orientación: {{ cand.potential_relation }}
                    </span>
                  </div>
                  <p class="italic text-slate-300 line-clamp-2">"{{ cand.exact_quote }}"</p>
                  <div class="flex items-center justify-between pt-1">
                    <span class="text-[10px] text-slate-500 truncate max-w-[140px]">{{ cand.source_title }}</span>
                    <div class="flex gap-1">
                      <button
                        @click="handleLinkCandidate(claim.id, cand.anchor_id, 'SUPPORTS')"
                        class="px-1.5 py-0.5 rounded bg-emerald-600/30 text-emerald-300 hover:bg-emerald-600/50 text-[9px] font-semibold"
                      >
                        + SUPPORTS
                      </button>
                      <button
                        @click="handleLinkCandidate(claim.id, cand.anchor_id, 'REFUTES')"
                        class="px-1.5 py-0.5 rounded bg-rose-600/30 text-rose-300 hover:bg-rose-600/50 text-[9px] font-semibold"
                      >
                        + REFUTES
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </template>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import {
  ShieldCheck,
  X,
  PlusCircle,
  Sparkles,
  Trash2,
  AlertTriangle
} from 'lucide-vue-next';
import { useEpistemicStore } from '../../stores/epistemic.store';
import type { Claim, ClaimStatus, SupportType } from '../../types/epistemic.types';

const props = defineProps<{
  workspaceId: string;
  activeConceptId: string | null;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const epistemicStore = useEpistemicStore();

const newStatement = ref('');
const newConditions = ref('');
const isCreatingClaim = ref(false);
const activeClaimForCandidates = ref<string | null>(null);

const claims = computed(() => {
  return epistemicStore.activeGraph?.claims || [];
});

function getEvidenceForClaim(claimId: string) {
  return (epistemicStore.activeGraph?.evidence || []).filter(e => e.claim_id === claimId);
}

async function handleCreateClaim() {
  if (!newStatement.value.trim() || !props.activeConceptId) return;
  isCreatingClaim.value = true;
  try {
    await epistemicStore.createClaim(props.activeConceptId, {
      statement: newStatement.value.trim(),
      conditions: newConditions.value.trim() || undefined
    });
    newStatement.value = '';
    newConditions.value = '';
  } catch (err: any) {
    alert(err.message || 'Error al proponer afirmación');
  } finally {
    isCreatingClaim.value = false;
  }
}

async function handleReview(claimId: string, status: ClaimStatus) {
  try {
    await epistemicStore.reviewClaim(claimId, status);
  } catch (err: any) {
    alert(err.message || 'Error al revisar afirmación');
  }
}

async function handleUnlinkEvidence(claimId: string, anchorId: string) {
  if (!props.activeConceptId) return;
  try {
    await epistemicStore.unlinkEvidence(props.activeConceptId, claimId, anchorId);
  } catch (err: any) {
    alert(err.message || 'Error al desvincular evidencia');
  }
}

async function handleSearchCandidates(claim: Claim) {
  if (!props.workspaceId) return;
  activeClaimForCandidates.value = claim.id;
  await epistemicStore.findCandidates(
    props.workspaceId,
    claim.statement,
    claim.conditions || undefined,
    0.35 // theta_min
  );
}

async function handleLinkCandidate(claimId: string, anchorId: string, supportType: SupportType) {
  if (!props.activeConceptId) return;
  try {
    await epistemicStore.linkEvidence(props.activeConceptId, claimId, anchorId, supportType);
    activeClaimForCandidates.value = null;
  } catch (err: any) {
    alert(err.message || 'Error al vincular candidato');
  }
}

function getStatusBadgeClass(status: ClaimStatus): string {
  switch (status) {
    case 'VERIFIED': return 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30';
    case 'PROPOSED': return 'bg-amber-500/20 text-amber-400 border border-amber-500/30';
    case 'CONTRADICTED': return 'bg-rose-500/20 text-rose-400 border border-rose-500/30';
    case 'DEPRECATED': return 'bg-slate-700/50 text-slate-400 border border-slate-600';
    default: return 'bg-slate-800 text-slate-400';
  }
}
</script>
