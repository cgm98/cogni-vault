import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import { EpistemicRepository } from '../backend/infrastructure/repositories/epistemic.repository';
import { OutboxRepository } from '../backend/infrastructure/repositories/outbox.repository';
import { EpistemicService } from '../backend/src/services/epistemic.service';
import { ValidationError, NotFoundError } from '../backend/domain/errors';

test('Phase 3: Source Inmutability and SHA-256 Hashing', () => {
  const epistemicRepo = new EpistemicRepository();
  const outboxRepo = new OutboxRepository();
  const service = new EpistemicService(epistemicRepo, outboxRepo);

  const ws = 'ws-src-' + Date.now();
  const rawPaper = 'Experimental analysis of high-temperature conductivity in cuprates under 1 atm.';
  const expectedHash = crypto.createHash('sha256').update(rawPaper).digest('hex');

  // 1. Registro calculando hash automáticamente a partir del contenido
  const source1 = service.createSource({
    workspace_id: ws,
    title: 'Superconductivity in Cuprates',
    raw_content: rawPaper,
    mime_type: 'text/markdown',
    metadata: { author: 'Müller et al.', year: 1986 }
  });

  assert.equal(source1.content_hash, expectedHash);
  assert.equal(source1.title, 'Superconductivity in Cuprates');

  // 2. Búsqueda por hash
  const found = epistemicRepo.findSourceByHash(ws, expectedHash);
  assert.ok(found);
  assert.equal(found!.id, source1.id);

  // 3. Fallo si no se proporciona ni hash ni raw_content
  assert.throws(() => {
    service.createSource({
      workspace_id: ws,
      title: 'Fuente Sin Hash'
    });
  }, ValidationError);
});

test('Phase 3: Evidence Anchors & Precise Locators', () => {
  const epistemicRepo = new EpistemicRepository();
  const outboxRepo = new OutboxRepository();
  const service = new EpistemicService(epistemicRepo, outboxRepo);

  const ws = 'ws-anchors-' + Date.now();
  const source = service.createSource({
    workspace_id: ws,
    title: 'Manual de Termodinámica',
    content_hash: 'abc123hash',
    mime_type: 'application/pdf'
  });

  // 1. Ancla basada en desplazamiento de texto (TEXT_OFFSET)
  const anchorText = service.createAnchor({
    source_id: source.id,
    locator_type: 'TEXT_OFFSET',
    locator_payload: { start: 1050, end: 1240 },
    exact_quote: 'La entropía de un sistema aislado nunca decrece.',
    context_before: 'Según el segundo principio,',
    context_after: 'Esto establece la flecha del tiempo.'
  });

  assert.equal(anchorText.source_id, source.id);
  assert.equal(anchorText.exact_quote, 'La entropía de un sistema aislado nunca decrece.');

  // 2. Ancla basada en coordenadas de página PDF (PDF_PAGE_BBOX)
  const anchorPdf = service.createAnchor({
    source_id: source.id,
    locator_type: 'PDF_PAGE_BBOX',
    locator_payload: { page: 42, bbox: [50, 100, 400, 250] },
    exact_quote: 'dS >= dQ / T'
  });

  assert.equal(anchorPdf.locator_type, 'PDF_PAGE_BBOX');

  // 3. Cita textual vacía debe fallar
  assert.throws(() => {
    service.createAnchor({
      source_id: source.id,
      locator_type: 'TEXT_OFFSET',
      locator_payload: { start: 0, end: 10 },
      exact_quote: ''
    });
  }, ValidationError);
});

test('Phase 3: Claims Lifecycle, Review Rules & Contradiction Detection', async () => {
  const { sqlite } = await import('../backend/src/db');
  const epistemicRepo = new EpistemicRepository();
  const outboxRepo = new OutboxRepository();
  const service = new EpistemicService(epistemicRepo, outboxRepo);

  const ws = 'ws-claim-' + Date.now();
  const conceptId = 'c-claim-' + Date.now();
  const now = new Date().toISOString();

  // Crear concepto base
  sqlite.prepare(`
    INSERT INTO concepts (id, workspace_id, title, explanation, domain, version, created_at, updated_at)
    VALUES (?, ?, 'Superconductores', 'Contenido', 'd', 1, ?, ?)
  `).run(conceptId, ws, now, now);

  // Crear fuente y dos anclas (una que apoya y otra que refuta)
  const source = service.createSource({
    workspace_id: ws,
    title: 'Paper Conductividad 2026',
    content_hash: 'hash-evidence-1',
    mime_type: 'application/pdf'
  });

  const anchorSupport = service.createAnchor({
    source_id: source.id,
    locator_type: 'TEXT_OFFSET',
    locator_payload: { page: 3 },
    exact_quote: 'El compuesto X exhibe resistencia nula a 95 Kelvin.'
  });

  const anchorRefute = service.createAnchor({
    source_id: source.id,
    locator_type: 'TEXT_OFFSET',
    locator_payload: { page: 8 },
    exact_quote: 'Bajo presiones inferiores a 5 GPa, el compuesto X se comporta como aislante.'
  });

  // 1. Crear Claim (afirmación)
  const claim = service.createClaim({
    concept_id: conceptId,
    statement: 'El compuesto X es superconductor a presión ambiente a 95K.',
    conditions: 'Presión = 1 atm, T <= 95K',
    provenance: 'HUMAN'
  });

  assert.equal(claim.status, 'PROPOSED');

  // 2. Invariante: No se puede verificar sin evidencia SUPPORTS
  assert.throws(() => {
    service.reviewClaim(claim.id, 'VERIFIED', 'user-reviewer-1');
  }, ValidationError);

  // 3. Vincular evidencia favorable (SUPPORTS)
  service.linkEvidence({
    claim_id: claim.id,
    anchor_id: anchorSupport.id,
    support_type: 'SUPPORTS',
    notes: 'Confirmado por medición de susceptibilidad magnética.'
  });

  // 4. Ahora la verificación es válida
  const verifiedClaim = service.reviewClaim(claim.id, 'VERIFIED', 'user-reviewer-1');
  assert.equal(verifiedClaim.status, 'VERIFIED');
  assert.equal(verifiedClaim.reviewed_by, 'user-reviewer-1');

  // 5. Vincular evidencia contradictoria (REFUTES) -> El sistema transiciona automáticamente a CONTRADICTED
  service.linkEvidence({
    claim_id: claim.id,
    anchor_id: anchorRefute.id,
    support_type: 'REFUTES',
    notes: 'La muestra no conduce a presión ambiente.'
  });

  const contradictedClaim = epistemicRepo.findClaimById(claim.id)!;
  assert.equal(contradictedClaim.status, 'CONTRADICTED');

  // 6. Intentar verificar mientras persista la evidencia contradictoria debe fallar
  assert.throws(() => {
    service.reviewClaim(claim.id, 'VERIFIED', 'user-reviewer-1');
  }, ValidationError);
});

test('Phase 3: Epistemic Relations and Graph Retrieval', async () => {
  const { sqlite } = await import('../backend/src/db');
  const epistemicRepo = new EpistemicRepository();
  const outboxRepo = new OutboxRepository();
  const service = new EpistemicService(epistemicRepo, outboxRepo);

  const ws = 'ws-graph-' + Date.now();
  const conceptId = 'c-graph-' + Date.now();
  const now = new Date().toISOString();

  sqlite.prepare(`
    INSERT INTO concepts (id, workspace_id, title, explanation, domain, version, created_at, updated_at)
    VALUES (?, ?, 'Termodinámica Estadística', 'Contenido', 'd', 1, ?, ?)
  `).run(conceptId, ws, now, now);

  const source = service.createSource({
    workspace_id: ws,
    title: 'Boltzmann 1877',
    content_hash: 'boltzmann-sha-hash',
    mime_type: 'text/markdown'
  });

  const anchor = service.createAnchor({
    source_id: source.id,
    locator_type: 'TEXT_OFFSET',
    locator_payload: { section: 2 },
    exact_quote: 'S = k * ln(W)'
  });

  // Dos afirmaciones interconectadas
  const claimA = service.createClaim({
    concept_id: conceptId,
    statement: 'El número de microestados W determina la entropía macroscópica S.'
  });

  const claimB = service.createClaim({
    concept_id: conceptId,
    statement: 'En el equilibrio termodinámico, el sistema maximiza W.'
  });

  service.linkEvidence({
    claim_id: claimA.id,
    anchor_id: anchor.id,
    support_type: 'SUPPORTS'
  });

  // 1. Relación epistémica de causalidad
  const rel = service.createRelation({
    source_claim_id: claimA.id,
    target_claim_id: claimB.id,
    relation_type: 'CAUSES',
    confidence: 0.95
  });

  assert.equal(rel.relation_type, 'CAUSES');
  assert.equal(rel.status, 'PENDING_REVIEW');

  // 2. Aceptar relación
  service.updateRelationStatus(rel.id, 'ACCEPTED');
  const acceptedRels = epistemicRepo.listRelationsForClaim(claimA.id);
  assert.equal(acceptedRels[0].status, 'ACCEPTED');

  // 3. Prevenir auto-relación
  assert.throws(() => {
    service.createRelation({
      source_claim_id: claimA.id,
      target_claim_id: claimA.id,
      relation_type: 'ANALOGOUS'
    });
  }, ValidationError);

  // 4. Recuperación del Grafo Epistémico Completo para el Concepto
  const graph = service.getConceptEpistemicGraph(conceptId);
  assert.equal(graph.claims.length, 2);
  assert.equal(graph.evidence.length, 1);
  assert.equal(graph.evidence[0].source.title, 'Boltzmann 1877');
  assert.equal(graph.relations.length, 1);
  assert.equal(graph.relations[0].id, rel.id);
});
