import { sqliteTable, text, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const folders = sqliteTable('folders', {
  id: text('id').primaryKey(),
  workspace_id: text('workspace_id').notNull(),
  parent_id: text('parent_id'),
  name: text('name').notNull(),
  sort_order: integer('sort_order').default(0).notNull(),
  version: integer('version').default(1).notNull(),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull(),
  deleted_at: text('deleted_at'),
  trash_batch_id: text('trash_batch_id')
}, (table) => ({
  parentIdx: index('idx_folders_parent').on(table.parent_id),
  workspaceIdx: index('idx_folders_workspace').on(table.workspace_id),
  // Índice parcial: Nombres únicos entre carpetas hermanas no eliminadas
  uniqueSiblings: uniqueIndex('idx_folders_unique_children')
    .on(table.workspace_id, table.parent_id, table.name)
    .where(sql`${table.deleted_at} IS NULL AND ${table.parent_id} IS NOT NULL`),
  // Índice parcial: Nombres únicos en la raíz del workspace no eliminadas
  uniqueRoot: uniqueIndex('idx_folders_unique_root')
    .on(table.workspace_id, table.name)
    .where(sql`${table.deleted_at} IS NULL AND ${table.parent_id} IS NULL`)
}));

export const trash_batches = sqliteTable('trash_batches', {
  id: text('id').primaryKey(),
  workspace_id: text('workspace_id').notNull(),
  initiated_by: text('initiated_by').notNull(),
  item_count: integer('item_count').default(0).notNull(),
  created_at: text('created_at').notNull(),
  restored_at: text('restored_at')
}, (table) => ({
  workspaceIdx: index('idx_trash_batches_workspace').on(table.workspace_id)
}));
