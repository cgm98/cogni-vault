import { OutboxJob, CreateOutboxJobDto } from '../entities/outbox.entity.js';

export interface IOutboxRepository {
  enqueue(job: CreateOutboxJobDto): OutboxJob;
  claimPendingBatch(limit?: number): OutboxJob[];
  markCompleted(id: string): void;
  markFailed(id: string, error: string, nextScheduledAt?: string): void;
  markDiscarded(id: string, reason: string): void;
  getPendingCount(): number;
}
