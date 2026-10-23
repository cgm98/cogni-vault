import { Concept, ConceptWithMemory, ConceptSummary, TemporalFacet } from '../entities/concept.entity.js';

export interface IConceptRepository {
  getAll(userId: string, limit?: number, offset?: number): ConceptWithMemory[];
  getSummaries(userId: string): ConceptSummary[];
  findById(id: string, userId: string): ConceptWithMemory | undefined;
  findByTitle(title: string, userId: string): Concept | undefined;
  findByDomain(domainId: string, userId: string): Concept[];
  listByFacet(cerebroId: string, facet: TemporalFacet, userId: string): Concept[];
  create(concept: Concept): void;
  update(concept: Partial<Concept> & { id: string }, userId?: string): ConceptWithMemory | void;
  delete(id: string, userId: string): void;
  softDelete(id: string, userId: string): void;
  restore(id: string, userId: string): void;
  purge(id: string, userId: string): void;
  getTrashed(userId: string): Concept[];
}
