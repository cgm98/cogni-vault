import { sqliteTable, text, real, index, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { concepts } from './concept.schema.js';

// --- 1. FUENTES DOCUMENTALES (ARTÍCULOS, PAPERS, DOCUMENTOS CON HASH INMUTABLE) ---
export const sources = sqliteTable('sources', {
  id: text('id').primaryKey(),
  workspace_id: text('workspace_id').notNull(),
  title: text('title').notNull(),
  uri: text('uri'),                          // Ruta local o identificador externo (DOI, arXiv, URL)
  content_hash: text('content_hash').notNull(), // SHA-256 para verificar inmutabilidad
  mime_type: text('mime_type').notNull(),    // e.g. 'application/pdf', 'text/markdown'
  metadata: text('metadata'),                // JSON: autores, año, volumen, DOI
  created_at: text('created_at').notNull()
}, (table) => ({
  workspaceIdx: index('idx_sources_workspace').on(table.workspace_id),
  hashIdx: index('idx_sources_hash').on(table.content_hash)
}));

// --- 2. ANCLAS DE EVIDENCIA (FRAGMENTOS Y LOCALIZADORES EXACTOS DENTRO DE FUENTES) ---
export const evidence_anchors = sqliteTable('evidence_anchors', {
  id: text('id').primaryKey(),
  source_id: text('source_id').notNull().references(() => sources.id, { onDelete: 'cascade' }),
  locator_type: text('locator_type', { enum: ['TEXT_OFFSET', 'DOM_SELECTOR', 'PDF_PAGE_BBOX', 'BLOCK_ID'] }).notNull(),
  locator_payload: text('locator_payload').notNull(), // JSON: { start: 120, end: 340 } o { page: 4, bbox: [x,y,w,h] }
  exact_quote: text('exact_quote').notNull(),         // Texto exacto citado de la fuente
  context_before: text('context_before'),
  context_after: text('context_after'),
  created_at: text('created_at').notNull()
}, (table) => ({
  sourceIdx: index('idx_anchors_source').on(table.source_id)
}));

// --- 3. AFIRMACIONES EPISTÉMICAS (CLAIMS PROVENIENTES DE NOTAS) ---
export const claims = sqliteTable('claims', {
  id: text('id').primaryKey(),
  concept_id: text('concept_id').notNull().references(() => concepts.id, { onDelete: 'cascade' }),
  statement: text('statement').notNull(),
  conditions: text('conditions'),            // e.g. "T > 300K, Presión = 1 atm"
  status: text('status', { enum: ['PROPOSED', 'VERIFIED', 'CONTRADICTED', 'DEPRECATED'] }).default('PROPOSED').notNull(),
  provenance: text('provenance', { enum: ['HUMAN', 'MODEL_INFERENCE'] }).default('HUMAN').notNull(),
  model_version: text('model_version'),
  reviewed_by: text('reviewed_by'),
  reviewed_at: text('reviewed_at'),
  created_at: text('created_at').notNull()
}, (table) => ({
  conceptIdx: index('idx_claims_concept').on(table.concept_id),
  statusIdx: index('idx_claims_status').on(table.status)
}));

// --- 4. VINCULACIÓN AFIRMACIÓN <-> ANCLAJE DE EVIDENCIA ---
export const claim_evidence = sqliteTable('claim_evidence', {
  claim_id: text('claim_id').notNull().references(() => claims.id, { onDelete: 'cascade' }),
  anchor_id: text('anchor_id').notNull().references(() => evidence_anchors.id, { onDelete: 'cascade' }),
  support_type: text('support_type', { enum: ['SUPPORTS', 'REFUTES', 'INCONCLUSIVE'] }).notNull(),
  notes: text('notes'),
  created_at: text('created_at').notNull()
}, (table) => ({
  pk: uniqueIndex('pk_claim_evidence').on(table.claim_id, table.anchor_id),
  anchorIdx: index('idx_claim_evidence_anchor').on(table.anchor_id)
}));

// --- 5. RELACIONES EPISTÉMICAS TIPADAS ENTRE AFIRMACIONES ---
export const epistemic_relations = sqliteTable('epistemic_relations', {
  id: text('id').primaryKey(),
  source_claim_id: text('source_claim_id').notNull().references(() => claims.id, { onDelete: 'cascade' }),
  target_claim_id: text('target_claim_id').notNull().references(() => claims.id, { onDelete: 'cascade' }),
  relation_type: text('relation_type', { enum: ['CAUSES', 'PREREQUISITE', 'EXTENDS', 'ANALOGOUS', 'CONTRADICTS'] }).notNull(),
  confidence: real('confidence').default(1.0).notNull(),
  status: text('status', { enum: ['PENDING_REVIEW', 'ACCEPTED', 'REJECTED'] }).default('PENDING_REVIEW').notNull(),
  provenance: text('provenance', { enum: ['HUMAN', 'MODEL_INFERENCE'] }).default('HUMAN').notNull(),
  created_at: text('created_at').notNull()
}, (table) => ({
  sourceIdx: index('idx_epistemic_rel_source').on(table.source_claim_id),
  targetIdx: index('idx_epistemic_rel_target').on(table.target_claim_id)
}));
