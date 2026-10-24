import crypto from 'crypto';
import { eq, and, isNull, inArray, sql } from 'drizzle-orm';
import { db, sqlite } from '../../src/db.js';
import { folders, trash_batches } from '../../src/schemas/folder.schema.js';
import { concepts } from '../../src/schemas/concept.schema.js';
import { IFolderRepository } from '../../domain/interfaces/folder.repository.interface.js';
import { Folder, FolderTreeItem, CreateFolderDto, UpdateFolderDto } from '../../domain/entities/folder.entity.js';
import { NotFoundError, ValidationError, ConflictError } from '../../domain/errors.js';

export class FolderRepository implements IFolderRepository {
  create(data: CreateFolderDto): Folder {
    const now = new Date().toISOString();
    const id = crypto.randomUUID();

    // 1. Invariante: Si tiene parent_id, verificar que pertenezca al mismo workspace y no esté eliminado
    if (data.parent_id) {
      const parent = this.findById(data.parent_id, data.workspace_id);
      if (!parent || parent.deleted_at !== null) {
        throw new ValidationError('La carpeta padre no existe o no pertenece al mismo workspace');
      }
    }

    try {
      db.insert(folders).values({
        id,
        workspace_id: data.workspace_id,
        parent_id: data.parent_id ?? null,
        name: data.name.trim(),
        sort_order: data.sort_order ?? 0,
        version: 1,
        created_at: now,
        updated_at: now
      }).run();
    } catch (err: any) {
      if (err.message && err.message.includes('UNIQUE constraint failed')) {
        throw new ConflictError(`Ya existe una carpeta con el nombre "${data.name.trim()}" en esta ubicación`);
      }
      throw err;
    }

    return this.findById(id, data.workspace_id)!;
  }

  findById(id: string, workspaceId?: string): Folder | undefined {
    const whereConditions = workspaceId 
      ? and(eq(folders.id, id), eq(folders.workspace_id, workspaceId))
      : eq(folders.id, id);

    const row = db.select().from(folders).where(whereConditions).get();
    return row as Folder | undefined;
  }

  listByWorkspace(workspaceId: string, includeDeleted = false): Folder[] {
    const whereCondition = includeDeleted
      ? eq(folders.workspace_id, workspaceId)
      : and(eq(folders.workspace_id, workspaceId), isNull(folders.deleted_at));

    return db.select()
      .from(folders)
      .where(whereCondition)
      .orderBy(folders.sort_order, folders.name)
      .all() as Folder[];
  }

  getTree(workspaceId: string): FolderTreeItem[] {
    const activeFolders = this.listByWorkspace(workspaceId, false);
    if (activeFolders.length === 0) return [];

    // Contar notas activas por carpeta en una sola consulta
    const counts = sqlite.prepare(`
      SELECT folder_id, COUNT(*) as count 
      FROM concepts 
      WHERE workspace_id = ? AND deleted_at IS NULL AND folder_id IS NOT NULL 
      GROUP BY folder_id
    `).all(workspaceId) as { folder_id: string; count: number }[];

    const countMap = new Map<string, number>();
    for (const row of counts) {
      countMap.set(row.folder_id, row.count);
    }

    // Indexar por ID y preparar estructura con children
    const itemMap = new Map<string, FolderTreeItem>();
    for (const f of activeFolders) {
      itemMap.set(f.id, {
        ...f,
        children: [],
        concept_count: countMap.get(f.id) || 0
      });
    }

    const rootItems: FolderTreeItem[] = [];

    for (const f of activeFolders) {
      const current = itemMap.get(f.id)!;
      if (f.parent_id && itemMap.has(f.parent_id)) {
        itemMap.get(f.parent_id)!.children.push(current);
      } else {
        rootItems.push(current);
      }
    }

    return rootItems;
  }

  update(id: string, workspaceId: string, data: UpdateFolderDto): Folder {
    const folder = this.findById(id, workspaceId);
    if (!folder || folder.deleted_at !== null) {
      throw new NotFoundError('Carpeta no encontrada');
    }

    const now = new Date().toISOString();
    const updateValues: Record<string, any> = { updated_at: now };

    if (data.name !== undefined) {
      updateValues.name = data.name.trim();
    }
    if (data.sort_order !== undefined) {
      updateValues.sort_order = data.sort_order;
    }

    try {
      db.update(folders)
        .set(updateValues)
        .where(and(eq(folders.id, id), eq(folders.workspace_id, workspaceId)))
        .run();
    } catch (err: any) {
      if (err.message && err.message.includes('UNIQUE constraint failed')) {
        throw new ConflictError(`Ya existe una carpeta con el nombre "${data.name}" en esta ubicación`);
      }
      throw err;
    }

    return this.findById(id, workspaceId)!;
  }

  move(id: string, workspaceId: string, targetParentId: string | null, expectedVersion: number): Folder {
    const folder = this.findById(id, workspaceId);
    if (!folder || folder.deleted_at !== null) {
      throw new NotFoundError('Carpeta no encontrada');
    }

    // 1. Invariante: No puede moverse dentro de sí misma
    if (targetParentId === id) {
      throw new ValidationError('Una carpeta no puede ser su propio padre');
    }

    // 2. Si se mueve a otro padre, validar existencia y aislamiento de workspace
    if (targetParentId !== null) {
      const targetParent = this.findById(targetParentId, workspaceId);
      if (!targetParent || targetParent.deleted_at !== null) {
        throw new ValidationError('La carpeta destino no existe o no pertenece al mismo workspace');
      }

      // 3. Invariante: Anti-ciclos (el destino no puede ser un descendiente de la carpeta que se mueve)
      const cycleCheck = sqlite.prepare(`
        WITH RECURSIVE path_to_root AS (
          SELECT id, parent_id, 0 as depth FROM folders WHERE id = ?
          UNION ALL
          SELECT f.id, f.parent_id, p.depth + 1 FROM folders f
          JOIN path_to_root p ON f.id = p.parent_id
          WHERE p.depth < 30
        )
        SELECT COUNT(*) as cycle_detected FROM path_to_root WHERE id = ?;
      `).get(targetParentId, id) as { cycle_detected: number };

      if (cycleCheck && cycleCheck.cycle_detected > 0) {
        throw new ValidationError('Operación inválida: crearía un ciclo en la jerarquía de carpetas');
      }
    }

    // 4. Actualización con Optimistic Concurrency Control (OCC)
    const now = new Date().toISOString();
    try {
      const result = sqlite.prepare(`
        UPDATE folders 
        SET parent_id = ?, version = version + 1, updated_at = ?
        WHERE id = ? AND workspace_id = ? AND version = ?
      `).run(targetParentId, now, id, workspaceId, expectedVersion);

      if (result.changes === 0) {
        // Verificar si la carpeta aún existe o la versión cambió
        const current = this.findById(id, workspaceId);
        if (!current) throw new NotFoundError('Carpeta no encontrada');
        throw new ConflictError(
          `Conflicto de concurrencia (OCC): la versión de la carpeta cambió (esperada: ${expectedVersion}, actual: ${current.version})`
        );
      }
    } catch (err: any) {
      if (err instanceof ConflictError || err instanceof NotFoundError || err instanceof ValidationError) {
        throw err;
      }
      if (err.message && err.message.includes('UNIQUE constraint failed')) {
        throw new ConflictError(`Ya existe una carpeta con el mismo nombre en la carpeta destino`);
      }
      throw err;
    }

    return this.findById(id, workspaceId)!;
  }

  trashSubtree(id: string, workspaceId: string, userId: string): { batchId: string; affectedFolders: number; affectedConcepts: number } {
    const root = this.findById(id, workspaceId);
    if (!root || root.deleted_at !== null) {
      throw new NotFoundError('Carpeta no encontrada o ya eliminada');
    }

    const batchId = crypto.randomUUID();
    const now = new Date().toISOString();

    const transaction = sqlite.transaction(() => {
      // 1. Obtener todos los IDs de subárbol de carpetas
      const folderRows = sqlite.prepare(`
        WITH RECURSIVE subtree AS (
          SELECT id FROM folders WHERE id = ? AND workspace_id = ? AND deleted_at IS NULL
          UNION ALL
          SELECT f.id FROM folders f
          JOIN subtree s ON f.parent_id = s.id
          WHERE f.deleted_at IS NULL
        )
        SELECT id FROM subtree;
      `).all(id, workspaceId) as { id: string }[];

      const folderIds = folderRows.map(r => r.id);
      if (folderIds.length === 0) return { batchId, affectedFolders: 0, affectedConcepts: 0 };

      // 2. Marcar carpetas
      const folderPlaceholders = folderIds.map(() => '?').join(',');
      const folderRes = sqlite.prepare(`
        UPDATE folders 
        SET deleted_at = ?, trash_batch_id = ?, updated_at = ?
        WHERE id IN (${folderPlaceholders}) AND deleted_at IS NULL
      `).run(now, batchId, now, ...folderIds);

      // 3. Marcar conceptos contenidos
      const conceptRes = sqlite.prepare(`
        UPDATE concepts 
        SET deleted_at = ?, trash_batch_id = ?, updated_at = ?
        WHERE folder_id IN (${folderPlaceholders}) AND deleted_at IS NULL
      `).run(now, batchId, now, ...folderIds);

      // 4. Registrar batch de papelera
      sqlite.prepare(`
        INSERT INTO trash_batches (id, workspace_id, initiated_by, item_count, created_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(batchId, workspaceId, userId, folderRes.changes + conceptRes.changes, now);

      return {
        batchId,
        affectedFolders: folderRes.changes,
        affectedConcepts: conceptRes.changes
      };
    });

    return transaction();
  }

  restoreTrashBatch(batchId: string, workspaceId: string): { restoredFolders: number; restoredConcepts: number; reparentedFolders: number } {
    const batch = sqlite.prepare(`
      SELECT * FROM trash_batches WHERE id = ? AND workspace_id = ?
    `).get(batchId, workspaceId) as { id: string; restored_at: string | null } | undefined;

    if (!batch) {
      throw new NotFoundError('Lote de papelera no encontrado');
    }
    if (batch.restored_at !== null) {
      throw new ValidationError('Este lote de papelera ya fue restaurado previamente');
    }

    const now = new Date().toISOString();

    const transaction = sqlite.transaction(() => {
      // 1. Obtener carpetas afectadas en el batch
      const batchFolders = sqlite.prepare(`
        SELECT id, parent_id FROM folders WHERE trash_batch_id = ? AND workspace_id = ?
      `).all(batchId, workspaceId) as { id: string; parent_id: string | null }[];

      let reparentedCount = 0;

      // 2. Comprobar si el padre de alguna carpeta sigue eliminado o no existe -> re-parent a raíz (null)
      for (const f of batchFolders) {
        if (f.parent_id !== null) {
          const parent = sqlite.prepare(`
            SELECT id FROM folders 
            WHERE id = ? AND workspace_id = ? AND (deleted_at IS NULL OR trash_batch_id = ?)
          `).get(f.parent_id, workspaceId, batchId);

          if (!parent) {
            // Re-parent a null para evitar huérfanos inaccesibles
            sqlite.prepare(`
              UPDATE folders SET parent_id = NULL WHERE id = ?
            `).run(f.id);
            reparentedCount++;
          }
        }
      }

      // 3. Restaurar carpetas
      const foldersRes = sqlite.prepare(`
        UPDATE folders 
        SET deleted_at = NULL, trash_batch_id = NULL, updated_at = ?
        WHERE trash_batch_id = ? AND workspace_id = ?
      `).run(now, batchId, workspaceId);

      // 4. Restaurar conceptos
      const conceptsRes = sqlite.prepare(`
        UPDATE concepts 
        SET deleted_at = NULL, trash_batch_id = NULL, updated_at = ?
        WHERE trash_batch_id = ? AND workspace_id = ?
      `).run(now, batchId, workspaceId);

      // 5. Marcar lote como restaurado
      sqlite.prepare(`
        UPDATE trash_batches SET restored_at = ? WHERE id = ?
      `).run(now, batchId);

      return {
        restoredFolders: foldersRes.changes,
        restoredConcepts: conceptsRes.changes,
        reparentedFolders: reparentedCount
      };
    });

    return transaction();
  }

  deletePermanent(id: string, workspaceId: string): void {
    sqlite.prepare(`
      DELETE FROM folders WHERE id = ? AND workspace_id = ?
    `).run(id, workspaceId);
  }
}
