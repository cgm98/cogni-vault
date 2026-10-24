import test from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { runPhase1Migrations } from '../backend/infrastructure/database/migration';
import { FolderRepository } from '../backend/infrastructure/repositories/folder.repository';
import { OutboxRepository } from '../backend/infrastructure/repositories/outbox.repository';
import { FolderService } from '../backend/src/services/folder.service';
import { OutboxService } from '../backend/src/services/outbox.service';
import { HierarchyMigrationService } from '../backend/src/services/hierarchy-migration.service';
import { ValidationError, ConflictError, NotFoundError } from '../backend/domain/errors';

test('Phase 1: Database Initialization and Partial Unique Indexes', () => {
  const sqlite = new Database(':memory:');
  runPhase1Migrations(sqlite);

  // Crear tabla concepts básica para tests
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS concepts (
      id TEXT PRIMARY KEY,
      workspace_id TEXT,
      folder_id TEXT,
      title TEXT NOT NULL,
      explanation TEXT NOT NULL,
      domain TEXT NOT NULL,
      topic_id TEXT,
      version INTEGER NOT NULL DEFAULT 1,
      deleted_at TEXT,
      trash_batch_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
  runPhase1Migrations(sqlite); // Re-run para probar idempotencia

  const folderRepo = new FolderRepository();

  // Inyectar sqlite local temporalmente sobrescribiendo sqlite exportado o probando contra DB en memoria
  // Verificamos índices parciales directamente mediante queries
  sqlite.prepare(`
    INSERT INTO folders (id, workspace_id, parent_id, name, sort_order, version, created_at, updated_at)
    VALUES ('f1', 'ws1', NULL, 'Raiz', 0, 1, 'now', 'now')
  `).run();

  // Intento de duplicado en la misma raíz de ws1 -> debe fallar por idx_folders_unique_root
  assert.throws(() => {
    sqlite.prepare(`
      INSERT INTO folders (id, workspace_id, parent_id, name, sort_order, version, created_at, updated_at)
      VALUES ('f2', 'ws1', NULL, 'Raiz', 0, 1, 'now', 'now')
    `).run();
  }, /UNIQUE constraint failed/);

  // Mismo nombre en otro workspace ws2 -> permitido
  sqlite.prepare(`
    INSERT INTO folders (id, workspace_id, parent_id, name, sort_order, version, created_at, updated_at)
    VALUES ('f3', 'ws2', NULL, 'Raiz', 0, 1, 'now', 'now')
  `).run();

  // Si eliminamos f1 lógicamente, se permite crear de nuevo 'Raiz' en ws1 (índice parcial WHERE deleted_at IS NULL)
  sqlite.prepare(`UPDATE folders SET deleted_at = 'now' WHERE id = 'f1'`).run();
  sqlite.prepare(`
    INSERT INTO folders (id, workspace_id, parent_id, name, sort_order, version, created_at, updated_at)
    VALUES ('f4', 'ws1', NULL, 'Raiz', 0, 1, 'now', 'now')
  `).run();

  // Unicidad en carpetas hijas (parent_id IS NOT NULL)
  sqlite.prepare(`
    INSERT INTO folders (id, workspace_id, parent_id, name, sort_order, version, created_at, updated_at)
    VALUES ('f5', 'ws1', 'f4', 'Hijo', 0, 1, 'now', 'now')
  `).run();

  assert.throws(() => {
    sqlite.prepare(`
      INSERT INTO folders (id, workspace_id, parent_id, name, sort_order, version, created_at, updated_at)
      VALUES ('f6', 'ws1', 'f4', 'Hijo', 0, 1, 'now', 'now')
    `).run();
  }, /UNIQUE constraint failed/);

  sqlite.close();
});

test('Phase 1: Folder Tree, Anti-cycle verification & OCC', async () => {
  const { sqlite } = await import('../backend/src/db');
  runPhase1Migrations(sqlite);

  const folderRepo = new FolderRepository();
  const outboxRepo = new OutboxRepository();
  const folderService = new FolderService(folderRepo, outboxRepo);

  const ws = 'ws-test-' + Date.now();

  // 1. Crear jerarquía Raiz -> H1 -> H2
  const raiz = folderService.create(ws, 'Raiz');
  assert.equal(raiz.version, 1);
  assert.equal(raiz.parent_id, null);

  const h1 = folderService.create(ws, 'H1', raiz.id);
  assert.equal(h1.parent_id, raiz.id);

  const h2 = folderService.create(ws, 'H2', h1.id);
  assert.equal(h2.parent_id, h1.id);

  // 2. Prevenir auto-paternidad
  assert.throws(() => {
    folderService.move(raiz.id, ws, raiz.id, 1);
  }, ValidationError);

  // 3. Prevenir ciclos: Mover Raiz dentro de H2 (su nieto)
  assert.throws(() => {
    folderService.move(raiz.id, ws, h2.id, 1);
  }, ValidationError);

  // 4. Prevenir ciclos: Mover Raiz dentro de H1 (su hijo)
  assert.throws(() => {
    folderService.move(raiz.id, ws, h1.id, 1);
  }, ValidationError);

  // 5. Prevenir violación de workspace
  assert.throws(() => {
    folderService.create('other-ws', 'Invalido', raiz.id);
  }, ValidationError);

  // 6. OCC: Mover H2 a Raiz con expected_version correcta (1)
  const h2Movido = folderService.move(h2.id, ws, raiz.id, 1);
  assert.equal(h2Movido.version, 2);
  assert.equal(h2Movido.parent_id, raiz.id);

  // 7. OCC Mismatch: Intentar mover H2 con version obsoleta (1) -> Conflicto 409
  assert.throws(() => {
    folderService.move(h2.id, ws, null, 1);
  }, ConflictError);

  // Mover con version correcta (2) -> éxito y pasa a 3
  const h2Root = folderService.move(h2.id, ws, null, 2);
  assert.equal(h2Root.version, 3);
  assert.equal(h2Root.parent_id, null);

  // 8. Visualización de Árbol (getTree)
  const tree = folderService.getTree(ws);
  assert.equal(tree.length, 2); // raiz y h2
  const raizInTree = tree.find(t => t.id === raiz.id);
  assert.ok(raizInTree);
  assert.equal(raizInTree!.children.length, 1);
  assert.equal(raizInTree!.children[0].id, h1.id);
});

test('Phase 1: Atomic Batch Trash and Selective Restore with Orphan Handling', async () => {
  const { sqlite } = await import('../backend/src/db');
  const folderRepo = new FolderRepository();
  const outboxRepo = new OutboxRepository();
  const folderService = new FolderService(folderRepo, outboxRepo);

  const ws = 'ws-trash-' + Date.now();

  const fA = folderService.create(ws, 'Folder A');
  const fB = folderService.create(ws, 'Folder B', fA.id);
  const fC = folderService.create(ws, 'Folder C');

  const now = new Date().toISOString();
  const c1Id = 'c1-' + Date.now();
  const c2Id = 'c2-' + Date.now();
  // Insertar conceptos vinculados a fB y fC
  sqlite.prepare(`
    INSERT INTO concepts (id, workspace_id, folder_id, title, explanation, domain, version, created_at, updated_at)
    VALUES (?, ?, ?, 'Nota 1', 'Texto', 'd', 1, ?, ?)
  `).run(c1Id, ws, fB.id, now, now);

  sqlite.prepare(`
    INSERT INTO concepts (id, workspace_id, folder_id, title, explanation, domain, version, created_at, updated_at)
    VALUES (?, ?, ?, 'Nota 2', 'Texto', 'd', 1, ?, ?)
  `).run(c2Id, ws, fC.id, now, now);

  // 1. Mandar Folder A (y su subárbol Folder B y Nota c1) a papelera
  const trashA = folderService.trashSubtree(fA.id, ws, 'user-1');
  assert.equal(trashA.affectedFolders, 2); // fA y fB
  assert.equal(trashA.affectedConcepts, 1); // c1

  // Verificar que fC y c2 siguen activos
  const treeAfterTrashA = folderService.getTree(ws);
  assert.equal(treeAfterTrashA.length, 1);
  assert.equal(treeAfterTrashA[0].id, fC.id);

  // 2. Mandar fC a papelera (lote separado)
  const trashC = folderService.trashSubtree(fC.id, ws, 'user-1');
  assert.notEqual(trashA.batchId, trashC.batchId);

  // 3. Restaurar selectivamente solo Lote A
  const restoreA = folderService.restoreTrashBatch(trashA.batchId, ws);
  assert.equal(restoreA.restoredFolders, 2);
  assert.equal(restoreA.restoredConcepts, 1);

  // Verificar que fC sigue en papelera
  const fCCheck = folderRepo.findById(fC.id, ws);
  assert.ok(fCCheck && fCCheck.deleted_at !== null);

  // 4. Probar idempotencia: intentar restaurar Lote A de nuevo debe fallar
  assert.throws(() => {
    folderService.restoreTrashBatch(trashA.batchId, ws);
  }, ValidationError);

  // 5. Huérfanos: Si enviamos fB a papelera y su padre fA está en papelera en otro lote
  const trashB = folderService.trashSubtree(fB.id, ws, 'user-1');
  const trashA2 = folderService.trashSubtree(fA.id, ws, 'user-1');

  // Al restaurar solo Lote B, fB tenía parent_id = fA (que sigue en papelera) -> se reasigna a la raíz (parent_id = null)
  const restoreB = folderService.restoreTrashBatch(trashB.batchId, ws);
  assert.equal(restoreB.reparentedFolders, 1);
  const fBRestored = folderRepo.findById(fB.id, ws);
  assert.equal(fBRestored!.parent_id, null);
});

test('Phase 1: Transactional Outbox Worker & Stale Job Drops', async () => {
  const { sqlite } = await import('../backend/src/db');
  sqlite.exec(`DELETE FROM outbox_jobs;`);

  const outboxRepo = new OutboxRepository();
  const outboxService = new OutboxService(outboxRepo);

  let processedCount = 0;
  outboxService.registerHandler('TEST_JOB', async (job) => {
    if (job.payload === 'FAIL') throw new Error('Simulated worker crash');
    processedCount++;
  });

  // 1. Encolar trabajo exitoso
  const job1 = outboxRepo.enqueue({
    job_type: 'TEST_JOB',
    entity_type: 'concept',
    entity_id: 'c1',
    entity_version: 1,
    payload: 'SUCCESS'
  });

  // 2. Encolar trabajo con fallo programado
  const jobFail = outboxRepo.enqueue({
    job_type: 'TEST_JOB',
    entity_type: 'concept',
    entity_id: 'c2',
    entity_version: 1,
    payload: 'FAIL',
    max_retries: 3
  });

  const res1 = await outboxService.processNextBatch(10);
  assert.equal(res1.completed, 1);
  assert.equal(res1.failed, 1);
  assert.equal(processedCount, 1);

  // Verificar que jobFail pasó a PENDING con retry_count = 1 y error guardado
  const updatedJobFail = outboxRepo.claimPendingBatch(10);
  // Como su scheduled_at se pospuso por el backoff exponencial, no debe estar inmediatamente listo
  assert.equal(updatedJobFail.length, 0);

  // 3. Stale job drop
  const staleJob = outboxRepo.enqueue({
    job_type: 'TEST_JOB',
    entity_type: 'concept',
    entity_id: 'c3',
    entity_version: 1
  });
  outboxRepo.markDiscarded(staleJob.id, 'Superseded by version 2');
  const checked = (outboxRepo as any).findById(staleJob.id);
  assert.equal(checked.status, 'COMPLETED');
  assert.ok(checked.last_error.includes('DISCARDED'));
});

test('Phase 1: Hierarchy Migration from Cerebros/Areas/Domains/Topics to Folders', async () => {
  const { sqlite } = await import('../backend/src/db');
  const folderRepo = new FolderRepository();
  const outboxRepo = new OutboxRepository();
  const migrationService = new HierarchyMigrationService(folderRepo, outboxRepo);

  const ws = 'ws-mig-' + Date.now();
  const now = new Date().toISOString();
  const validUserId = 'f88f364a-5c10-4818-8810-9cd1d3fe0eca';

  // Crear datos legacy en SQLite
  sqlite.prepare(`
    INSERT INTO cerebros (id, slug, name, user_id, created_at, updated_at)
    VALUES (?, ?, 'Cerebro Mig', ?, ?, ?)
  `).run(ws, ws, validUserId, now, now);

  const areaId = 'area-' + Date.now();
  sqlite.prepare(`
    INSERT INTO areas (id, cerebro_id, user_id, name)
    VALUES (?, ?, ?, 'Ciencias')
  `).run(areaId, ws, validUserId);

  const domainId = 'dom-' + Date.now();
  sqlite.prepare(`
    INSERT INTO domains (id, user_id, name, color, area_id)
    VALUES (?, ?, 'Física', '#fff', ?)
  `).run(domainId, validUserId, areaId);

  const topicId = 'topic-' + Date.now();
  sqlite.prepare(`
    INSERT INTO topics (id, user_id, domain_id, name)
    VALUES (?, ?, ?, 'Termodinámica')
  `).run(topicId, validUserId, domainId);

  const c1MigId = 'c-mig-1-' + Date.now();
  const c2MigId = 'c-mig-2-' + Date.now();

  // Crear 2 conceptos asociados
  sqlite.prepare(`
    INSERT INTO concepts (id, user_id, title, explanation, domain, topic_id, created_at, updated_at)
    VALUES (?, ?, 'Entropía', 'Explicación', ?, ?, ?, ?)
  `).run(c1MigId, validUserId, domainId, topicId, now, now);

  sqlite.prepare(`
    INSERT INTO concepts (id, user_id, title, explanation, domain, topic_id, created_at, updated_at)
    VALUES (?, ?, 'Calor', 'Explicación', ?, NULL, ?, ?)
  `).run(c2MigId, validUserId, domainId, now, now);

  // Ejecutar migración
  const result = migrationService.migrateWorkspace(ws);
  assert.equal(result.foldersCreated, 3); // Área, Dominio, Tema
  assert.equal(result.conceptsUpdated, 2);

  // Verificar árbol resultante
  const tree = folderRepo.getTree(ws);
  assert.equal(tree.length, 1);
  assert.equal(tree[0].name, 'Ciencias');
  assert.equal(tree[0].children[0].name, 'Física');
  assert.equal(tree[0].children[0].children[0].name, 'Termodinámica');

  // Verificar que conceptos tienen folder_id y workspace_id
  const c1 = sqlite.prepare(`SELECT folder_id, workspace_id FROM concepts WHERE id = ?`).get(c1MigId) as any;
  assert.equal(c1.folder_id, topicId);
  assert.equal(c1.workspace_id, ws);

  const c2 = sqlite.prepare(`SELECT folder_id, workspace_id FROM concepts WHERE id = ?`).get(c2MigId) as any;
  assert.equal(c2.folder_id, domainId);
  assert.equal(c2.workspace_id, ws);

  // Idempotencia: correr de nuevo no duplica
  const rerun = migrationService.migrateWorkspace(ws);
  assert.equal(rerun.foldersCreated, 0);
  assert.equal(rerun.conceptsUpdated, 0);
});
