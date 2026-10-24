import { FolderRepository } from '../../../infrastructure/repositories/folder.repository.js';
import { OutboxRepository } from '../../../infrastructure/repositories/outbox.repository.js';
import { FolderService } from '../../services/folder.service.js';
import { OutboxService } from '../../services/outbox.service.js';
import { HierarchyMigrationService } from '../../services/hierarchy-migration.service.js';

export const folderRepository = new FolderRepository();
export const outboxRepository = new OutboxRepository();

export const folderService = new FolderService(folderRepository, outboxRepository);
export const outboxService = new OutboxService(outboxRepository);
export const hierarchyMigrationService = new HierarchyMigrationService(folderRepository, outboxRepository);
