import { DomainRepository } from '../../../infrastructure/repositories/domain.repository.js';
import { DomainService } from '../../services/domain.service.js';

export const domainRepository = new DomainRepository();
export const domainService = new DomainService(domainRepository);
