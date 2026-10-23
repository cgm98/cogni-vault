import { sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { domains } from './domain.schema.js';

export const topics = sqliteTable('topics', {
  id: text('id').primaryKey(),
  user_id: text('user_id'),
  domain_id: text('domain_id').notNull().references(() => domains.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  color: text('color'),
  temporal_facet: text('temporal_facet').default('PAST_MEMORY')
});
