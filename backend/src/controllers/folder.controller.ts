import { Response } from 'express';
import { folderService, hierarchyMigrationService } from '../di/container.js';
import { asyncHandler } from '../http/middlewares/error-handler.js';
import { AuthRequest } from '../http/middlewares/auth.middleware.js';
import { sqlite } from '../db.js';
import { ValidationError } from '../../domain/errors.js';

function requireWorkspace(req: AuthRequest, id: string) {
  if (!sqlite.prepare('SELECT id FROM cerebros WHERE id=? AND user_id=?').get(id,req.user!.userId)) throw new ValidationError('Espacio no disponible');
}
export class FolderController {
  static migrateUser = asyncHandler(async (req: AuthRequest, res: Response) => {
    res.json(await hierarchyMigrationService.migrateUser(req.user!.userId));
  });
  static getTree = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { workspaceId } = req.params;
    if (!workspaceId) throw new ValidationError('workspaceId es requerido');
    requireWorkspace(req,workspaceId);
    const tree = folderService.getTree(workspaceId);
    res.json(tree);
  });

  static getAll = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { workspaceId } = req.params;
    if (!workspaceId) throw new ValidationError('workspaceId es requerido');
    requireWorkspace(req,workspaceId);
    const folders = folderService.listByWorkspace(workspaceId);
    res.json(folders);
  });

  static getById = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const workspaceId = (req.query.workspaceId as string) || (req.body?.workspace_id as string);
    if (!workspaceId) throw new ValidationError('workspaceId es requerido en query o body');
    requireWorkspace(req,workspaceId);
    const folder = folderService.getById(id, workspaceId);
    res.json(folder);
  });

  static create = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { workspaceId } = req.params;
    if (!workspaceId) throw new ValidationError('workspaceId es requerido');
    requireWorkspace(req,workspaceId);
    const { name, parent_id, sort_order } = req.body;
    const folder = folderService.create(workspaceId, name, parent_id, sort_order);
    res.status(201).json(folder);
  });

  static update = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { workspace_id, name, sort_order } = req.body;
    if (!workspace_id) throw new ValidationError('workspace_id es requerido en body');
    requireWorkspace(req,workspace_id);
    const updated = folderService.update(id, workspace_id, { name, sort_order });
    res.json(updated);
  });

  static move = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { workspace_id, target_parent_id, expected_version } = req.body;
    if (!workspace_id) throw new ValidationError('workspace_id es requerido en body');
    requireWorkspace(req,workspace_id);
    const moved = folderService.move(id, workspace_id, target_parent_id ?? null, expected_version);
    res.json(moved);
  });

  static trash = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const workspaceId = (req.query.workspaceId as string) || req.body?.workspace_id;
    if (!workspaceId) throw new ValidationError('workspaceId es requerido');
    requireWorkspace(req,workspaceId);
    const userId = req.user?.userId || 'system';
    const result = folderService.trashSubtree(id, workspaceId, userId);
    res.json(result);
  });

  static restoreBatch = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { batchId } = req.params;
    const { workspace_id } = req.body;
    if (!workspace_id) throw new ValidationError('workspace_id es requerido en body');
    requireWorkspace(req,workspace_id);
    const result = folderService.restoreTrashBatch(batchId, workspace_id);
    res.json(result);
  });

  static migrateWorkspace = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { workspaceId } = req.params;
    if (!workspaceId) throw new ValidationError('workspaceId es requerido');
    requireWorkspace(req,workspaceId);
    const result = hierarchyMigrationService.migrateWorkspace(workspaceId);
    res.json(result);
  });
}
