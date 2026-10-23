import { test, describe, before } from 'node:test';
import assert from 'node:assert';

// Configure the database to run in-memory for the test
process.env.DB_PATH = ':memory:';

describe('Papelera de conceptos (soft delete, restore, purge)', () => {
  let sqlite: any;
  let conceptService: any;
  let conceptRepository: any;
  let reviewService: any;
  let analyticsService: any;
  let userId: string;

  before(async () => {
    // Dynamically import to ensure process.env.DB_PATH is set before connection initialization
    const connection = await import('../../infrastructure/database/connection.js');
    sqlite = connection.sqlite;

    const conceptContainer = await import('../../infrastructure/di/containers/concept.container.js');
    conceptService = conceptContainer.conceptService;

    const sharedRepos = await import('../../infrastructure/di/containers/shared-repositories.js');
    conceptRepository = sharedRepos.conceptRepository;

    const reviewContainer = await import('../../infrastructure/di/containers/review.container.js');
    reviewService = reviewContainer.reviewService;

    const analyticsContainer = await import('../../infrastructure/di/containers/analytics.container.js');
    analyticsService = analyticsContainer.analyticsService;

    connection.initDb();

    userId = 'u-test';
    sqlite.prepare(`INSERT INTO users (id, email, created_at, updated_at) VALUES (?, ?, datetime('now'), datetime('now'))`).run(userId, 'test@example.com');
  });

  test('borrar mueve a la papelera: desaparece de listados pero conserva sus datos', () => {
    const c = conceptService.create({ title: 'Nota papelera', explanation: 'contenido', domain: 'test' }, userId);

    conceptService.delete(c.id, userId);

    assert.ok(!conceptService.getAll(userId).some((x: any) => x.id === c.id), 'getAll no debe incluirla');
    const trashed = conceptService.getTrashed(userId);
    assert.ok(trashed.some((x: any) => x.id === c.id), 'getTrashed debe incluirla');
    assert.ok(trashed.find((x: any) => x.id === c.id).deleted_at, 'debe exponer deleted_at');

    // El estado de memoria sobrevive (a diferencia del borrado duro con CASCADE)
    const memory = sqlite.prepare('SELECT * FROM memory_states WHERE concept_id = ?').get(c.id);
    assert.ok(memory, 'memory_states debe conservarse durante el soft delete');

    // Los contadores de repaso y analytics la excluyen
    assert.strictEqual(reviewService.getDueCounts(userId).all, 0, 'no debe contar en la cola de repasos');
    assert.strictEqual(analyticsService.getStats(userId).stats.concepts, 0, 'no debe contar en analytics');
    assert.strictEqual(analyticsService.getStats(userId).stats.due, 0, 'no debe contar como repaso pendiente');

    conceptService.purge(c.id, userId);
  });

  test('editar una nota en papelera lanza NotFound; borrar dos veces es no-op', () => {
    const c = conceptService.create({ title: 'Inmutable en papelera', explanation: 'x', domain: 'test' }, userId);
    conceptService.delete(c.id, userId);

    assert.throws(() => conceptService.update(c.id, { title: 'no debería' }, userId), /no encontrado/i);
    assert.doesNotThrow(() => conceptService.delete(c.id, userId), 'segundo delete debe ser idempotente');

    conceptService.purge(c.id, userId);
  });

  test('restaurar devuelve la nota intacta a los listados', () => {
    const c = conceptService.create({ title: 'Nota restaurable', explanation: 'contenido', domain: 'test' }, userId);
    conceptService.delete(c.id, userId);

    const restored = conceptService.restore(c.id, userId);
    assert.strictEqual(restored.title, 'Nota restaurable');
    assert.strictEqual(restored.deleted_at, null);

    assert.ok(conceptService.getAll(userId).some((x: any) => x.id === c.id), 'debe volver a getAll');
    assert.ok(!conceptService.getTrashed(userId).some((x: any) => x.id === c.id), 'debe salir de la papelera');
    assert.strictEqual(reviewService.getDueCounts(userId).all, 1, 'vuelve a contar en repasos');

    conceptService.delete(c.id, userId);
    conceptService.purge(c.id, userId);
  });

  test('purge exige pasar por la papelera y elimina en cascada', () => {
    const c = conceptService.create({ title: 'Nota purgable', explanation: 'x', domain: 'test' }, userId);

    // Nunca debe destruir una nota viva
    assert.throws(() => conceptService.purge(c.id, userId), /papelera/i);

    conceptService.delete(c.id, userId);
    conceptService.purge(c.id, userId);

    assert.strictEqual(conceptService.getById(c.id, userId), undefined);
    assert.ok(!conceptService.getTrashed(userId).some((x: any) => x.id === c.id));
    const memory = sqlite.prepare('SELECT * FROM memory_states WHERE concept_id = ?').get(c.id);
    assert.strictEqual(memory, undefined, 'CASCADE debe eliminar memory_states');

    // Restaurar algo ya purgado (o nunca borrado) lanza NotFound
    assert.throws(() => conceptService.restore(c.id, userId), /papelera/i);
  });

  test('purgeOlderThan solo purga lo que supera el umbral', () => {
    const vieja = conceptService.create({ title: 'Vieja en papelera', explanation: 'x', domain: 'test' }, userId);
    const reciente = conceptService.create({ title: 'Reciente en papelera', explanation: 'x', domain: 'test' }, userId);
    conceptService.delete(vieja.id, userId);
    conceptService.delete(reciente.id, userId);

    // Simular 31 días en la papelera
    const hace31Dias = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString();
    sqlite.prepare('UPDATE concepts SET deleted_at = ? WHERE id = ?').run(hace31Dias, vieja.id);

    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const purged = conceptRepository.purgeOlderThan(cutoff);

    assert.strictEqual(purged, 1, 'solo debe purgar la nota vieja');
    assert.strictEqual(conceptService.getById(vieja.id, userId), undefined);
    assert.ok(conceptService.getTrashed(userId).some((x: any) => x.id === reciente.id), 'la reciente sigue en la papelera');

    conceptService.purge(reciente.id, userId);
  });
});
