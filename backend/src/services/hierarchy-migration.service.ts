import { sqlite } from '../db.js';
import { IFolderRepository } from '../../domain/interfaces/folder.repository.interface.js';
import { IOutboxRepository } from '../../domain/interfaces/outbox.repository.interface.js';
import { migrateLegacyVfs } from './legacy-vfs.js';
import { ValidationError } from '../../domain/errors.js';
import { mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';

export class HierarchyMigrationService {
  constructor(_folders: IFolderRepository, _outbox: IOutboxRepository) {}
  migrateWorkspace(workspaceId: string) {
    const space = sqlite.prepare('SELECT user_id FROM cerebros WHERE id=?').get(workspaceId) as {user_id:string}|undefined;
    if (!space) throw new ValidationError('Espacio no encontrado');
    return migrateLegacyVfs(sqlite,space.user_id,workspaceId);
  }
  async migrateUser(userId: string) {
    const pending = sqlite.prepare('SELECT count(*) AS n FROM concepts WHERE user_id=? AND workspace_id IS NULL').get(userId) as {n:number};
    let backupPath: string | null = null;
    if (pending.n && sqlite.name !== ':memory:') {
      const dir = join(dirname(sqlite.name),'backups');
      await mkdir(dir,{recursive:true});
      backupPath=join(dir,'before-vfs-'+Date.now()+'.db');
      await sqlite.backup(backupPath);
    }
    return {...migrateLegacyVfs(sqlite,userId),backupPath};
  }
}
