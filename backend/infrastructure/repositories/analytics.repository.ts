import { count, eq } from 'drizzle-orm';
import { db } from '../../src/db.js';
import { concepts } from '../../src/schemas/concept.schema.js';
import { domains } from '../../src/schemas/domain.schema.js';
import {
  IAnalyticsRepository,
  GlobalStats,
  DomainDistributionItem,
  KnowledgeGapItem,
  ActivityEvent
} from '../../domain/interfaces/analytics.repository.interface.js';

export class AnalyticsRepository implements IAnalyticsRepository {
  getGlobalStats(userId: string): GlobalStats {
    const [c] = db.select({ val: count() }).from(concepts).where(eq(concepts.user_id, userId)).all();
    const [d] = db.select({ val: count() }).from(domains).where(eq(domains.user_id, userId)).all();

    return {
      totalConcepts: c?.val ?? 0,
      totalDomains: d?.val ?? 0,
      totalReviews: 0
    };
  }

  getDomainDistribution(userId: string): DomainDistributionItem[] {
    const list = db.select({
      domainId: domains.id,
      domainName: domains.name,
      count: count(concepts.id)
    })
      .from(domains)
      .leftJoin(concepts, eq(concepts.domain, domains.id))
      .where(eq(domains.user_id, userId))
      .groupBy(domains.id, domains.name)
      .all();

    return list.map(item => ({
      domainId: item.domainId,
      domainName: item.domainName,
      count: Number(item.count)
    }));
  }

  getKnowledgeGaps(_userId: string): KnowledgeGapItem[] {
    return [];
  }

  getRecentEvents(_limit = 15): ActivityEvent[] {
    return [];
  }
}
