export interface GlobalStats {
  totalConcepts: number;
  totalDomains: number;
  totalReviews?: number;
}

export interface DomainDistributionItem {
  domainId: string;
  domainName: string;
  count: number;
}

export interface KnowledgeGapItem {
  id: string;
  title: string;
  reason: string;
}

export interface ActivityEvent {
  id: string;
  type: string;
  timestamp: string;
  data: any;
}

export interface IAnalyticsRepository {
  getGlobalStats(userId: string): GlobalStats;
  getDomainDistribution(userId: string): DomainDistributionItem[];
  getKnowledgeGaps(userId: string): KnowledgeGapItem[];
  getRecentEvents(limit?: number): ActivityEvent[];
}
