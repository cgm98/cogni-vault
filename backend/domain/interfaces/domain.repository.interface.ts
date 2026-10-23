import { Domain } from '../entities/domain.entity.js';

export interface IDomainRepository {
  getAll(userId: string): Domain[];
  findById(id: string, userId: string): Domain | undefined;
  findBySlug(slug: string, userId: string): Domain | undefined;
  create(domain: Domain): void;
  update(domain: Domain): void;
  delete(id: string, userId: string): void;
}
