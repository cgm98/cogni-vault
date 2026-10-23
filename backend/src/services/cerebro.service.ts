import { CerebroRepository } from '../../infrastructure/repositories/cerebro.repository.js';
import { Cerebro, CerebroKnowledgeTree } from '../../domain/entities/cerebro.entity.js';
import { NotFoundError } from '../../domain/errors.js';

export class CerebroService {
  constructor(private readonly cerebroRepo: CerebroRepository) {}

  getAll(userId: string): Cerebro[] {
    return this.cerebroRepo.getAll(userId);
  }

  getById(id: string, userId: string): Cerebro | undefined {
    return this.cerebroRepo.findById(id, userId);
  }

  getBySlug(slug: string, userId: string): Cerebro | undefined {
    return this.cerebroRepo.findBySlug(slug, userId);
  }

  create(data: Partial<Cerebro>, userId: string): Cerebro {
    const slug = (data.slug || data.name || `cerebro-${Date.now()}`)
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9_-]/g, '-');

    const now = new Date().toISOString();
    const newCerebro: Cerebro = {
      id: data.id || `cerebro_${Date.now()}`,
      slug,
      name: data.name || 'Nuevo Cerebro',
      description: data.description || null,
      icon: data.icon || 'brain',
      color: data.color || '#3B82F6',
      user_id: userId,
      created_at: now,
      updated_at: now
    };

    this.cerebroRepo.create(newCerebro);
    return newCerebro;
  }

  update(id: string, data: Partial<Cerebro>, userId: string): Cerebro {
    const existing = this.cerebroRepo.findById(id, userId);
    if (!existing) throw new NotFoundError('Cerebro no encontrado');

    const updated: Cerebro = {
      ...existing,
      ...data,
      id,
      user_id: userId,
      updated_at: new Date().toISOString()
    };

    this.cerebroRepo.update(updated);
    return updated;
  }

  delete(id: string, userId: string): void {
    this.cerebroRepo.delete(id, userId);
  }

  getKnowledgeTree(id: string, userId: string): CerebroKnowledgeTree | undefined {
    return this.cerebroRepo.getCerebroTree(id, userId);
  }
}
