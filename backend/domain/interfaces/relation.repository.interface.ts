import { Relation } from '../entities/relation.entity.js';

export interface IRelationRepository {
  getAll(userId?: string, limit?: number, offset?: number): Relation[];
  getForConcept(conceptId: string, userId?: string): Relation[];
  getById(id: string): Relation | undefined;
  create(relation: Relation): void;
  delete(id: string): void;
}
