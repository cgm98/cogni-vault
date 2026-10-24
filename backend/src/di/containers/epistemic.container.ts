import { EpistemicRepository } from '../../../infrastructure/repositories/epistemic.repository.js';
import { outboxRepository } from './folder.container.js';
import { EpistemicService } from '../../services/epistemic.service.js';

export const epistemicRepository = new EpistemicRepository();
export const epistemicService = new EpistemicService(epistemicRepository, outboxRepository);
