import crypto from 'crypto';
import { sqlite } from '../../src/db.js';
import { IOutboxRepository } from '../../domain/interfaces/outbox.repository.interface.js';
import { OutboxJob, CreateOutboxJobDto } from '../../domain/entities/outbox.entity.js';

export class OutboxRepository implements IOutboxRepository {
  enqueue(data: CreateOutboxJobDto): OutboxJob {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const scheduledAt = data.scheduled_at || now;

    sqlite.prepare(`
      INSERT INTO outbox_jobs (
        id, job_type, entity_type, entity_id, entity_version,
        payload, status, retry_count, max_retries, scheduled_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'PENDING', 0, ?, ?, ?)
    `).run(
      id,
      data.job_type,
      data.entity_type,
      data.entity_id,
      data.entity_version,
      data.payload || null,
      data.max_retries ?? 5,
      scheduledAt,
      now
    );

    return this.findById(id)!;
  }

  findById(id: string): OutboxJob | undefined {
    return sqlite.prepare(`
      SELECT * FROM outbox_jobs WHERE id = ?
    `).get(id) as OutboxJob | undefined;
  }

  claimPendingBatch(limit = 10): OutboxJob[] {
    const now = new Date().toISOString();

    // Transacción para reclamar (optimistic claim / lock)
    const transaction = sqlite.transaction(() => {
      const candidates = sqlite.prepare(`
        SELECT * FROM outbox_jobs
        WHERE status IN ('PENDING', 'FAILED') 
          AND scheduled_at <= ?
          AND retry_count < max_retries
        ORDER BY scheduled_at ASC
        LIMIT ?
      `).all(now, limit) as OutboxJob[];

      if (candidates.length === 0) return [];

      const ids = candidates.map(c => c.id);
      const placeholders = ids.map(() => '?').join(',');

      sqlite.prepare(`
        UPDATE outbox_jobs
        SET status = 'PROCESSING'
        WHERE id IN (${placeholders})
      `).run(...ids);

      return candidates.map(c => ({ ...c, status: 'PROCESSING' as const }));
    });

    return transaction();
  }

  markCompleted(id: string): void {
    sqlite.prepare(`
      UPDATE outbox_jobs
      SET status = 'COMPLETED', last_error = NULL
      WHERE id = ?
    `).run(id);
  }

  markFailed(id: string, error: string, nextScheduledAt?: string): void {
    const job = this.findById(id);
    if (!job) return;

    const newRetryCount = job.retry_count + 1;
    const isExhausted = newRetryCount >= job.max_retries;
    const status = isExhausted ? 'FAILED' : 'PENDING';

    // Backoff exponencial: 2^retry * 1000ms si no se especifica scheduledAt
    const delayMs = Math.pow(2, newRetryCount) * 1000;
    const scheduledAt = nextScheduledAt || new Date(Date.now() + delayMs).toISOString();

    sqlite.prepare(`
      UPDATE outbox_jobs
      SET status = ?, retry_count = ?, last_error = ?, scheduled_at = ?
      WHERE id = ?
    `).run(status, newRetryCount, error.slice(0, 500), scheduledAt, id);
  }

  markDiscarded(id: string, reason: string): void {
    sqlite.prepare(`
      UPDATE outbox_jobs
      SET status = 'COMPLETED', last_error = ?
      WHERE id = ?
    `).run(`DISCARDED: ${reason.slice(0, 450)}`, id);
  }

  getPendingCount(): number {
    const row = sqlite.prepare(`
      SELECT COUNT(*) as count FROM outbox_jobs WHERE status IN ('PENDING', 'FAILED')
    `).get() as { count: number };
    return row.count;
  }
}
