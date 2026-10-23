import { test, describe, before } from 'node:test';
import assert from 'node:assert';

// Configure the database to run in-memory for the test
process.env.DB_PATH = ':memory:';

describe('Dominio por defecto para notas sin dominio válido', () => {
  let sqlite: any;
  let conceptService: any;
  let domainService: any;
  let defaultDomainId: string;
  let userId: string;

  before(async () => {
    const connection = await import('../../infrastructure/database/connection.js');
    sqlite = connection.sqlite;

    const conceptContainer = await import('../../infrastructure/di/containers/concept.container.js');
    conceptService = conceptContainer.conceptService;

    const domainContainer = await import('../../infrastructure/di/containers/domain.container.js');
    domainService = domainContainer.domainService;

    const domainEntity = await import('../../domain/entities/domain.entity.js');

    connection.initDb();

    userId = 'u-test';
    sqlite.prepare(`INSERT INTO users (id, email, created_at, updated_at) VALUES (?, ?, datetime('now'), datetime('now'))`).run(userId, 'test@example.com');
    defaultDomainId = domainEntity.defaultDomainFor(userId).id;
  });

  test('crear sin dominio o con dominio inexistente asigna el dominio "sin clasificar" y lo crea', () => {
    const sinDominio = conceptService.create({ title: 'Sin dominio', explanation: 'x', domain: '' }, userId);
    assert.strictEqual(sinDominio.domain, defaultDomainId);

    const dominioFalso = conceptService.create({ title: 'Dominio falso', explanation: 'x', domain: 'no-existe' }, userId);
    assert.strictEqual(dominioFalso.domain, defaultDomainId);

    const defaultDomain = sqlite.prepare('SELECT * FROM domains WHERE id = ?').get(defaultDomainId);
    assert.ok(defaultDomain, 'el dominio por defecto debe existir en la tabla domains');
    assert.strictEqual(defaultDomain.name, 'Sin clasificar');
  });

  test('crear con dominio válido lo respeta', () => {
    const dominio = domainService.create({ id: 'dominio-real', name: 'Dominio Real' }, userId);
    const c = conceptService.create({ title: 'Con dominio', explanation: 'x', domain: dominio.id }, userId);
    assert.strictEqual(c.domain, 'dominio-real');
  });

  test('actualizar con dominio inválido normaliza; con válido lo respeta', () => {
    const c = conceptService.create({ title: 'Editable', explanation: 'x', domain: 'dominio-real' }, userId);

    const norm = conceptService.update(c.id, { domain: 'tampoco-existe' }, userId);
    assert.strictEqual(norm.domain, defaultDomainId);

    const back = conceptService.update(c.id, { domain: 'dominio-real' }, userId);
    assert.strictEqual(back.domain, 'dominio-real');
  });

  test('borrar un dominio reasigna sus notas al dominio por defecto', () => {
    const dominio = domainService.create({ id: 'dominio-condenado', name: 'Condenado' }, userId);
    const c = conceptService.create({ title: 'Nota del condenado', explanation: 'x', domain: dominio.id }, userId);

    domainService.delete(dominio.id, userId);

    const fila = sqlite.prepare('SELECT domain FROM concepts WHERE id = ?').get(c.id);
    assert.strictEqual(fila.domain, defaultDomainId, 'la nota debe reasignarse, no quedar huérfana');
  });
});
