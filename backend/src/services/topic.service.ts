import { TopicRepository } from '../../infrastructure/repositories/topic.repository.js';
import { Topic } from '../../domain/entities/topic.entity.js';
import { NotFoundError, ValidationError } from '../../domain/errors.js';

export class TopicService {
  constructor(private readonly topicRepo: TopicRepository) {}

  getAll(userId: string): Topic[] {
    return this.topicRepo.getAll(userId);
  }

  getById(id: string, userId: string): Topic | undefined {
    return this.topicRepo.findById(id, userId);
  }

  findByDomain(domainId: string, userId: string): Topic[] {
    return this.topicRepo.findByDomain(domainId, userId);
  }

  create(data: Partial<Topic>, userId: string): Topic {
    if (!data.domain_id) throw new ValidationError('domain_id es obligatorio');
    const newTopic: Topic = {
      id: data.id || `topic_${Date.now()}`,
      user_id: userId,
      domain_id: data.domain_id,
      name: data.name || 'Nuevo Tema',
      color: data.color || null,
      description: data.description || null,
      temporal_facet: data.temporal_facet || 'PAST_MEMORY'
    };
    this.topicRepo.create(newTopic);
    return newTopic;
  }

  update(id: string, data: Partial<Topic>, userId: string): Topic {
    const existing = this.topicRepo.findById(id, userId);
    if (!existing) throw new NotFoundError('Tema no encontrado');

    const updated = { ...existing, ...data, id, user_id: userId };
    this.topicRepo.update(updated);
    return updated;
  }

  delete(id: string, userId: string): void {
    this.topicRepo.delete(id, userId);
  }
}
