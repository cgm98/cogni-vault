import { eq, and } from 'drizzle-orm';
import { db } from '../../src/db.js';
import { topics } from '../../src/schemas/topic.schema.js';
import { Topic } from '../../domain/entities/topic.entity.js';

export class TopicRepository {
  getAll(userId: string): Topic[] {
    return db.select()
      .from(topics)
      .where(eq(topics.user_id, userId))
      .all() as unknown as Topic[];
  }

  findById(id: string, userId: string): Topic | undefined {
    const res = db.select()
      .from(topics)
      .where(and(eq(topics.id, id), eq(topics.user_id, userId)))
      .get();
    return res ? (res as unknown as Topic) : undefined;
  }

  findByDomain(domainId: string, userId: string): Topic[] {
    return db.select()
      .from(topics)
      .where(and(eq(topics.domain_id, domainId), eq(topics.user_id, userId)))
      .all() as unknown as Topic[];
  }

  create(topic: Topic): void {
    db.insert(topics).values({
      id: topic.id,
      user_id: topic.user_id,
      domain_id: topic.domain_id,
      name: topic.name,
      description: topic.description ?? null,
      color: topic.color ?? null,
      temporal_facet: topic.temporal_facet ?? 'PAST_MEMORY'
    }).run();
  }

  update(topic: Topic): void {
    db.update(topics)
      .set({
        name: topic.name,
        description: topic.description ?? null,
        color: topic.color ?? null,
        temporal_facet: topic.temporal_facet ?? 'PAST_MEMORY'
      })
      .where(and(eq(topics.id, topic.id), eq(topics.user_id, topic.user_id)))
      .run();
  }

  delete(id: string, userId: string): void {
    db.delete(topics)
      .where(and(eq(topics.id, id), eq(topics.user_id, userId)))
      .run();
  }
}
