import { Domain } from '../../domain/entities/domain.entity.js';
import { IDomainRepository } from '../../domain/interfaces/domain.repository.interface.js';
import { NotFoundError } from '../../domain/errors.js';

export class DomainService {
  constructor(private readonly domainRepository: IDomainRepository) {}

  getAll(userId: string): Domain[] {
    return this.domainRepository.getAll(userId);
  }

  getById(id: string, userId: string): Domain | undefined {
    return this.domainRepository.findById(id, userId);
  }

  create(data: Partial<Domain>, userId: string): Domain {
    const id = data.id || `domain_${Date.now()}`;
    const newDomain: Domain = {
      id,
      user_id: userId,
      name: data.name!,
      color: data.color || '#6b7280',
      description: data.description || null,
      area_id: data.area_id || null,
      temporal_facet: data.temporal_facet || 'PAST_MEMORY'
    };
    this.domainRepository.create(newDomain);
    return newDomain;
  }

  update(id: string, data: Partial<Domain>, userId: string): Domain {
    const existing = this.domainRepository.findById(id, userId);
    if (!existing) {
      throw new NotFoundError('Dominio no encontrado');
    }
    const updated: Domain = {
      id,
      user_id: userId,
      name: data.name || existing.name,
      color: data.color || existing.color,
      description: data.description !== undefined ? data.description : existing.description,
      area_id: data.area_id !== undefined ? data.area_id : existing.area_id,
      temporal_facet: data.temporal_facet !== undefined ? data.temporal_facet : existing.temporal_facet
    };
    this.domainRepository.update(updated);
    return updated;
  }


  delete(id: string, userId: string): void {
    const existing = this.domainRepository.findById(id, userId);
    if (!existing) {
      throw new NotFoundError('Dominio no encontrado');
    }
    this.domainRepository.delete(id, userId);
  }
}
