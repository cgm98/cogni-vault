import { Database } from 'better-sqlite3';
import { sqlite } from '../../src/db.js';
import {
  ISearchRepository,
  FtsMatchRecord,
  KnnMatchRecord
} from '../../domain/interfaces/search.repository.interface.js';
import {
  FtsIndexEntry,
  IndexMetadataEntry,
  SearchEntityType
} from '../../domain/entities/search.entity.js';

export class SearchRepository implements ISearchRepository {
  private db: Database;

  constructor(customDb?: Database) {
    this.db = customDb || sqlite;
  }

  // --- FTS5 Léxico ---
  upsertFts(entry: FtsIndexEntry): void {
    const tx = this.db.transaction(() => {
      this.db.prepare('DELETE FROM knowledge_fts WHERE entity_id = ?').run(entry.entity_id);
      this.db.prepare(`
        INSERT INTO knowledge_fts (entity_id, entity_type, workspace_id, title, content)
        VALUES (?, ?, ?, ?, ?)
      `).run(
        entry.entity_id,
        entry.entity_type,
        entry.workspace_id,
        entry.title || '',
        entry.content || ''
      );
    });
    tx();
  }

  deleteFts(entityId: string): void {
    this.db.prepare('DELETE FROM knowledge_fts WHERE entity_id = ?').run(entityId);
  }

  // --- sqlite-vec Vectorial ---
  upsertVector(entityId: string, embedding: Float32Array): void {
    const tx = this.db.transaction(() => {
      this.db.prepare('DELETE FROM knowledge_vectors WHERE entity_id = ?').run(entityId);
      this.db.prepare(`
        INSERT INTO knowledge_vectors (entity_id, embedding)
        VALUES (?, ?)
      `).run(entityId, embedding);
    });
    tx();
  }

  deleteVector(entityId: string): void {
    this.db.prepare('DELETE FROM knowledge_vectors WHERE entity_id = ?').run(entityId);
  }

  // --- Consultas Léxicas ---
  queryFts(
    rawQuery: string,
    workspaceId: string,
    limit: number,
    entityTypes?: SearchEntityType[]
  ): FtsMatchRecord[] {
    const sanitized = this.sanitizeFts5Query(rawQuery);
    if (!sanitized) return [];

    let sql = `
      SELECT entity_id, entity_type, workspace_id, title, content, bm25(knowledge_fts) as bm25_rank
      FROM knowledge_fts
      WHERE knowledge_fts MATCH ? AND workspace_id = ?
    `;
    const params: any[] = [sanitized, workspaceId];

    if (entityTypes && entityTypes.length > 0) {
      const placeholders = entityTypes.map(() => '?').join(',');
      sql += ` AND entity_type IN (${placeholders})`;
      params.push(...entityTypes);
    }

    sql += ` ORDER BY bm25_rank ASC LIMIT ?`;
    params.push(limit);

    try {
      const rows = this.db.prepare(sql).all(...params) as any[];
      return rows.map(r => ({
        entity_id: r.entity_id,
        entity_type: r.entity_type,
        workspace_id: r.workspace_id,
        title: r.title,
        content: r.content,
        bm25_rank: Number(r.bm25_rank)
      }));
    } catch {
      return [];
    }
  }

  // --- Consultas Vectoriales KNN ---
  queryKnn(embedding: Float32Array, limit: number): KnnMatchRecord[] {
    try {
      const rows = this.db.prepare(`
        SELECT entity_id, distance
        FROM knowledge_vectors
        WHERE embedding MATCH ?
          AND k = ?
      `).all(embedding, limit) as any[];

      return rows.map(r => ({
        entity_id: r.entity_id,
        distance: Number(r.distance)
      }));
    } catch {
      return [];
    }
  }

  // --- Metadatos de Indexación ---
  getMetadata(entityId: string): IndexMetadataEntry | null {
    const row = this.db.prepare(`
      SELECT entity_id, entity_type, workspace_id, version, fts_indexed_at, vec_indexed_at, content_hash
      FROM knowledge_index_metadata
      WHERE entity_id = ?
    `).get(entityId) as any;

    if (!row) return null;
    return {
      entity_id: row.entity_id,
      entity_type: row.entity_type,
      workspace_id: row.workspace_id,
      version: row.version,
      fts_indexed_at: row.fts_indexed_at,
      vec_indexed_at: row.vec_indexed_at,
      content_hash: row.content_hash
    };
  }

  upsertMetadata(entry: IndexMetadataEntry): void {
    this.db.prepare(`
      INSERT INTO knowledge_index_metadata (
        entity_id, entity_type, workspace_id, version, fts_indexed_at, vec_indexed_at, content_hash
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(entity_id) DO UPDATE SET
        workspace_id = excluded.workspace_id,
        version = excluded.version,
        fts_indexed_at = coalesce(excluded.fts_indexed_at, knowledge_index_metadata.fts_indexed_at),
        vec_indexed_at = coalesce(excluded.vec_indexed_at, knowledge_index_metadata.vec_indexed_at),
        content_hash = coalesce(excluded.content_hash, knowledge_index_metadata.content_hash)
    `).run(
      entry.entity_id,
      entry.entity_type,
      entry.workspace_id,
      entry.version,
      entry.fts_indexed_at || null,
      entry.vec_indexed_at || null,
      entry.content_hash || null
    );
  }

  deleteMetadata(entityId: string): void {
    this.db.prepare('DELETE FROM knowledge_index_metadata WHERE entity_id = ?').run(entityId);
  }

  getEntityPayload(entityId: string): {
    entity_id: string;
    entity_type: SearchEntityType;
    workspace_id: string;
    title: string;
    content: string;
  } | null {
    // 1. Conceptos
    const concept = this.db.prepare(`
      SELECT id, workspace_id, title, explanation
      FROM concepts WHERE id = ? AND deleted_at IS NULL
    `).get(entityId) as any;
    if (concept) {
      return {
        entity_id: concept.id,
        entity_type: 'concept',
        workspace_id: concept.workspace_id,
        title: concept.title,
        content: concept.explanation || ''
      };
    }

    // 2. Fuentes
    const source = this.db.prepare(`
      SELECT id, workspace_id, title, metadata
      FROM sources WHERE id = ?
    `).get(entityId) as any;
    if (source) {
      return {
        entity_id: source.id,
        entity_type: 'source',
        workspace_id: source.workspace_id,
        title: source.title,
        content: source.metadata || ''
      };
    }

    // 3. Anclas de evidencia
    const anchor = this.db.prepare(`
      SELECT ea.id, ea.exact_quote, ea.context_before, ea.context_after, s.workspace_id, s.title as source_title
      FROM evidence_anchors ea
      JOIN sources s ON ea.source_id = s.id
      WHERE ea.id = ?
    `).get(entityId) as any;
    if (anchor) {
      const fullQuote = [anchor.context_before, anchor.exact_quote, anchor.context_after].filter(Boolean).join(' ');
      return {
        entity_id: anchor.id,
        entity_type: 'anchor',
        workspace_id: anchor.workspace_id,
        title: `Evidencia: ${anchor.source_title}`,
        content: fullQuote
      };
    }

    // 4. Afirmaciones (claims)
    const claim = this.db.prepare(`
      SELECT clm.id, clm.statement, clm.conditions, c.workspace_id, c.title as concept_title
      FROM claims clm
      JOIN concepts c ON clm.concept_id = c.id
      WHERE clm.id = ? AND c.deleted_at IS NULL
    `).get(entityId) as any;
    if (claim) {
      const content = claim.conditions ? `${claim.statement} (Condiciones: ${claim.conditions})` : claim.statement;
      return {
        entity_id: claim.id,
        entity_type: 'claim',
        workspace_id: claim.workspace_id,
        title: `Afirmación en: ${claim.concept_title}`,
        content
      };
    }

    return null;
  }

  // --- Sanitizador FTS5 para evitar SyntaxError y filtrar palabras vacías en queries OR ---
  private static readonly STOPWORDS = new Set([
    'de', 'la', 'el', 'en', 'un', 'una', 'unos', 'unas', 'y', 'o', 'a', 'al', 'del',
    'los', 'las', 'por', 'con', 'para', 'se', 'su', 'sus', 'es', 'son', 'que',
    'the', 'in', 'of', 'and', 'or', 'to', 'at', 'on', 'a', 'an', 'is', 'it'
  ]);

  private sanitizeFts5Query(query: string): string {
    const cleaned = query
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .trim();
    if (!cleaned) return '';

    const rawTokens = cleaned.split(/\s+/).filter(t => t.length > 0);
    if (rawTokens.length === 0) return '';

    // Filtrar palabras vacías y tokens de 1-2 caracteres para consultas multi-término
    const contentTokens = rawTokens.filter(
      t => t.length > 2 && !SearchRepository.STOPWORDS.has(t.toLowerCase())
    );

    const tokensToUse = contentTokens.length > 0 ? contentTokens : rawTokens;

    // Enlazamos tokens con comodín de prefijo (*)
    return tokensToUse.map(t => `"${t}"*`).join(' OR ');
  }
}
