import { sqliteTable, text, real } from 'drizzle-orm/sqlite-core';
import { concepts } from './concept.schema.js';

export const relations = sqliteTable('relations', {
  id: text('id').primaryKey(),
  from_concept_id: text('from_concept_id').notNull().references(() => concepts.id, { onDelete: 'cascade' }),
  to_concept_id: text('to_concept_id').notNull().references(() => concepts.id, { onDelete: 'cascade' }),
  relation_type: text('relation_type').notNull(), // depends_on, prerequisite_of, etc.
  confidence: real('confidence').default(0.7),
  source: text('source').default('manual'),
  created_at: text('created_at').notNull()
});
