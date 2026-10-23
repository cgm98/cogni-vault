import { eq, and } from 'drizzle-orm';
import { db } from '../../src/db.js';
import { domains } from '../../src/schemas/domain.schema.js';
import { IDomainRepository } from '../../domain/interfaces/domain.repository.interface.js';
import { Domain } from '../../domain/entities/domain.entity.js';

export class DomainRepository implements IDomainRepository {
  getAll(userId: string): Domain[] {
    return db.select()
      .from(domains)
      .where(eq(domains.user_id, userId))
      .all() as unknown as Domain[];
  }

  findById(id: string, userId: string): Domain | undefined {
    const res = db.select()
      .from(domains)
      .where(and(eq(domains.id, id), eq(domains.user_id, userId)))
      .get();
    return res ? (res as unknown as Domain) : undefined;
  }

  findBySlug(_slug: string, _userId: string): Domain | undefined {
    return undefined;
  }

  create(domain: Domain): void {
    db.insert(domains).values({
      id: domain.id,
      user_id: domain.user_id,
      name: domain.name,
      color: domain.color || '#6b7280',
      description: domain.description ?? null,
      area_id: domain.area_id ?? null,
      temporal_facet: domain.temporal_facet || 'PAST_MEMORY'
    }).run();
  }

  update(domain: Domain): void {
    db.update(domains)
      .set({
        name: domain.name,
        color: domain.color || '#6b7280',
        description: domain.description ?? null,
        area_id: domain.area_id ?? null,
        temporal_facet: domain.temporal_facet || 'PAST_MEMORY'
      })
      .where(and(eq(domains.id, domain.id), eq(domains.user_id, domain.user_id)))
      .run();
  }

  delete(id: string, userId: string): void {
    db.delete(domains)
      .where(and(eq(domains.id, id), eq(domains.user_id, userId)))
      .run();
  }
}
