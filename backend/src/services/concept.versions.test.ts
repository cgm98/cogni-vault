import { test, describe, before } from 'node:test';
import assert from 'node:assert';

// Configure the database to run in-memory for the test
process.env.DB_PATH = ':memory:';

describe('Historial de versiones de notas (snapshots, restore, poda)', () => {
  let sqlite: any;
  let conceptService: any;
  let conceptVersionRepository: any;
  let userId: string;

  const ageVersions = (conceptId: string, minutes: number) => {
    const iso = new Date(Date.now() - minutes * 60 * 1000).toISOString();
    sqlite.prepare('UPDATE concept_versions SET created_at = ? WHERE concept_id = ?').run(iso, conceptId);
  };

  before(async () => {
    const connection = await import('../../infrastructure/database/connection.js');
    sqlite = connection.sqlite;

    const conceptContainer = await import('../../infrastructure/di/containers/concept.container.js');
    conceptService = conceptContainer.conceptService;
    conceptVersionRepository = conceptContainer.conceptVersionRepository;

    connection.initDb();

    userId = 'u-test';
    sqlite.prepare(`INSERT INTO users (id, email, created_at, updated_at) VALUES (?, ?, datetime('now'), datetime('now'))`).run(userId, 'test@example.com');
  });

  test('el primer edit crea un snapshot del estado PREVIO', () => {
    const c = conceptService.create({ title: 'Nota versionada', explanation: 'v1', domain: '' }, userId);

    conceptService.update(c.id, { explanation: 'v2' }, userId);

    const versions = conceptService.getVersions(c.id, userId);
    assert.strictEqual(versions.length, 1);
    assert.strictEqual(versions[0].title, 'Nota versionada');
    assert.strictEqual(versions[0].content_length, 2, 'el summary expone length(explanation)');

    const full = conceptService.getVersion(c.id, versions[0].id, userId);
    assert.strictEqual(full.explanation, 'v1', 'debe capturar el contenido anterior al edit');
  });

  test('la ventana de 5 min suprime snapshots consecutivos; pasada la ventana vuelve a capturar', () => {
    const c = conceptService.create({ title: 'Ventana', explanation: 'a', domain: '' }, userId);

    conceptService.update(c.id, { explanation: 'b' }, userId);
    conceptService.update(c.id, { explanation: 'c' }, userId);
    assert.strictEqual(conceptService.getVersions(c.id, userId).length, 1, 'dentro de la ventana no snapshotea');

    ageVersions(c.id, 6);
    conceptService.update(c.id, { explanation: 'd' }, userId);

    const versions = conceptService.getVersions(c.id, userId);
    assert.strictEqual(versions.length, 2, 'pasada la ventana vuelve a snapshotear');
    const newest = conceptService.getVersion(c.id, versions[0].id, userId);
    assert.strictEqual(newest.explanation, 'c', 'captura el estado previo al último edit');
  });

  test('editar solo el título no crea versión', () => {
    const c = conceptService.create({ title: 'Solo título', explanation: 'x', domain: '' }, userId);
    conceptService.update(c.id, { title: 'Título nuevo' }, userId);
    assert.strictEqual(conceptService.getVersions(c.id, userId).length, 0);
  });

  test('restaurar fuerza snapshot del estado actual y aplica título+contenido', () => {
    const c = conceptService.create({ title: 'Original', explanation: 'contenido viejo', domain: '' }, userId);
    conceptService.update(c.id, { title: 'Editada', explanation: 'contenido nuevo' }, userId);

    const [vieja] = conceptService.getVersions(c.id, userId);
    const restored = conceptService.restoreVersion(c.id, vieja.id, userId);

    assert.strictEqual(restored.title, 'Original');
    assert.strictEqual(restored.explanation, 'contenido viejo');
    assert.strictEqual(conceptService.getById(c.id, userId).explanation, 'contenido viejo');

    // El snapshot forzado (pese a la ventana reciente) contiene el estado pre-restore
    const versions = conceptService.getVersions(c.id, userId);
    assert.strictEqual(versions.length, 2);
    const newest = conceptService.getVersion(c.id, versions[0].id, userId);
    assert.strictEqual(newest.explanation, 'contenido nuevo');
    assert.strictEqual(newest.title, 'Editada');
  });

  test('guards: versión ajena, nota en papelera, y trash-restore', () => {
    const a = conceptService.create({ title: 'Nota A', explanation: 'a1', domain: '' }, userId);
    const b = conceptService.create({ title: 'Nota B', explanation: 'b1', domain: '' }, userId);
    conceptService.update(a.id, { explanation: 'a2' }, userId);

    const [versionDeA] = conceptService.getVersions(a.id, userId);
    assert.throws(() => conceptService.restoreVersion(b.id, versionDeA.id, userId), /no encontrada/i);

    conceptService.delete(a.id, userId); // a la papelera
    assert.throws(() => conceptService.restoreVersion(a.id, versionDeA.id, userId), /no encontrado/i);
    assert.strictEqual(conceptService.getVersions(a.id, userId).length, 1, 'el historial sobrevive al trash');

    conceptService.restore(a.id, userId); // de vuelta de la papelera
    const restored = conceptService.restoreVersion(a.id, versionDeA.id, userId);
    assert.strictEqual(restored.explanation, 'a1');
  });

  test('poda de retención: se conservan solo las 50 más nuevas', () => {
    const c = conceptService.create({ title: 'Poda', explanation: 'x', domain: '' }, userId);
    const base = Date.now() - 60 * 60 * 1000;
    for (let i = 0; i < 55; i++) {
      conceptVersionRepository.create({
        id: `cv-poda-${String(i).padStart(2, '0')}`,
        concept_id: c.id,
        title: 'Poda',
        explanation: `contenido ${i}`,
        created_at: new Date(base + i * 1000).toISOString()
      });
    }
    const versions = conceptVersionRepository.getForConcept(c.id);
    assert.strictEqual(versions.length, 50);
    const ids = versions.map((v: any) => v.id);
    for (let i = 0; i < 5; i++) {
      assert.ok(!ids.includes(`cv-poda-0${i}`), `la versión vieja cv-poda-0${i} debe haberse podado`);
    }
  });

  test('purgar la nota elimina sus versiones por CASCADE', () => {
    const c = conceptService.create({ title: 'Purgable', explanation: 'x', domain: '' }, userId);
    conceptService.update(c.id, { explanation: 'y' }, userId);
    assert.strictEqual(conceptService.getVersions(c.id, userId).length, 1);

    conceptService.delete(c.id, userId);
    conceptService.purge(c.id, userId);

    const count = sqlite.prepare('SELECT COUNT(*) AS n FROM concept_versions WHERE concept_id = ?').get(c.id);
    assert.strictEqual(count.n, 0);
  });
});
