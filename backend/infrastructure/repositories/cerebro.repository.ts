import { eq, and, inArray, isNull } from 'drizzle-orm';
import { db } from '../../src/db.js';
import { cerebros } from '../../src/schemas/cerebro.schema.js';
import { areas } from '../../src/schemas/area.schema.js';
import { domains } from '../../src/schemas/domain.schema.js';
import { topics } from '../../src/schemas/topic.schema.js';
import { concepts } from '../../src/schemas/concept.schema.js';
import { Cerebro, CerebroKnowledgeTree } from '../../domain/entities/cerebro.entity.js';

export class CerebroRepository {
  getAll(userId: string): Cerebro[] {
    return db.select()
      .from(cerebros)
      .where(eq(cerebros.user_id, userId))
      .all() as unknown as Cerebro[];
  }

  findById(id: string, userId: string): Cerebro | undefined {
    const res = db.select()
      .from(cerebros)
      .where(and(eq(cerebros.id, id), eq(cerebros.user_id, userId)))
      .get();
    return res ? (res as unknown as Cerebro) : undefined;
  }

  findBySlug(slug: string, userId: string): Cerebro | undefined {
    const res = db.select()
      .from(cerebros)
      .where(and(eq(cerebros.slug, slug), eq(cerebros.user_id, userId)))
      .get();
    return res ? (res as unknown as Cerebro) : undefined;
  }

  create(cerebro: Cerebro): void {
    db.insert(cerebros).values({
      id: cerebro.id,
      slug: cerebro.slug,
      name: cerebro.name,
      description: cerebro.description ?? null,
      icon: cerebro.icon ?? 'brain',
      color: cerebro.color ?? '#3B82F6',
      user_id: cerebro.user_id,
      created_at: cerebro.created_at,
      updated_at: cerebro.updated_at
    }).run();
  }

  update(cerebro: Cerebro): void {
    db.update(cerebros)
      .set({
        name: cerebro.name,
        slug: cerebro.slug,
        description: cerebro.description ?? null,
        icon: cerebro.icon ?? 'brain',
        color: cerebro.color ?? '#3B82F6',
        updated_at: cerebro.updated_at
      })
      .where(and(eq(cerebros.id, cerebro.id), eq(cerebros.user_id, cerebro.user_id)))
      .run();
  }

  delete(id: string, userId: string): void {
    db.delete(cerebros)
      .where(and(eq(cerebros.id, id), eq(cerebros.user_id, userId)))
      .run();
  }

  getCerebroTree(id: string, userId: string): CerebroKnowledgeTree | undefined {
    const cerebro = this.findById(id, userId);
    if (!cerebro) return undefined;

    const cerebroAreas = db.select().from(areas).where(and(eq(areas.cerebro_id, id), eq(areas.user_id, userId))).all();
    const cerebroDomains = cerebroAreas.length ? db.select().from(domains).where(and(eq(domains.user_id, userId), inArray(domains.area_id, cerebroAreas.map(a => a.id)))).all() : [];
    const ownedTopics = db.select().from(topics).where(eq(topics.user_id, userId)).all();
    const domainIds = new Set(cerebroDomains.map(d => d.id));
    const cerebroTopics = ownedTopics.filter(t => domainIds.has(t.domain_id));
    const topicMap = new Map(ownedTopics.map(t => [t.id, t]));
    const cerebroConcepts = db.select().from(concepts).where(and(eq(concepts.user_id, userId), isNull(concepts.deleted_at))).all()
      .filter(c => domainIds.has((c.topic_id && topicMap.get(c.topic_id)?.domain_id) || c.domain));

    return {
      id: cerebro.id,
      name: cerebro.name,
      areas: cerebroAreas,
      domains: cerebroDomains,
      topics: cerebroTopics,
      concepts: cerebroConcepts
    };
  }
}
