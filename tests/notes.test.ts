import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { createPinia, setActivePinia } from 'pinia';
import { effectScope } from 'vue';
import { useConceptStore } from '../frontend/src/stores/concept.store';
import { useSaveCoordinator } from '../frontend/src/composables/useSaveCoordinator';

const note = (id = 'note-1', explanation = 'SQLite content') => ({
  id, title: 'Real note', explanation, domain: 'domain-1', topic_id: 'topic-1',
  created_at: '2025-01-01T00:00:00Z', updated_at: '2025-01-02T00:00:00Z'
});
const response = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

test('autosave calls persistence, coalesces typing and does not claim success early', async () => {
  const scope = effectScope();
  let calls = 0;
  let release!: () => void;
  const save = scope.run(() => useSaveCoordinator({
    exists: () => true, delay: 5,
    save: () => { calls++; return new Promise<void>(resolve => { release = resolve; }); }
  }))!;
  save.scheduleSave('a');
  save.scheduleSave('a');
  assert.equal(save.saveStates.value.a, 'dirty');
  assert.equal(save.hasUnsavedChanges.value, true);
  await delay(20);
  assert.equal(calls, 1);
  assert.equal(save.saveStates.value.a, 'saving');
  const flushed = save.flushUnsaved();
  release();
  assert.equal(await flushed, true);
  assert.equal(save.saveStates.value.a, 'saved');
  scope.stop();
});

test('edits arriving during a request are persisted in a second request', async () => {
  const scope = effectScope();
  let draft = 'first';
  const saved: string[] = [];
  let release!: () => void;
  const save = scope.run(() => useSaveCoordinator({
    exists: () => true,
    save: async () => {
      saved.push(draft);
      if (saved.length === 1) await new Promise<void>(resolve => { release = resolve; });
    }
  }))!;
  save.markDirty('a');
  const pending = save.persistFile('a');
  draft = 'second';
  save.scheduleSave('a');
  release();
  assert.equal(await pending, true);
  assert.deepEqual(saved, ['first', 'second']);
  assert.equal(save.hasUnsavedChanges.value, false);
  scope.stop();
});

test('failed save retries once, retains unsaved state and blocks flushing until recovery', async () => {
  const scope = effectScope();
  let fail = true;
  let attempts = 0;
  const save = scope.run(() => useSaveCoordinator({
    exists: () => true, save: async () => { attempts++; if (fail) throw new Error('Offline'); }
  }))!;
  save.markDirty('a');
  assert.equal(await save.flushUnsaved(), false);
  assert.equal(attempts, 2);
  assert.equal(save.saveStates.value.a, 'error');
  assert.equal(save.hasUnsavedChanges.value, true);
  assert.equal(save.saveErrors.value.a, 'Offline');
  fail = false;
  assert.equal(await save.flushUnsaved(), true);
  assert.equal(save.saveStates.value.a, 'saved');
  scope.stop();
});

test('multiple dirty notes are all flushed', async () => {
  const saved: string[] = [];
  const scope = effectScope();
  const save = scope.run(() => useSaveCoordinator({
    exists: () => true, save: async id => { saved.push(id); }
  }))!;
  save.scheduleSave('a');
  save.scheduleSave('b');
  assert.equal(await save.flushUnsaved(), true);
  assert.deepEqual(saved.sort(), ['a','b']);
  scope.stop();
});

test('detail loads beyond the first page are cached and can be edited', async () => {
  const original = globalThis.fetch;
  setActivePinia(createPinia());
  globalThis.fetch = async () => response(note('note-621'));
  try {
    const store = useConceptStore();
    const loaded = await store.fetchConceptById('note-621');
    assert.equal(loaded.explanation, 'SQLite content');
    assert.equal(store.concepts[0].id, 'note-621');
    assert.equal(store.summaries[0].topic_id, 'topic-1');
  } finally { globalThis.fetch = original; }
});

test('server errors do not pretend a write succeeded; stale summaries are removed on delete', async () => {
  const original = globalThis.fetch;
  setActivePinia(createPinia());
  const store = useConceptStore();
  store.concepts = [note()];
  store.upsertSummary(note());
  try {
    globalThis.fetch = async () => response({ error: 'Write failed' }, 500);
    await assert.rejects(store.updateConcept('note-1', { explanation: 'draft' }), /Write failed/);
    assert.equal(store.concepts[0].explanation, 'SQLite content');
    await assert.rejects(store.deleteConcept('note-1'), /Write failed/);
    assert.equal(store.summaries.length, 1);
    globalThis.fetch = async () => response({ success: true });
    await store.deleteConcept('note-1');
    assert.equal(store.summaries.length, 0);
    assert.equal(store.concepts.length, 0);
  } finally { globalThis.fetch = original; }
});

test('late server responses never replace newer local edits', async () => {
  const original = globalThis.fetch;
  setActivePinia(createPinia());
  const store = useConceptStore();
  store.concepts = [note('note-1', 'first')];
  let release!: (value: Response) => void;
  globalThis.fetch = () => new Promise<Response>(resolve => { release = resolve; });
  try {
    const pending = store.updateConcept('note-1', { explanation: 'first' });
    store.concepts[0].explanation = 'newest draft';
    release(response(note('note-1', 'first')));
    await pending;
    assert.equal(store.concepts[0].explanation, 'newest draft');
  } finally { globalThis.fetch = original; }
});

test('empty database and failed list requests do not show cached or invented notes', async () => {
  const original = globalThis.fetch;
  setActivePinia(createPinia());
  const store = useConceptStore();
  store.upsertSummary(note());
  try {
    globalThis.fetch = async () => response([]);
    await store.fetchSummaries();
    assert.deepEqual(store.summaries, []);
    store.upsertSummary(note());
    globalThis.fetch = async () => response({ error: 'Unavailable' }, 503);
    await assert.rejects(store.fetchSummaries(), /Unavailable/);
    assert.equal(store.summaries.length, 0);
    assert.equal(store.error, 'Unavailable');
  } finally { globalThis.fetch = original; }
});

test('real SQLite repositories persist empty edits and expose actual dates, topics and history', async () => {
  process.env.COGNI_VAULT_DB_PATH = ':memory:';
  const { sqlite } = await import('../backend/src/db');
  const { getTableConfig } = await import('drizzle-orm/sqlite-core');
  const { concepts, concept_versions } = await import('../backend/src/schemas/concept.schema');
  const { domains } = await import('../backend/src/schemas/domain.schema');
  try {
    for (const table of [domains, concepts, concept_versions]) {
      const config = getTableConfig(table);
      const columns = config.columns.map(c => '"' + c.name + '" ' + c.getSQLType() + (c.primary ? ' PRIMARY KEY' : '') + (c.notNull ? ' NOT NULL' : ''));
      sqlite.exec('CREATE TABLE "' + config.name + '" (' + columns.join(',') + ')');
    }
    const { conceptService } = await import('../backend/src/di/containers/concept.container');
    assert.deepEqual(conceptService.getSummaries('test-user'), []);
    const created = conceptService.create({ title: 'Persisted note', explanation: 'Original', topic_id: 'topic-1' }, 'test-user');
    conceptService.update(created.id, { explanation: '' }, 'test-user');
    assert.equal(sqlite.prepare('SELECT explanation FROM concepts WHERE id = ?').get(created.id).explanation, '');
    const [summary] = conceptService.getSummaries('test-user');
    assert.equal(summary.topic_id, 'topic-1');
    assert.equal(summary.created_at, created.created_at);
    const [version] = conceptService.getVersions(created.id, 'test-user');
    assert.equal(conceptService.getVersion(created.id, version.id, 'test-user').explanation, 'Original');
    const restored = conceptService.restoreVersion(created.id, version.id, 'test-user');
    assert.equal(restored.explanation, 'Original');
    assert.equal(conceptService.getById(created.id, 'test-user')?.explanation, 'Original');
    assert.deepEqual(conceptService.getSummaries('another-user'), []);
  } finally { sqlite.close(); }
});
