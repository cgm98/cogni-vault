import {
  IAnalyticsRepository,
  GlobalStats,
  DomainDistributionItem,
  KnowledgeGapItem,
  ActivityEvent
} from '../../domain/interfaces/analytics.repository.interface.js';

export interface DashboardStats {
  stats: GlobalStats;
  domainDist: DomainDistributionItem[];
}

export class AnalyticsService {
  constructor(private readonly analyticsRepository: IAnalyticsRepository) {}

  getStats(userId: string): DashboardStats {
    return {
      stats: this.analyticsRepository.getGlobalStats(userId),
      domainDist: this.analyticsRepository.getDomainDistribution(userId)
    };
  }

  getGaps(userId: string): KnowledgeGapItem[] {
    return this.analyticsRepository.getKnowledgeGaps(userId);
  }

  getEvents(limit = 15): ActivityEvent[] {
    return this.analyticsRepository.getRecentEvents(limit);
  }
}
