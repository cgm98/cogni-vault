export type OutboxJobStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

export type OutboxJobType = 
  | 'INDEX_FTS'
  | 'EMBEDDING_VEC'
  | 'INVALIDATE_TREE_CACHE'
  | 'SYNC_HIERARCHY';

export interface OutboxJob {
  id: string;
  job_type: OutboxJobType | string;
  entity_type: string;
  entity_id: string;
  entity_version: number;
  payload: string | null;
  status: OutboxJobStatus;
  retry_count: number;
  max_retries: number;
  last_error: string | null;
  scheduled_at: string;
  created_at: string;
}

export interface CreateOutboxJobDto {
  job_type: OutboxJobType | string;
  entity_type: string;
  entity_id: string;
  entity_version: number;
  payload?: string | null;
  scheduled_at?: string;
  max_retries?: number;
}
