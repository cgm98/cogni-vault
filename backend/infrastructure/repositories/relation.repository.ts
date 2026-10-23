import { eq, or } from 'drizzle-orm';
import { db } from '../../src/db.js';
import { relations } from '../../src/schemas/relation.schema.js';
import { IRelationRepository } from '../../domain/interfaces/relation.repository.interface.js';
import { Relation } from '../../domain/entities/relation.entity.js';

export class RelationRepository implements IRelationRepository {
  getAll(_userId?: string, limit = 500, offset = 0): Relation[] {
    return db.select()
      .from(relations)
      .limit(limit)
      .offset(offset)
      .all() as unknown as Relation[];
  }

  getForConcept(conceptId: string, _userId?: string): Relation[] {
    return db.select()
      .from(relations)
      .where(or(eq(relations.from_concept_id, conceptId), eq(relations.to_concept_id, conceptId)))
      .all() as unknown as Relation[];
  }

  getById(id: string): Relation | undefined {
    const res = db.select()
      .from(relations)
      .where(eq(relations.id, id))
      .get();
    return res ? (res as unknown as Relation) : undefined;
  }

  create(relation: Relation): void {
    db.insert(relations).values({
      id: relation.id,
      from_concept_id: relation.from_concept_id,
      to_concept_id: relation.to_concept_id,
      relation_type: relation.relation_type,
      confidence: relation.confidence ?? 0.7,
      source: relation.source ?? 'manual',
      created_at: relation.created_at || new Date().toISOString()
    }).run();
  }

  delete(id: string): void {
    db.delete(relations)
      .where(eq(relations.id, id))
      .run();
  }
}
