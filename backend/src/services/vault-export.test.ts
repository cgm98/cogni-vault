import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { sqlite } from '../../infrastructure/database/connection.js';
import { buildVaultFiles } from './vault-export.service.js';

describe('VaultExportService - Markdown Zip Backup Engine', () => {
  const testUserId = `test-user-export-${Date.now()}`;
  const area1Id = `area-tech-${Date.now()}`;
  const area2Id = `area-science-${Date.now()}`;
  const domain1Id = `dom-ai-${Date.now()}`;
  const domain2Id = `dom-bio-${Date.now()}`;
  const topic1Id = `top-llm-${Date.now()}`;
  const concept1Id = `concept-transformers-${Date.now()}`;
  const concept2Id = `concept-crispr-${Date.now()}`;

  it('sets up mock database records and validates full vs per-area vault export', () => {
    // 0. Insert test User
    sqlite.prepare('INSERT INTO users (id, email) VALUES (?, ?)').run(
      testUserId, `${testUserId}@test.com`
    );

    // 1. Insert test Areas
    sqlite.prepare('INSERT INTO areas (id, user_id, name, description, color) VALUES (?, ?, ?, ?, ?)').run(
      area1Id, testUserId, 'Tecnología', 'Área de tecnología', '#7b5cea'
    );
    sqlite.prepare('INSERT INTO areas (id, user_id, name, description, color) VALUES (?, ?, ?, ?, ?)').run(
      area2Id, testUserId, 'Biología', 'Área de ciencias biológicas', '#10b981'
    );

    // 2. Insert Domains
    sqlite.prepare('INSERT INTO domains (id, user_id, name, color, area_id) VALUES (?, ?, ?, ?, ?)').run(
      domain1Id, testUserId, 'Inteligencia Artificial', '#7b5cea', area1Id
    );
    sqlite.prepare('INSERT INTO domains (id, user_id, name, color, area_id) VALUES (?, ?, ?, ?, ?)').run(
      domain2Id, testUserId, 'Genómica', '#10b981', area2Id
    );

    // 3. Insert Topics
    sqlite.prepare('INSERT INTO topics (id, user_id, name, domain_id) VALUES (?, ?, ?, ?)').run(
      topic1Id, testUserId, 'LLMs', domain1Id
    );

    // 4. Insert Concepts
    const nowIso = new Date().toISOString();
    sqlite.prepare(`
      INSERT INTO concepts (id, user_id, title, explanation, domain, topic_id, strength, difficulty, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      concept1Id, testUserId, 'Transformers Architecture', 'Mecanismo de atención [[Crispr Cas9]]', domain1Id, topic1Id, 0.8, 3, nowIso, nowIso
    );

    sqlite.prepare(`
      INSERT INTO concepts (id, user_id, title, explanation, domain, strength, difficulty, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      concept2Id, testUserId, 'Crispr Cas9', 'Edición genética guiada por ARN', domain2Id, 0.9, 4, nowIso, nowIso
    );

    // 5. Test Full Export (all areas)
    const fullExport = buildVaultFiles(testUserId);
    assert.equal(fullExport.notes.length, 2, 'Full export must contain all 2 concepts');
    assert.equal(fullExport.areaName, undefined, 'Full export areaName must be undefined');
    assert.ok(fullExport.folders.some(f => f.includes('Tecnología')), 'Folders must include Area 1');
    assert.ok(fullExport.folders.some(f => f.includes('Biología')), 'Folders must include Area 2');

    // 6. Test Specific Area 1 Export (Tecnología)
    const area1Export = buildVaultFiles(testUserId, { areaId: area1Id });
    assert.equal(area1Export.notes.length, 1, 'Area 1 export must contain exactly 1 note');
    assert.equal(area1Export.areaName, 'Tecnología', 'Area 1 export name must match');
    assert.ok(area1Export.notes[0].relPath.startsWith('Tecnología/'), 'Note must be nested inside Area 1 path');
    assert.ok(area1Export.notes[0].content.includes('TransformersArchitecture'), 'Note content title must match');

    // 7. Test Specific Area 2 Export (Biología)
    const area2Export = buildVaultFiles(testUserId, { areaId: area2Id });
    assert.equal(area2Export.notes.length, 1, 'Area 2 export must contain exactly 1 note');
    assert.equal(area2Export.areaName, 'Biología');
    assert.ok(area2Export.notes[0].relPath.startsWith('Biología/'));

    // Cleanup
    sqlite.prepare('DELETE FROM concepts WHERE user_id = ?').run(testUserId);
    sqlite.prepare('DELETE FROM topics WHERE user_id = ?').run(testUserId);
    sqlite.prepare('DELETE FROM domains WHERE user_id = ?').run(testUserId);
    sqlite.prepare('DELETE FROM areas WHERE user_id = ?').run(testUserId);
    sqlite.prepare('DELETE FROM users WHERE id = ?').run(testUserId);
  });
});
