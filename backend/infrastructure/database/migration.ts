import Database from 'better-sqlite3';

export function runPhase1Migrations(db: Database.Database): void {
  // 1. Tabla de carpetas
  db.exec(`
    CREATE TABLE IF NOT EXISTS folders (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      parent_id TEXT REFERENCES folders(id) ON DELETE RESTRICT,
      name TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      version INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT,
      trash_batch_id TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_folders_parent ON folders(parent_id);
    CREATE INDEX IF NOT EXISTS idx_folders_workspace ON folders(workspace_id);
    
    -- Índices parciales para unicidad sin colisión de NULLs
    CREATE UNIQUE INDEX IF NOT EXISTS idx_folders_unique_children 
      ON folders(workspace_id, parent_id, name) 
      WHERE deleted_at IS NULL AND parent_id IS NOT NULL;

    CREATE UNIQUE INDEX IF NOT EXISTS idx_folders_unique_root 
      ON folders(workspace_id, name) 
      WHERE deleted_at IS NULL AND parent_id IS NULL;
  `);

  // 2. Tabla de lotes de papelera
  db.exec(`
    CREATE TABLE IF NOT EXISTS trash_batches (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      initiated_by TEXT NOT NULL,
      item_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      restored_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_trash_batches_workspace ON trash_batches(workspace_id);
  `);

  // 3. Tabla de outbox jobs
  db.exec(`
    CREATE TABLE IF NOT EXISTS outbox_jobs (
      id TEXT PRIMARY KEY,
      job_type TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      entity_version INTEGER NOT NULL,
      payload TEXT,
      status TEXT NOT NULL DEFAULT 'PENDING',
      retry_count INTEGER NOT NULL DEFAULT 0,
      max_retries INTEGER NOT NULL DEFAULT 5,
      last_error TEXT,
      scheduled_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_outbox_queue 
      ON outbox_jobs(status, scheduled_at) 
      WHERE status IN ('PENDING', 'FAILED');
  `);

  // 4. Asegurar columnas de concepts si la tabla ya existe
  const hasConcepts = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='concepts'").get();
  if (hasConcepts) {
    const conceptColumns = db.prepare('PRAGMA table_info(concepts)').all() as { name: string }[];
    const colNames = new Set(conceptColumns.map(c => c.name));

    if (!colNames.has('workspace_id')) {
      db.exec(`ALTER TABLE concepts ADD COLUMN workspace_id TEXT;`);
    }
    if (!colNames.has('folder_id')) {
      db.exec(`ALTER TABLE concepts ADD COLUMN folder_id TEXT;`);
    }
    if (!colNames.has('version')) {
      db.exec(`ALTER TABLE concepts ADD COLUMN version INTEGER NOT NULL DEFAULT 1;`);
    }
    if (!colNames.has('trash_batch_id')) {
      db.exec(`ALTER TABLE concepts ADD COLUMN trash_batch_id TEXT;`);
    }

    // Índices para concepts
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_concepts_folder ON concepts(folder_id);
      CREATE INDEX IF NOT EXISTS idx_concepts_workspace ON concepts(workspace_id);
      CREATE INDEX IF NOT EXISTS idx_concepts_active ON concepts(workspace_id, deleted_at);
    `);
  }
}

export function runPhase2Migrations(db: Database.Database): void {
  // 1. Tabla taxonomy_terms
  db.exec(`
    CREATE TABLE IF NOT EXISTS taxonomy_terms (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      parent_id TEXT REFERENCES taxonomy_terms(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      color TEXT,
      description TEXT,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_tax_parent ON taxonomy_terms(parent_id);
    CREATE INDEX IF NOT EXISTS idx_tax_workspace ON taxonomy_terms(workspace_id);
    
    CREATE UNIQUE INDEX IF NOT EXISTS idx_tax_unique_children 
      ON taxonomy_terms(workspace_id, parent_id, name) 
      WHERE parent_id IS NOT NULL;

    CREATE UNIQUE INDEX IF NOT EXISTS idx_tax_unique_root 
      ON taxonomy_terms(workspace_id, name) 
      WHERE parent_id IS NULL;
  `);

  // 2. Tabla concept_taxonomy
  db.exec(`
    CREATE TABLE IF NOT EXISTS concept_taxonomy (
      concept_id TEXT NOT NULL REFERENCES concepts(id) ON DELETE CASCADE,
      term_id TEXT NOT NULL REFERENCES taxonomy_terms(id) ON DELETE CASCADE,
      is_inherited INTEGER NOT NULL DEFAULT 0,
      source_folder_id TEXT,
      assigned_at TEXT NOT NULL,
      PRIMARY KEY (concept_id, term_id)
    );

    CREATE INDEX IF NOT EXISTS idx_concept_taxonomy_term ON concept_taxonomy(term_id);
  `);

  // 3. Tabla tags
  db.exec(`
    CREATE TABLE IF NOT EXISTS tags (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      name TEXT NOT NULL,
      color TEXT,
      created_at TEXT NOT NULL
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_tags_unique_name ON tags(workspace_id, name);
  `);

  // 4. Tabla concept_tags
  db.exec(`
    CREATE TABLE IF NOT EXISTS concept_tags (
      concept_id TEXT NOT NULL REFERENCES concepts(id) ON DELETE CASCADE,
      tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL,
      PRIMARY KEY (concept_id, tag_id)
    );

    CREATE INDEX IF NOT EXISTS idx_concept_tags_tag ON concept_tags(tag_id);
  `);

  // 5. Añadir doc_ast y schema_version a concepts si la tabla ya existe
  const hasConcepts = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='concepts'").get();
  if (hasConcepts) {
    const conceptColumns = db.prepare('PRAGMA table_info(concepts)').all() as { name: string }[];
    const colNames = new Set(conceptColumns.map(c => c.name));

    if (!colNames.has('doc_ast')) {
      db.exec(`ALTER TABLE concepts ADD COLUMN doc_ast TEXT;`);
    }
    if (!colNames.has('schema_version')) {
      db.exec(`ALTER TABLE concepts ADD COLUMN schema_version INTEGER NOT NULL DEFAULT 1;`);
    }
  }
}

export function runPhase3Migrations(db: Database.Database): void {
  // 1. Fuentes (sources)
  db.exec(`
    CREATE TABLE IF NOT EXISTS sources (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      title TEXT NOT NULL,
      uri TEXT,
      content_hash TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      metadata TEXT,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_sources_workspace ON sources(workspace_id);
    CREATE INDEX IF NOT EXISTS idx_sources_hash ON sources(content_hash);
  `);

  // 2. Anclas de evidencia (evidence_anchors)
  db.exec(`
    CREATE TABLE IF NOT EXISTS evidence_anchors (
      id TEXT PRIMARY KEY,
      source_id TEXT NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
      locator_type TEXT NOT NULL,
      locator_payload TEXT NOT NULL,
      exact_quote TEXT NOT NULL,
      context_before TEXT,
      context_after TEXT,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_anchors_source ON evidence_anchors(source_id);
  `);

  // 3. Afirmaciones (claims)
  db.exec(`
    CREATE TABLE IF NOT EXISTS claims (
      id TEXT PRIMARY KEY,
      concept_id TEXT NOT NULL REFERENCES concepts(id) ON DELETE CASCADE,
      statement TEXT NOT NULL,
      conditions TEXT,
      status TEXT NOT NULL DEFAULT 'PROPOSED',
      provenance TEXT NOT NULL DEFAULT 'HUMAN',
      model_version TEXT,
      reviewed_by TEXT,
      reviewed_at TEXT,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_claims_concept ON claims(concept_id);
    CREATE INDEX IF NOT EXISTS idx_claims_status ON claims(status);
  `);

  // 4. Evidencia de afirmaciones (claim_evidence)
  db.exec(`
    CREATE TABLE IF NOT EXISTS claim_evidence (
      claim_id TEXT NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
      anchor_id TEXT NOT NULL REFERENCES evidence_anchors(id) ON DELETE CASCADE,
      support_type TEXT NOT NULL,
      notes TEXT,
      created_at TEXT NOT NULL,
      PRIMARY KEY (claim_id, anchor_id)
    );

    CREATE INDEX IF NOT EXISTS idx_claim_evidence_anchor ON claim_evidence(anchor_id);
  `);

  // 5. Relaciones epistémicas (epistemic_relations)
  db.exec(`
    CREATE TABLE IF NOT EXISTS epistemic_relations (
      id TEXT PRIMARY KEY,
      source_claim_id TEXT NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
      target_claim_id TEXT NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
      relation_type TEXT NOT NULL,
      confidence REAL NOT NULL DEFAULT 1.0,
      status TEXT NOT NULL DEFAULT 'PENDING_REVIEW',
      provenance TEXT NOT NULL DEFAULT 'HUMAN',
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_epistemic_rel_source ON epistemic_relations(source_claim_id);
    CREATE INDEX IF NOT EXISTS idx_epistemic_rel_target ON epistemic_relations(target_claim_id);
  `);
}

export function runPhase4Migrations(db: Database.Database): void {
  // 1. Tabla virtual de búsqueda léxica FTS5
  db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS knowledge_fts USING fts5(
      entity_id UNINDEXED,
      entity_type UNINDEXED,
      workspace_id UNINDEXED,
      title,
      content,
      tokenize = 'unicode61 remove_diacritics 2'
    );
  `);

  // 2. Tabla virtual de vectores semánticos vec0 (sqlite-vec)
  try {
    db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS knowledge_vectors USING vec0(
        entity_id TEXT PRIMARY KEY,
        embedding float[768] distance_metric=cosine
      );
    `);
  } catch (err: any) {
    console.warn('[Phase4 Migration] Advertencia al crear knowledge_vectors (vec0):', err.message);
  }

  // 3. Tabla de metadatos de sincronización de índices
  db.exec(`
    CREATE TABLE IF NOT EXISTS knowledge_index_metadata (
      entity_id TEXT PRIMARY KEY,
      entity_type TEXT NOT NULL,
      workspace_id TEXT NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      fts_indexed_at TEXT,
      vec_indexed_at TEXT,
      content_hash TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_index_meta_ws ON knowledge_index_metadata(workspace_id);
    CREATE INDEX IF NOT EXISTS idx_index_meta_type ON knowledge_index_metadata(entity_type);
  `);
}

