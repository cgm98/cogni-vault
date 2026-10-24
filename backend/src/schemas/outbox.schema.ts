import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const outbox_jobs = sqliteTable('outbox_jobs', {
  id: text('id').primaryKey(),
  job_type: text('job_type').notNull(),
  entity_type: text('entity_type').notNull(),
  entity_id: text('entity_id').notNull(),
  entity_version: integer('entity_version').notNull(),
  payload: text('payload'),
  status: text('status', { enum: ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'] }).default('PENDING').notNull(),
  retry_count: integer('retry_count').default(0).notNull(),
  max_retries: integer('max_retries').default(5).notNull(),
  last_error: text('last_error'),
  scheduled_at: text('scheduled_at').notNull(),
  created_at: text('created_at').notNull()
}, (table) => ({
  queueIdx: index('idx_outbox_queue')
    .on(table.status, table.scheduled_at)
    .where(sql`${table.status} IN ('PENDING', 'FAILED')`)
}));
