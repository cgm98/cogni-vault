import test from 'node:test';
import assert from 'node:assert/strict';
import { DeterministicHashEmbeddingProvider } from '../backend/infrastructure/embedding/embedding.provider.js';
import { SearchRepository } from '../backend/infrastructure/repositories/search.repository.js';
import { SearchIndexerService } from '../backend/src/services/search-indexer.service.js';
import { HybridSearchService } from '../backend/src/services/hybrid-search.service.js';
import { EvidenceCandidateService } from '../backend/src/services/evidence-candidate.service.js';
import { EpistemicRepository } from '../backend/infrastructure/repositories/epistemic.repository.js';
import { OutboxRepository } from '../backend/infrastructure/repositories/outbox.repository.js';
import { OutboxService } from '../backend/src/services/outbox.service.js';
import { sqlite } from '../backend/src/db.js';

test('Phase 4: Deterministic Embedding Provider & L2 Unit Norm', async () => {
  const provider = new DeterministicHashEmbeddingProvider();

  const textA = 'Conductividad eléctrica en cupratos a altas temperaturas';
  const textAClone = 'Conductividad eléctrica en cupratos a altas temperaturas';
  const textBSimilar = 'Medición de la resistividad nula en superconductores de óxido de cobre';
  const textCUnrelated = 'Receta tradicional de pasta con salsa de tomate y albahaca';

  const vecA = await provider.embed(textA);
  const vecAClone = await provider.embed(textAClone);
  const vecBSimilar = await provider.embed(textBSimilar);
  const vecCUnrelated = await provider.embed(textCUnrelated);

  // 1. Invariante dimensional (exactamente 768 componentes float32)
  assert.equal(vecA.length, 768);
  assert.equal(provider.dimension, 768);

  // 2. Invariante de norma euclidiana L2 (||v|| = 1.0)
  const normA = Math.sqrt(vecA.reduce((sum, val) => sum + val * val, 0));
  assert.ok(Math.abs(normA - 1.0) < 1e-5, `Norma L2 debe ser 1.0, obtenido: ${normA}`);

  // 3. Determinismo estricto
  for (let i = 0; i < 768; i++) {
    assert.equal(vecA[i], vecAClone[i], `Inconsistencia determinista en componente ${i}`);
  }

  // 4. Propiedades de distancia de coseno (dot product de vectores unitarios)
  const cosineSim = (v1: Float32Array, v2: Float32Array) => {
    let dot = 0;
    for (let i = 0; i < 768; i++) dot += v1[i] * v2[i];
    return dot;
  };

  const simSelf = cosineSim(vecA, vecA);
  const simRelated = cosineSim(vecA, vecBSimilar);
  const simUnrelated = cosineSim(vecA, vecCUnrelated);

  assert.ok(Math.abs(simSelf - 1.0) < 1e-5, 'Similitud consigo mismo debe ser 1.0');
  assert.ok(simRelated > simUnrelated, 'Similitud temática debe superar significativamente a dominio no relacionado');
  assert.ok(simUnrelated < 0.35, `Dominio no relacionado debe tener baja similitud, obtenido: ${simUnrelated}`);
});

test('Phase 4: FTS5 Lexical Indexing with Diacritic Normalization and BM25', () => {
  const repo = new SearchRepository();
  const ws = 'ws-fts-' + Date.now();
  const entityId = 'concept-fts-' + Date.now();

  // Indexar con acentos ortográficos en español
  repo.upsertFts({
    entity_id: entityId,
    entity_type: 'concept',
    workspace_id: ws,
    title: 'Superconductividad en Cúpratos',
    content: 'El fenómeno de resistividad nula ocurre bajo presiones de transición de fase.'
  });

  // 1. Búsqueda sin acentos ("cupratos presiones") -> Debe emparejar gracias al tokenizador unicode61
  const matches = repo.queryFts('cupratos transicion', ws, 10);
  assert.equal(matches.length, 1);
  assert.equal(matches[0].entity_id, entityId);
  assert.equal(matches[0].workspace_id, ws);
  assert.ok(matches[0].bm25_rank < 0, 'Rank BM25 debe ser negativo');

  // 2. Búsqueda con comodines y múltiples palabras
  const matches2 = repo.queryFts('fenomeno resistividad', ws, 10);
  assert.equal(matches2.length, 1);

  // 3. Aislamiento de workspace
  const matchesOtherWs = repo.queryFts('cupratos', 'ws-otra-inexistente', 10);
  assert.equal(matchesOtherWs.length, 0);

  // 4. Eliminación
  repo.deleteFts(entityId);
  const matchesAfterDelete = repo.queryFts('cupratos', ws, 10);
  assert.equal(matchesAfterDelete.length, 0);
});

test('Phase 4: sqlite-vec (vec0) Dense KNN Search', async () => {
  const repo = new SearchRepository();
  const provider = new DeterministicHashEmbeddingProvider();

  const id1 = 'vec-ent-1-' + Date.now();
  const id2 = 'vec-ent-2-' + Date.now();

  const vec1 = await provider.embed('Termodinámica estadística y microestados');
  const vec2 = await provider.embed('Física cuántica y entrelazamiento de fotones');

  repo.upsertVector(id1, vec1);
  repo.upsertVector(id2, vec2);

  // Consulta por vector similar a vec1
  const queryVec = await provider.embed('Termodinámica de sistemas macroscópicos');
  const knnResults = repo.queryKnn(queryVec, 2);

  assert.ok(knnResults.length >= 2);
  // id1 debe estar en primer lugar por mayor proximidad semántica
  const firstMatch = knnResults.find(r => r.entity_id === id1);
  const secondMatch = knnResults.find(r => r.entity_id === id2);

  assert.ok(firstMatch, 'id1 debe estar en los resultados');
  assert.ok(secondMatch, 'id2 debe estar en los resultados');
  assert.ok(firstMatch!.distance < secondMatch!.distance, 'Distancia de id1 debe ser menor que id2');

  // Limpieza
  repo.deleteVector(id1);
  repo.deleteVector(id2);
});

test('Phase 4: Hybrid Search & Reciprocal Rank Fusion (RRF)', async () => {
  const repo = new SearchRepository();
  const provider = new DeterministicHashEmbeddingProvider();
  const hybridSearch = new HybridSearchService(repo, provider);

  const ws = 'ws-hybrid-' + Date.now();
  const now = new Date().toISOString();

  // Insertar conceptos en la base de datos para que getEntityPayload funcione
  const c1Id = 'c-hyb-1-' + Date.now();
  const c2Id = 'c-hyb-2-' + Date.now();

  sqlite.prepare(`
    INSERT INTO concepts (id, workspace_id, title, explanation, domain, version, created_at, updated_at)
    VALUES (?, ?, 'Superconductores Tipo II', 'Tienen dos campos magnéticos críticos Hc1 y Hc2.', 'fisica', 1, ?, ?)
  `).run(c1Id, ws, now, now);

  sqlite.prepare(`
    INSERT INTO concepts (id, workspace_id, title, explanation, domain, version, created_at, updated_at)
    VALUES (?, ?, 'Aislantes Topológicos', 'Conducen electricidad únicamente en sus bordes o superficie.', 'fisica', 1, ?, ?)
  `).run(c2Id, ws, now, now);

  // Indexar ambos en FTS5 y sqlite-vec
  const indexer = new SearchIndexerService(repo, provider);
  await indexer.indexEntity('concept', c1Id);
  await indexer.indexEntity('concept', c2Id);

  // Ejecutar búsqueda híbrida equilibrada (alpha = 0.5)
  const results = await hybridSearch.search('campo magnético crítico superconductores', ws, {
    limit: 10,
    alpha: 0.5
  });

  assert.ok(results.total_results >= 1);
  assert.equal(results.items[0].entity_id, c1Id);
  assert.ok(results.items[0].hybrid_score > 0);
  assert.ok(results.items[0].hybrid_score <= 1.0);
  assert.ok(results.items[0].snippet.includes('críticos'));

  // Aislamiento: otra workspace no debe ver nada
  const otherWsResults = await hybridSearch.search('superconductores', 'ws-empty', { limit: 10 });
  assert.equal(otherWsResults.total_results, 0);

  // Limpieza
  indexer.deleteEntity(c1Id);
  indexer.deleteEntity(c2Id);
});

test('Phase 4: Evidence Candidate Generator & Strict Abstention Invariant', async () => {
  const repo = new SearchRepository();
  const provider = new DeterministicHashEmbeddingProvider();
  const hybridSearch = new HybridSearchService(repo, provider);
  const epistemicRepo = new EpistemicRepository();
  const outboxRepo = new OutboxRepository();
  const candidateService = new EvidenceCandidateService(hybridSearch, epistemicRepo);
  const indexer = new SearchIndexerService(repo, provider);

  const ws = 'ws-candidate-' + Date.now();

  // 1. Crear Fuente y Ancla de Evidencia
  const source = epistemicRepo.createSource({
    workspace_id: ws,
    title: 'Estudio de Resistencia en Nuevos Materiales 2026',
    content_hash: 'hash-cand-source-1',
    mime_type: 'application/pdf'
  });

  const anchorRefute = epistemicRepo.createAnchor({
    source_id: source.id,
    locator_type: 'TEXT_OFFSET',
    locator_payload: { page: 12 },
    exact_quote: 'Bajo presiones inferiores a 5 GPa, la muestra no conduce y se comporta como un aislante dieléctrico.'
  });

  // Indexar el ancla para búsqueda
  await indexer.indexEntity('anchor', anchorRefute.id);

  // 2. Búsqueda de candidatos para una afirmación afín
  const candidateResponse = await candidateService.findCandidates(
    ws,
    'El material conduce a presión ambiente sin resistencia',
    'P = 1 atm',
    { threshold: 0.25 }
  );

  assert.equal(candidateResponse.status, 'CANDIDATES_FOUND');
  assert.ok(candidateResponse.candidates.length >= 1);

  const topCand = candidateResponse.candidates[0];
  assert.equal(topCand.anchor_id, anchorRefute.id);
  assert.equal(topCand.potential_relation, 'REFUTES'); // Detecta "no conduce" / "aislante"
  assert.equal(topCand.candidate_only, true);

  // 3. INVARIANTE DE ABSTENCIÓN (Abstain when evidence is insufficient)
  // Al buscar sobre un tema sin ninguna evidencia relevante en el corpus:
  const abstainResponse = await candidateService.findCandidates(
    ws,
    'Historia de la arquitectura gótica en la Francia medieval',
    undefined,
    { threshold: 0.40 } // Con umbral estándar
  );

  assert.equal(abstainResponse.status, 'ABSTAIN');
  assert.equal(abstainResponse.candidates.length, 0);
  assert.ok(
    abstainResponse.reason === 'INSUFFICIENT_EVIDENCE' || abstainResponse.reason === 'NO_MATCH',
    `Motivo debe indicar falta de evidencia, obtenido: ${abstainResponse.reason}`
  );

  // Limpieza
  indexer.deleteEntity(anchorRefute.id);
});

test('Phase 4: Outbox Worker Asynchronous Indexing Pipeline', async () => {
  const repo = new SearchRepository();
  const provider = new DeterministicHashEmbeddingProvider();
  const outboxRepo = new OutboxRepository();
  const outboxService = new OutboxService(outboxRepo);
  const indexer = new SearchIndexerService(repo, provider);

  // Conectar indexador a los eventos del outbox
  indexer.registerOutboxHandlers(outboxService);

  const ws = 'ws-outbox-idx-' + Date.now();
  const conceptId = 'c-outbox-idx-' + Date.now();
  const now = new Date().toISOString();

  // Limpiar jobs previos para aislamiento de test
  sqlite.exec('DELETE FROM outbox_jobs;');

  // Insertar concepto
  sqlite.prepare(`
    INSERT INTO concepts (id, workspace_id, title, explanation, domain, version, created_at, updated_at)
    VALUES (?, ?, 'Fotónica Integrada', 'Circuitos ópticos en obleas de silicio para interconexiones ultrarrápidas.', 'optica', 1, ?, ?)
  `).run(conceptId, ws, now, now);

  // Encolar trabajo de indexación en outbox
  outboxRepo.enqueue({
    job_type: 'INDEX_FTS',
    entity_type: 'concept',
    entity_id: conceptId,
    entity_version: 1,
    payload: JSON.stringify({ action: 'index' })
  });

  // 1. Procesar lote mediante el Outbox Worker
  const batchResult = await outboxService.processNextBatch();
  assert.equal(batchResult.completed, 1);
  assert.equal(batchResult.failed, 0);

  // 2. Verificar que el concepto fue indexado en FTS5
  const ftsMatches = repo.queryFts('fotonica silicio', ws, 5);
  assert.equal(ftsMatches.length, 1);
  assert.equal(ftsMatches[0].entity_id, conceptId);

  // 3. Verificar metadatos
  const meta = repo.getMetadata(conceptId);
  assert.ok(meta);
  assert.equal(meta!.entity_id, conceptId);
  assert.ok(meta!.fts_indexed_at);
  assert.ok(meta!.vec_indexed_at);

  // Limpieza
  indexer.deleteEntity(conceptId);
});
