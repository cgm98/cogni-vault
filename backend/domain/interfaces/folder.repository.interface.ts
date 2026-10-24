import { Folder, FolderTreeItem, CreateFolderDto, UpdateFolderDto } from '../entities/folder.entity.js';

export interface IFolderRepository {
  create(data: CreateFolderDto): Folder;
  findById(id: string, workspaceId?: string): Folder | undefined;
  listByWorkspace(workspaceId: string, includeDeleted?: boolean): Folder[];
  getTree(workspaceId: string): FolderTreeItem[];
  update(id: string, workspaceId: string, data: UpdateFolderDto): Folder;
  move(id: string, workspaceId: string, targetParentId: string | null, expectedVersion: number): Folder;
  trashSubtree(id: string, workspaceId: string, userId: string): { batchId: string; affectedFolders: number; affectedConcepts: number };
  restoreTrashBatch(batchId: string, workspaceId: string): { restoredFolders: number; restoredConcepts: number; reparentedFolders: number };
  deletePermanent(id: string, workspaceId: string): void;
}
