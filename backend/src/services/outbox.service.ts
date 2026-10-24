import { IOutboxRepository } from '../../domain/interfaces/outbox.repository.interface.js';
import { OutboxJob } from '../../domain/entities/outbox.entity.js';

export type JobHandler = (job: OutboxJob) => Promise<void> | void;

export class OutboxService {
  private handlers = new Map<string, JobHandler>();
  private timer: NodeJS.Timeout | null = null;
  private isProcessing = false;

  constructor(private readonly outboxRepository: IOutboxRepository) {}

  registerHandler(jobType: string, handler: JobHandler): void {
    this.handlers.set(jobType, handler);
  }

  async processNextBatch(limit = 10): Promise<{ processed: number; completed: number; failed: number }> {
    if (this.isProcessing) return { processed: 0, completed: 0, failed: 0 };
    this.isProcessing = true;

    let completed = 0;
    let failed = 0;

    try {
      const jobs = this.outboxRepository.claimPendingBatch(limit);

      for (const job of jobs) {
        const handler = this.handlers.get(job.job_type);

        if (!handler) {
          // Si no hay handler registrado (e.g. invalidate cache no-op), se marca como completado
          this.outboxRepository.markCompleted(job.id);
          completed++;
          continue;
        }

        try {
          await handler(job);
          this.outboxRepository.markCompleted(job.id);
          completed++;
        } catch (err: any) {
          this.outboxRepository.markFailed(job.id, err.message || 'Error en ejecución de trabajo');
          failed++;
        }
      }

      return { processed: jobs.length, completed, failed };
    } finally {
      this.isProcessing = false;
    }
  }

  start(intervalMs = 2000): void {
    if (this.timer) return;
    this.timer = setInterval(async () => {
      try {
        await this.processNextBatch();
      } catch (err) {
        console.error('[OutboxService] Error en bucle de procesamiento:', err);
      }
    }, intervalMs);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
