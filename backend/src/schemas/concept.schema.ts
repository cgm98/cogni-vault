import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

export const concepts = sqliteTable('concepts', {
  id: text('id').primaryKey(),
  user_id: text('user_id'),
  title: text('title').notNull(),
  explanation: text('explanation').notNull(),
  intuition: text('intuition'),
  domain: text('domain').notNull(),
  topic_id: text('topic_id'),
  strength: real('strength').default(0.7),
  difficulty: integer('difficulty').default(3),
  status: text('status').default('active'),
  temporal_facet: text('temporal_facet').default('PAST_MEMORY'),
  facet_subtype: text('facet_subtype'),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull(),
  deleted_at: text('deleted_at'),
  workspace_id: text('workspace_id'),
  folder_id: text('folder_id'),
  version: integer('version').default(1).notNull(),
  trash_batch_id: text('trash_batch_id'),
  doc_ast: text('doc_ast'),
  schema_version: integer('schema_version').default(1).notNull(),
  // Provenance (Tier 2, watermarking): 'human' | 'agent', seteado solo al crear, inmutable
  // después — ver ConceptService.create(). No confundir con "quién lo editó último".
  author_type: text('author_type').notNull().default('human')
});

export const concept_versions = sqliteTable('concept_versions', {
  id: text('id').primaryKey(),
  concept_id: text('concept_id').notNull().references(() => concepts.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  explanation: text('explanation').notNull(),
  created_at: text('created_at').notNull()
});

export const memory_states = sqliteTable('memory_states', {
  concept_id: text('concept_id').primaryKey().references(() => concepts.id, { onDelete: 'cascade' }),
  stability: real('stability').default(1.0),
  retrievability: real('retrievability').default(1.0),
  difficulty: real('difficulty').default(5.0),
  memory_strength: real('memory_strength').default(1.0),
  mastery_score: real('mastery_score').default(0.0),
  last_review_at: text('last_review_at'),
  next_review_at: text('next_review_at'),
  review_count: integer('review_count').default(0),
  updated_at: text('updated_at').notNull()
});
