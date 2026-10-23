import { sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { cerebros } from './cerebro.schema.js';

export const areas = sqliteTable('areas', {
  id: text('id').primaryKey(),
  cerebro_id: text('cerebro_id').references(() => cerebros.id, { onDelete: 'cascade' }),
  user_id: text('user_id'),
  name: text('name').notNull(),
  description: text('description'),
  color: text('color'),
  temporal_facet: text('temporal_facet').default('PAST_MEMORY')
});

