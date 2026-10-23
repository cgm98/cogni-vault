import { ConceptVersion, ConceptVersionSummary } from '../entities/concept-version.entity.js';

export interface IConceptVersionRepository {
  create(version: ConceptVersion): void;
  getForConcept(conceptId: string): ConceptVersionSummary[];
  findById(id: string): ConceptVersion | undefined;
  latestCreatedAt(conceptId: string): string | null | undefined;
}
