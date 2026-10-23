import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import { concepts } from './concept.schema.js';

export const explanations = sqliteTable('explanations', {
  id: text('id').primaryKey(),
  concept_id: text('concept_id').notNull().references(() => concepts.id, { onDelete: 'cascade' }),
  content: text('content').notNull(),
  quality_score: real('quality_score').default(0.0),
  created_at: text('created_at').notNull()
});

export const knowledge_gaps = sqliteTable('knowledge_gaps', {
  id: text('id').primaryKey(),
  concept_id: text('concept_id').notNull().references(() => concepts.id, { onDelete: 'cascade' }),
  gap_type: text('gap_type').notNull(), // low_diversity, fragile_retention, etc.
  severity: real('severity').default(0.0),
  evidence: text('evidence'),
  is_resolved: integer('is_resolved').default(0), // 0 or 1
  created_at: text('created_at').notNull()
});

export const semantic_insights = sqliteTable('semantic_insights', {
  id: text('id').primaryKey(),
  source_concept_id: text('source_concept_id').notNull().references(() => concepts.id, { onDelete: 'cascade' }),
  target_concept_id: text('target_concept_id').notNull().references(() => concepts.id, { onDelete: 'cascade' }),
  insight_type: text('insight_type').notNull(),
  content: text('content').notNull(),
  confidence: real('confidence').default(0.5),
  created_at: text('created_at').notNull()
});

export const events = sqliteTable('events', {
  id: text('id').primaryKey(),
  kind: text('kind').notNull(), // create, update, delete, etc.
  detail: text('detail'),
  entity_type: text('entity_type'),
  entity_id: text('entity_id'),
  created_at: text('created_at').notNull()
});
