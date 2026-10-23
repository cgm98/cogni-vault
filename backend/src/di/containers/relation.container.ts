import { RelationRepository } from '../../../infrastructure/repositories/relation.repository.js';
import { conceptRepository } from './concept.container.js';
import { RelationService } from '../../services/relation.service.js';

export const relationRepository = new RelationRepository();
export const relationService = new RelationService(relationRepository, conceptRepository);
