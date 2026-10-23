import { ConceptWithMemory } from '../entities/concept.entity.js';

export interface IReviewRepository {
  getDueQueue(userId: string): ConceptWithMemory[];
}
