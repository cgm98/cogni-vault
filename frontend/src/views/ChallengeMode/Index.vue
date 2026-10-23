<script setup lang="ts">
import { useConceptStore } from '../../stores/concept.store';
import { useReviewStore } from '../../stores/review.store';
import './style.css';
import { ref, computed, onMounted } from 'vue';

import { useRouter } from 'vue-router';

const conceptStore = useConceptStore();
const reviewStore = useReviewStore();
const router = useRouter();

const sessionActive = ref(false);
const sessionComplete = ref(false);
const queue = ref<any[]>([]);
const currentIdx = ref(0);

// Editor de código
const codeAnswer = ref('');

const showReveal = ref(false);
const sessionStartTime = ref(0);
const ratingsSubmitted = ref<number[]>([]);
const selectedRating = ref<number | null>(null);
const showHintText = ref(false);

const triggerToast = ref(false);
const toastMsg = ref('');

const showMessage = (msg: string) => {
  toastMsg.value = msg;
  triggerToast.value = true;
  setTimeout(() => triggerToast.value = false, 2500);
};

onMounted(async () => {
  try {
    await Promise.all([conceptStore.fetchConceptSummaries(), reviewStore.fetchDueCounts()]);
  } catch (e) {
    console.error(e);
  }
});

const getConceptTitle = (conceptId: string) => {
  const c = conceptStore.summaries.find(x => x.id === conceptId);
  return c ? c.title : 'Concepto de Referencia';
};

const startChallenge = async () => {
  try {
    const dueQs = await reviewStore.fetchDueQuestions();
    if (dueQs.length === 0) {
      showMessage('No tienes desafíos vencidos hoy en tu cola de estudio.');
      return;
    }

    queue.value = dueQs.map((q: any) => ({
      concept_id: q.concept_id,
      concept_title: q.concept_title,
      domain: q.domain,
      question_id: q.question_id,
      question_type: q.question_type,
      prompt: q.prompt,
      answer: q.answer
    })).sort(() => 0.5 - Math.random()).slice(0, 5); // 5 retos para mantener foco alto

    currentIdx.value = 0;
    resetEditorState();
    sessionActive.value = true;
    sessionComplete.value = false;
    sessionStartTime.value = Date.now();
  } catch (e) {
    console.error(e);
  }
};

const currentQuestion = computed(() => {
  if (queue.value.length > 0 && currentIdx.value < queue.value.length) {
    return queue.value[currentIdx.value];
  }
  return null;
});

const resetEditorState = () => {
  const q = currentQuestion.value;
  // Inicializar boilerplate de código basado en el problema
  codeAnswer.value = q
    ? `/**\n * Código solución para: ${q.concept_title}\n * Dominio: ${q.domain}\n */\n\nfunction resolverDesafio() {\n  // Escribe tu código aquí\n  \n}`
    : `function resolverDesafio() {\n  \n}`;
  showReveal.value = false;
  showHintText.value = false;
};

const handleVerify = () => {
  if (!codeAnswer.value.trim()) {
    showMessage('Escribe tu solución en el editor de código antes de enviarla.');
    return;
  }
  showReveal.value = true;
};

const handleRate = async (score: number) => {
  // Sin este guard, un doble-click en el rating dispara dos submitReview
  // para la misma pregunta antes de que el primero resuelva, contando
  // doble un rating en el cálculo SM-2 (mismo bug que ya se evitaba en
  // ReviewStudio, pero acá faltaba tanto el guard como el :disabled).
  if (selectedRating.value !== null) return;
  const q = currentQuestion.value;
  if (!q) return;

  selectedRating.value = score;
  const latency = Date.now() - sessionStartTime.value;

  try {
    await reviewStore.submitReview({
      concept_id: q.concept_id,
      question_id: q.question_id,
      score,
      latency_ms: latency
    });
    ratingsSubmitted.value.push(score);
  } catch (e) {
    console.error(e);
  }

  selectedRating.value = null;

  if (currentIdx.value + 1 < queue.value.length) {
    currentIdx.value++;
    resetEditorState();
    sessionStartTime.value = Date.now();
  } else {
    sessionActive.value = false;
    sessionComplete.value = true;
  }
};

const ratingCounts = computed(() => {
  const counts = { again: 0, hard: 0, good: 0, easy: 0 };
  ratingsSubmitted.value.forEach(r => {
    if (r === 1) counts.again++;
    if (r === 2) counts.hard++;
    if (r === 3) counts.good++;
    if (r === 4) counts.easy++;
  });
  return counts;
});

const finish = () => {
  sessionComplete.value = false;
  sessionActive.value = false;
  reviewStore.fetchDueCounts();
};
</script>

<template>
  <div class="challenge-wrapper animate-fade-in">
    <div class="challenge-main-container">
      
      <!-- Cabecera de la Vista -->
      <header class="challenge-header" v-if="!sessionActive && !sessionComplete">
        <div class="badge badge--header">Práctica de Código</div>
        <h1>Laboratorio de Programación</h1>
        <p class="subtitle">Escribe, compila y valida soluciones algorítmicas vinculadas a tu red conceptual.</p>
      </header>

      <!-- PANTALLA INICIAL: INICIO DE DESAFÍOS -->
      <div v-if="!sessionActive && !sessionComplete" class="start-session-box">
        <div class="art-icon">💻</div>
        <h2>Entrenamiento Activo de Código</h2>
        <p>
          Resolverás retos de programación e implementarás algoritmos a nivel atómico.
          La plataforma evaluará tu código contra casos de prueba y enlazará los conceptos teóricos correspondientes del grafo.
        </p>
        <button @click="startChallenge" class="btn-start-challenges">
          Iniciar Laboratorio Algorítmico
        </button>
      </div>

      <!-- SESIÓN DE PROGRAMACIÓN ACTIVA (3 paneles) -->
      <div v-else-if="sessionActive && currentQuestion" class="workspace-layout">
        
        <!-- PANEL IZQUIERDO (40%): Enunciado y Conceptos -->
        <aside class="problem-panel">
          <div class="panel-header-badge">
            <span class="badge badge--accent">{{ currentQuestion.domain }}</span>
            <span class="index-badge">Reto {{ currentIdx + 1 }} de {{ queue.length }}</span>
          </div>

          <div class="problem-content">
            <h2>{{ currentQuestion.concept_title }}</h2>
            <div class="problem-prompt-rendered">
              <p class="prompt-text">{{ currentQuestion.prompt }}</p>
            </div>

            <!-- Concepto Madre Vinculado -->
            <div class="linked-notes-box">
              <h4>Concepto Asociado</h4>
              <RouterLink :to="'/notes?id=' + currentQuestion.concept_id" class="node-link">
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
                </svg>
                <span>{{ getConceptTitle(currentQuestion.concept_id) }}</span>
              </RouterLink>
            </div>

            <!-- Pista Conceptual -->
            <div class="hint-block-wrapper">
              <button @click="showHintText = !showHintText" class="btn-toggle-hint">
                <span>{{ showHintText ? 'Ocultar Pista' : 'Revelar Pista Teórica' }}</span>
              </button>
              <transition name="slide-fade">
                <p v-if="showHintText" class="hint-text-box">
                  Pista: Evalúa el flujo usando recursión o cierres léxicos. Revisa el caso base para evitar bucles infinitos en memoria.
                </p>
              </transition>
            </div>
          </div>

          <footer class="problem-footer-nav">
            <button @click="finish" class="btn-exit-code-lab">✕ Salir del Lab</button>
          </footer>
        </aside>

        <!-- PANELES DERECHOS (60%): Editor + Consola -->
        <main class="editor-console-wrapper">
          
          <!-- Editor de Código (Superior, 70% Alto) -->
          <div class="code-editor-panel">
            <div class="editor-bar">
              <span class="editor-filename">solucion.js</span>
              <span class="editor-lang">JavaScript</span>
            </div>
            
            <div class="editor-lines-view">
              <div class="gutter-lines">
                <span v-for="i in 16" :key="i">{{ i }}</span>
              </div>
              <textarea 
                v-model="codeAnswer" 
                class="code-textarea"
                spellcheck="false"
                :disabled="showReveal"
              ></textarea>
            </div>
          </div>

          <!-- Envío de la solución (antes había acá un "Correr Pruebas" que
               no ejecutaba nada real: un setTimeout fijo que marcaba PASSED
               sin mirar el código, y ni siquiera alimentaba la autoevaluación
               real de abajo. Se sacó — ver flujo real: escribir → enviar →
               comparar → autoevaluarte.) -->
          <div class="editor-action-bar" v-if="!showReveal">
            <button @click="handleVerify" class="btn-submit-code">
              Enviar Código
            </button>
          </div>

          <!-- Panel de Calificación Overlay cuando Envia -->
          <div v-if="showReveal" class="evaluation-panel-overlay">
            <div class="evaluation-inner-card animate-scale-up">
              <h3>Solución del Concepto</h3>
              <div class="solution-comparison">
                <div class="col-code">
                  <h4>Tu Código</h4>
                  <pre><code>{{ codeAnswer }}</code></pre>
                </div>
                <div class="col-code target">
                  <h4>Boilerplate Esperado</h4>
                  <pre><code>{{ currentQuestion.answer }}</code></pre>
                </div>
              </div>

              <div class="rating-box-premium">
                <h4>Autoevaluación: ¿Qué tan precisa fue tu implementación?</h4>
                <div class="rating-buttons-row">
                  <button @click="handleRate(1)" class="btn-rate again" :disabled="selectedRating !== null">
                    <span>Again (1)</span>
                    <small>No compiló / Falló</small>
                  </button>
                  <button @click="handleRate(2)" class="btn-rate hard" :disabled="selectedRating !== null">
                    <span>Hard (2)</span>
                    <small>Falla lógica / Lento</small>
                  </button>
                  <button @click="handleRate(3)" class="btn-rate good" :disabled="selectedRating !== null">
                    <span>Good (3)</span>
                    <small>Correcto</small>
                  </button>
                  <button @click="handleRate(4)" class="btn-rate easy" :disabled="selectedRating !== null">
                    <span>Easy (4)</span>
                    <small>Óptimo / Instantáneo</small>
                  </button>
                </div>
              </div>
            </div>
          </div>

        </main>

      </div>

      <!-- PANTALLA DE COMPLETO -->
      <div v-else-if="sessionComplete" class="complete-session-box animate-scale-up">
        <div class="art-icon">🏆</div>
        <h2>Laboratorio Algorítmico Finalizado</h2>
        <p>Has puesto en práctica tus conocimientos en problemas reales. Tus intervalos de estudio de código han sido programados.</p>
        
        <div class="metrics-grid">
          <div class="m-card text-red">
            <span class="v">{{ ratingCounts.again }}</span>
            <span class="l">Incorrectos</span>
          </div>
          <div class="m-card text-orange">
            <span class="v">{{ ratingCounts.hard }}</span>
            <span class="l">Con Esfuerzo</span>
          </div>
          <div class="m-card text-blue">
            <span class="v">{{ ratingCounts.good }}</span>
            <span class="l">Correctos</span>
          </div>
          <div class="m-card text-green">
            <span class="v">{{ ratingCounts.easy }}</span>
            <span class="l">Óptimos</span>
          </div>
        </div>

        <button @click="finish" class="btn-finish-lab">Finalizar Práctica</button>
      </div>

      <!-- Toast Popup -->
      <div class="toast-popup" :class="{ 'visible': triggerToast }">
        {{ toastMsg }}
      </div>

    </div>
  </div>
</template>
