import { test, describe, before } from 'node:test';
import assert from 'node:assert';

// Configure the database to run in-memory for the test
process.env.DB_PATH = ':memory:';

describe('Concept and Relation Stress Test (100 Notes and Complete Database Schema)', () => {
  let initDb: () => void;
  let sqlite: any;
  let generateDatabaseSeedData: (sqliteInstance: any) => void;
  let conceptService: any;
  let relationService: any;
  let projectService: any;
  let analyticsService: any;
  let userId: string;

  before(async () => {
    // Dynamically import to ensure process.env.DB_PATH is set before connection initialization
    const connection = await import('../../infrastructure/database/connection.js');
    initDb = connection.initDb;
    sqlite = connection.sqlite;

    const seedGen = await import('../../infrastructure/database/seed-generator.js');
    generateDatabaseSeedData = seedGen.generateDatabaseSeedData;

    const conceptContainer = await import('../../infrastructure/di/containers/concept.container.js');
    conceptService = conceptContainer.conceptService;

    const relationContainer = await import('../../infrastructure/di/containers/relation.container.js');
    relationService = relationContainer.relationService;

    const projectContainer = await import('../../infrastructure/di/containers/project.container.js');
    projectService = projectContainer.projectService;

    const analyticsContainer = await import('../../infrastructure/di/containers/analytics.container.js');
    analyticsService = analyticsContainer.analyticsService;

    // Initialize the in-memory SQLite tables
    initDb();

    // Populate all 14 tables with the 100 well-structured concepts and related statistics
    generateDatabaseSeedData(sqlite);

    // El seed inserta con SQL crudo, sin user_id (no conoce el modelo multi-usuario):
    // se asigna todo a un único usuario de prueba, igual que el backfill de producción.
    userId = 'u-test';
    sqlite.prepare(`INSERT INTO users (id, email, created_at, updated_at) VALUES (?, ?, datetime('now'), datetime('now'))`).run(userId, 'test@example.com');
    sqlite.prepare('UPDATE concepts SET user_id = ?').run(userId);
    sqlite.prepare('UPDATE domains SET user_id = ?').run(userId);
    sqlite.prepare('UPDATE projects SET user_id = ?').run(userId);
  });

  test('Debería validar que se hayan insertado las 100 notas diferentes con conceptos reales', () => {
    const allConcepts = conceptService.getAll(userId);
    // Debe contener las 101 notas reales
    assert.strictEqual(allConcepts.length, 101);

    // Verificar diversidad de títulos y dominios
    const titles = allConcepts.map((c: any) => c.title);
    assert.ok(titles.includes('Patrón Singleton'));
    assert.ok(titles.includes('Reactividad en Vue'));
    assert.ok(titles.includes('Contenedores Docker'));
    assert.ok(titles.includes('Principio de Responsabilidad Única'));

    // Verificar que los estados de memoria de SM-2 estén inicializados y tengan datos reales
    for (const c of allConcepts) {
      assert.strictEqual(c.status, 'active');
      assert.ok(c.stability > 0, `El concepto ${c.title} debería tener estabilidad positiva`);
      assert.ok(c.retrievability >= 0 && c.retrievability <= 1, `Retrievability fuera de rango para ${c.title}`);
      assert.ok(c.review_count >= 2, `Se esperaba historial de repasos para ${c.title}`);
    }
  });

  test('Debería validar que se hayan creado y enlazado las relaciones correspondientes', () => {
    const allRelations = relationService.getAll(userId);
    assert.ok(allRelations.length >= 100, `Se esperaban más de 100 relaciones, encontradas: ${allRelations.length}`);

    // Verificar relaciones por concepto específico
    const singletonRelations = relationService.getForConcept('singleton', userId);
    assert.ok(singletonRelations.length > 0, 'El patrón Singleton debería estar enlazado con otros patrones');
  });

  test('Debería retornar todos los proyectos con recuentos sin errores de SQL (ambigüedad de ID)', () => {
    const list = projectService.getAll(userId);
    assert.strictEqual(list.length, 4, 'Se esperaban exactamente 4 proyectos en el seed');
    
    // Verificar correspondencia y conteos
    const coreProject = list.find((p: any) => p.id === 'p-core');
    assert.ok(coreProject);
    assert.ok(coreProject.conceptCount > 0, 'El proyecto de refactorización de core debería tener conceptos asociados');
    assert.strictEqual(coreProject.experimentCount, 1, 'Se esperaba 1 experimento en el proyecto core');
    assert.strictEqual(coreProject.decisionCount, 1, 'Se esperaba 1 decisión en el proyecto core');
  });

  test('Debería obtener estadísticas de notas y dominios', () => {
    const res = analyticsService.getStats(userId);
    assert.ok(res);
    assert.strictEqual(res.stats.totalConcepts, 101);
    assert.ok(res.stats.totalDomains > 0);
    assert.ok(Array.isArray(res.domainDist));
  });
});

