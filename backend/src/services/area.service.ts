import { AreaRepository } from '../../infrastructure/repositories/area.repository.js';
import { Area } from '../../domain/entities/area.entity.js';
import { NotFoundError } from '../../domain/errors.js';

export class AreaService {
  constructor(private readonly areaRepo: AreaRepository) {}

  getAll(userId: string): Area[] {
    return this.areaRepo.getAll(userId);
  }

  getByCerebro(cerebroId: string, userId: string): Area[] {
    return this.areaRepo.getByCerebro(cerebroId, userId);
  }

  getById(id: string, userId: string): Area | undefined {
    return this.areaRepo.findById(id, userId);
  }

  create(data: Partial<Area>, userId: string): Area {
    const newArea: Area = {
      id: data.id || `area_${Date.now()}`,
      cerebro_id: data.cerebro_id || null,
      user_id: userId,
      name: data.name || 'Nueva Área',
      color: data.color || null,
      description: data.description || null,
      temporal_facet: data.temporal_facet || 'PAST_MEMORY'
    };
    this.areaRepo.create(newArea);
    return newArea;
  }

  update(id: string, data: Partial<Area>, userId: string): Area {
    const existing = this.areaRepo.findById(id, userId);
    if (!existing) throw new NotFoundError('Área no encontrada');

    const updated = { ...existing, ...data, id, user_id: userId };
    this.areaRepo.update(updated);
    return updated;
  }

  delete(id: string, userId: string): void {
    this.areaRepo.delete(id, userId);
  }
}

