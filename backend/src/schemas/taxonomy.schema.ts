import { sqliteTable, text, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { concepts } from './concept.schema.js';

// --- 1. TÉRMINOS TAXONÓMICOS (VOCABULARIO CONTROLADO / JERARQUÍA SEMÁNTICA) ---
export const taxonomy_terms = sqliteTable('taxonomy_terms', {
  id: text('id').primaryKey(),
  workspace_id: text('workspace_id').notNull(),
  parent_id: text('parent_id'),
  name: text('name').notNull(),
  color: text('color'),
  description: text('description'),
  created_at: text('created_at').notNull()
}, (table) => ({
  parentIdx: index('idx_tax_parent').on(table.parent_id),
  workspaceIdx: index('idx_tax_workspace').on(table.workspace_id),
  uniqueChildren: uniqueIndex('idx_tax_unique_children')
    .on(table.workspace_id, table.parent_id, table.name)
    .where(sql`${table.parent_id} IS NOT NULL`),
  uniqueRoot: uniqueIndex('idx_tax_unique_root')
    .on(table.workspace_id, table.name)
    .where(sql`${table.parent_id} IS NULL`)
}));

// --- 2. ASIGNACIÓN DE TAXONOMÍA A CONCEPTOS (EXPLÍCITA VS HEREDADA) ---
export const concept_taxonomy = sqliteTable('concept_taxonomy', {
  concept_id: text('concept_id').notNull().references(() => concepts.id, { onDelete: 'cascade' }),
  term_id: text('term_id').notNull().references(() => taxonomy_terms.id, { onDelete: 'cascade' }),
  is_inherited: integer('is_inherited', { mode: 'boolean' }).default(false).notNull(),
  source_folder_id: text('source_folder_id'),
  assigned_at: text('assigned_at').notNull()
}, (table) => ({
  pk: uniqueIndex('pk_concept_taxonomy').on(table.concept_id, table.term_id),
  termIdx: index('idx_concept_taxonomy_term').on(table.term_id)
}));

// --- 3. ETIQUETAS LIBRES (TAGS M:N) ---
export const tags = sqliteTable('tags', {
  id: text('id').primaryKey(),
  workspace_id: text('workspace_id').notNull(),
  name: text('name').notNull(),
  color: text('color'),
  created_at: text('created_at').notNull()
}, (table) => ({
  uniqueName: uniqueIndex('idx_tags_unique_name').on(table.workspace_id, table.name)
}));

// --- 4. ASOCIACIÓN M:N CONCEPTOS - ETIQUETAS ---
export const concept_tags = sqliteTable('concept_tags', {
  concept_id: text('concept_id').notNull().references(() => concepts.id, { onDelete: 'cascade' }),
  tag_id: text('tag_id').notNull().references(() => tags.id, { onDelete: 'cascade' }),
  created_at: text('created_at').notNull()
}, (table) => ({
  pk: uniqueIndex('pk_concept_tags').on(table.concept_id, table.tag_id),
  tagIdx: index('idx_concept_tags_tag').on(table.tag_id)
}));
