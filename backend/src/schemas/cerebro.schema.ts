import { sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const cerebros = sqliteTable('cerebros', {
  id: text('id').primaryKey(),
  slug: text('slug').notNull(),
  name: text('name').notNull(),
  description: text('description'),
  icon: text('icon').default('brain'),
  color: text('color').default('#3B82F6'),
  user_id: text('user_id').notNull(),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull()
});
