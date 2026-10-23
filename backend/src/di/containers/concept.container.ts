import { ConceptRepository, ConceptVersionRepository } from '../../../infrastructure/repositories/concept.repository.js';
import { domainRepository } from './domain.container.js';
import { ConceptService } from '../../services/concept.service.js';

export const conceptRepository = new ConceptRepository();
export const conceptVersionRepository = new ConceptVersionRepository();

export const conceptService = new ConceptService(
  conceptRepository,
  domainRepository,
  conceptVersionRepository
);
