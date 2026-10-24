import { ValidationError } from '../../domain/errors.js';
import { CerebroRepository } from './cerebro.repository.js';
import { eq, and, isNull, desc } from 'drizzle-orm';
import { db, sqlite } from '../../src/db.js';
import { concepts, concept_versions } from '../../src/schemas/concept.schema.js';
import { IConceptRepository } from '../../domain/interfaces/concept.repository.interface.js';
import { IConceptVersionRepository } from '../../domain/interfaces/concept-version.repository.interface.js';
import { Concept, ConceptWithMemory, ConceptSummary, TemporalFacet } from '../../domain/entities/concept.entity.js';
import { ConceptVersion, ConceptVersionSummary } from '../../domain/entities/concept-version.entity.js';

export class ConceptRepository implements IConceptRepository {
  private validateLocation(note: Partial<Concept>) {
    if (!note.workspace_id && !note.folder_id) return;
    if (!note.workspace_id || !sqlite.prepare('SELECT id FROM cerebros WHERE id=? AND user_id=?').get(note.workspace_id, note.user_id)) {
      throw new ValidationError('El espacio no existe o no pertenece al usuario');
    }
    if (note.folder_id && !sqlite.prepare('SELECT id FROM folders WHERE id=? AND workspace_id=? AND deleted_at IS NULL').get(note.folder_id, note.workspace_id)) {
      throw new ValidationError('La carpeta de destino no está disponible en este espacio');
    }
  }
  getAll(userId: string, limit = 50, offset = 0): ConceptWithMemory[] {
    return db.select()
      .from(concepts)
      .where(and(eq(concepts.user_id, userId), isNull(concepts.deleted_at)))
      .limit(limit)
      .offset(offset)
      .all() as unknown as ConceptWithMemory[];
  }

  getSummaries(userId: string): ConceptSummary[] {
    return db.select({
      id: concepts.id,
      title: concepts.title,
      workspace_id: concepts.workspace_id, folder_id: concepts.folder_id,
      domain: concepts.domain,
      topic_id: concepts.topic_id,
      created_at: concepts.created_at,
      temporal_facet: concepts.temporal_facet,
      updated_at: concepts.updated_at
    })
      .from(concepts)
      .where(and(eq(concepts.user_id, userId), isNull(concepts.deleted_at)))
      .orderBy(desc(concepts.updated_at))
      .all() as unknown as ConceptSummary[];
  }

  findById(id: string, userId: string): ConceptWithMemory | undefined {
    const res = db.select()
      .from(concepts)
      .where(and(eq(concepts.id, id), eq(concepts.user_id, userId)))
      .get();
    return res ? (res as unknown as ConceptWithMemory) : undefined;
  }

  findByTitle(title: string, userId: string): Concept | undefined {
    const res = db.select()
      .from(concepts)
      .where(and(eq(concepts.title, title), eq(concepts.user_id, userId)))
      .get();
    return res ? (res as unknown as Concept) : undefined;
  }

  findByDomain(domainId: string, userId: string): Concept[] {
    return db.select()
      .from(concepts)
      .where(and(eq(concepts.domain, domainId), eq(concepts.user_id, userId), isNull(concepts.deleted_at)))
      .all() as unknown as Concept[];
  }

  listByFacet(cerebroId: string, facet: TemporalFacet, userId: string): Concept[] {
    const tree = new CerebroRepository().getCerebroTree(cerebroId, userId);
    return (tree?.concepts || []).filter(c => c.temporal_facet === facet) as unknown as Concept[];
  }

  create(concept: Concept): void {
    this.validateLocation(concept);
    const now = new Date().toISOString();
    db.insert(concepts).values({
      id: concept.id,
      user_id: concept.user_id,
      workspace_id: concept.workspace_id ?? null, folder_id: concept.folder_id ?? null,
      domain: concept.domain || 'sin-clasificar',
      topic_id: concept.topic_id ?? null,
      title: concept.title,
      explanation: concept.explanation,
      intuition: concept.intuition ?? null,
      difficulty: concept.difficulty || 3,
      strength: concept.strength ?? 0.7,
      temporal_facet: concept.temporal_facet || 'PAST_MEMORY',
      facet_subtype: concept.facet_subtype ?? null,
      status: concept.status || 'active',
      author_type: concept.author_type || 'human',
      created_at: concept.created_at || now,
      updated_at: concept.updated_at || now
    }).run();
  }

  update(data: Partial<Concept> & { id: string }, userId?: string): ConceptWithMemory | void {
    if (data.workspace_id !== undefined || data.folder_id !== undefined) {
      const existing = sqlite.prepare('SELECT * FROM concepts WHERE id=?').get(data.id) as Concept | undefined;
      this.validateLocation({ ...existing, ...data, user_id: userId || data.user_id || existing?.user_id });
    }
    const now = new Date().toISOString();
    const whereClause = userId
      ? and(eq(concepts.id, data.id), eq(concepts.user_id, userId))
      : eq(concepts.id, data.id);

    const { id: _id, domain, ...rest } = data;
    const valuesToSet: any = {
      ...rest,
      updated_at: now
    };
    if (domain !== undefined && domain !== null) {
      valuesToSet.domain = domain;
    }

    db.update(concepts)
      .set(valuesToSet)
      .where(whereClause)
      .run();

    if (userId) {
      return this.findById(data.id, userId);
    }
  }

  delete(id: string, userId: string): void {
    this.softDelete(id, userId);
  }

  softDelete(id: string, userId: string): void {
    db.update(concepts)
      .set({ deleted_at: new Date().toISOString() })
      .where(and(eq(concepts.id, id), eq(concepts.user_id, userId)))
      .run();
  }

  restore(id: string, userId: string): void {
    db.update(concepts)
      .set({ deleted_at: null })
      .where(and(eq(concepts.id, id), eq(concepts.user_id, userId)))
      .run();
  }

  purge(id: string, userId: string): void {
    db.delete(concepts)
      .where(and(eq(concepts.id, id), eq(concepts.user_id, userId)))
      .run();
  }

  getTrashed(userId: string): Concept[] {
    return db.select()
      .from(concepts)
      .where(and(eq(concepts.user_id, userId), concepts.deleted_at))
      .all() as unknown as Concept[];
  }
}

export class ConceptVersionRepository implements IConceptVersionRepository {
  create(version: ConceptVersion): void {
    db.insert(concept_versions).values({
      id: version.id,
      concept_id: version.concept_id,
      title: version.title,
      explanation: version.explanation,
      created_at: version.created_at
    }).run();
  }

  getForConcept(conceptId: string): ConceptVersionSummary[] {
    return db.select({
      id: concept_versions.id,
      concept_id: concept_versions.concept_id,
      created_at: concept_versions.created_at
    })
      .from(concept_versions)
      .where(eq(concept_versions.concept_id, conceptId))
      .orderBy(desc(concept_versions.created_at))
      .all() as unknown as ConceptVersionSummary[];
  }

  findById(id: string): ConceptVersion | undefined {
    const res = db.select()
      .from(concept_versions)
      .where(eq(concept_versions.id, id))
      .get();
    return res ? (res as unknown as ConceptVersion) : undefined;
  }

  latestCreatedAt(conceptId: string): string | null | undefined {
    const res = db.select({ created_at: concept_versions.created_at })
      .from(concept_versions)
      .where(eq(concept_versions.concept_id, conceptId))
      .orderBy(desc(concept_versions.created_at))
      .limit(1)
      .get();
    return res?.created_at;
  }
}
