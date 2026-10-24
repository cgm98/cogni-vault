import { IFolderRepository } from '../../domain/interfaces/folder.repository.interface.js';
import { IOutboxRepository } from '../../domain/interfaces/outbox.repository.interface.js';
import { Folder, FolderTreeItem, CreateFolderDto, UpdateFolderDto } from '../../domain/entities/folder.entity.js';
import { ValidationError, NotFoundError } from '../../domain/errors.js';

export class FolderService {
  constructor(
    private readonly folderRepository: IFolderRepository,
    private readonly outboxRepository: IOutboxRepository
  ) {}

  create(workspaceId: string, name: string, parentId?: string | null, sortOrder?: number): Folder {
    if (!name || name.trim().length === 0) {
      throw new ValidationError('El nombre de la carpeta no puede estar vacío');
    }
    if (name.trim().length > 150) {
      throw new ValidationError('El nombre de la carpeta no puede superar 150 caracteres');
    }

    const created = this.folderRepository.create({
      workspace_id: workspaceId,
      name: name.trim(),
      parent_id: parentId ?? null,
      sort_order: sortOrder ?? 0
    });

    this.outboxRepository.enqueue({
      job_type: 'INVALIDATE_TREE_CACHE',
      entity_type: 'folder',
      entity_id: created.id,
      entity_version: created.version,
      payload: JSON.stringify({ workspace_id: workspaceId, action: 'create' })
    });

    return created;
  }

  getTree(workspaceId: string): FolderTreeItem[] {
    return this.folderRepository.getTree(workspaceId);
  }

  listByWorkspace(workspaceId: string): Folder[] {
    return this.folderRepository.listByWorkspace(workspaceId, false);
  }

  getById(id: string, workspaceId: string): Folder {
    const folder = this.folderRepository.findById(id, workspaceId);
    if (!folder || folder.deleted_at !== null) {
      throw new NotFoundError('Carpeta no encontrada');
    }
    return folder;
  }

  update(id: string, workspaceId: string, data: UpdateFolderDto): Folder {
    if (data.name !== undefined && data.name.trim().length === 0) {
      throw new ValidationError('El nombre de la carpeta no puede estar vacío');
    }

    const updated = this.folderRepository.update(id, workspaceId, data);

    this.outboxRepository.enqueue({
      job_type: 'INVALIDATE_TREE_CACHE',
      entity_type: 'folder',
      entity_id: updated.id,
      entity_version: updated.version,
      payload: JSON.stringify({ workspace_id: workspaceId, action: 'update' })
    });

    return updated;
  }

  move(id: string, workspaceId: string, targetParentId: string | null, expectedVersion: number): Folder {
    if (expectedVersion === undefined || expectedVersion === null || expectedVersion < 1) {
      throw new ValidationError('Se requiere expected_version (OCC) válido para mover una carpeta');
    }

    const moved = this.folderRepository.move(id, workspaceId, targetParentId, expectedVersion);

    this.outboxRepository.enqueue({
      job_type: 'INVALIDATE_TREE_CACHE',
      entity_type: 'folder',
      entity_id: moved.id,
      entity_version: moved.version,
      payload: JSON.stringify({ workspace_id: workspaceId, action: 'move', target_parent_id: targetParentId })
    });

    return moved;
  }

  trashSubtree(id: string, workspaceId: string, userId: string): { batchId: string; affectedFolders: number; affectedConcepts: number } {
    const result = this.folderRepository.trashSubtree(id, workspaceId, userId);

    this.outboxRepository.enqueue({
      job_type: 'INVALIDATE_TREE_CACHE',
      entity_type: 'folder',
      entity_id: id,
      entity_version: 0,
      payload: JSON.stringify({ workspace_id: workspaceId, action: 'trash', batch_id: result.batchId })
    });

    return result;
  }

  restoreTrashBatch(batchId: string, workspaceId: string): { restoredFolders: number; restoredConcepts: number; reparentedFolders: number } {
    const result = this.folderRepository.restoreTrashBatch(batchId, workspaceId);

    this.outboxRepository.enqueue({
      job_type: 'INVALIDATE_TREE_CACHE',
      entity_type: 'trash_batch',
      entity_id: batchId,
      entity_version: 0,
      payload: JSON.stringify({ workspace_id: workspaceId, action: 'restore', batch_id: batchId })
    });

    return result;
  }
}
