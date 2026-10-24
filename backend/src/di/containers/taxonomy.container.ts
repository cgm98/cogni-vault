import { TaxonomyRepository } from '../../../infrastructure/repositories/taxonomy.repository.js';
import { TagRepository } from '../../../infrastructure/repositories/tag.repository.js';
import { outboxRepository } from './folder.container.js';
import { TaxonomyService } from '../../services/taxonomy.service.js';
import { ConceptDocumentService } from '../../services/concept-document.service.js';

export const taxonomyRepository = new TaxonomyRepository();
export const tagRepository = new TagRepository();

export const taxonomyService = new TaxonomyService(
  taxonomyRepository,
  tagRepository,
  outboxRepository
);

export const conceptDocumentService = new ConceptDocumentService(outboxRepository);
