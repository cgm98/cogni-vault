import { sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const domains = sqliteTable('domains', {
  id: text('id').primaryKey(),
  user_id: text('user_id'),
  name: text('name').notNull(),
  color: text('color').notNull(),
  description: text('description'),
  area_id: text('area_id'),
  temporal_facet: text('temporal_facet').default('PAST_MEMORY')
});
