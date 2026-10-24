import test from 'node:test';
import assert from 'node:assert/strict';
import { markdownToCanonicalAst, canonicalAstToMarkdown } from '../backend/domain/ast/markdown-transpiler';
import { TaxonomyRepository } from '../backend/infrastructure/repositories/taxonomy.repository';
import { TagRepository } from '../backend/infrastructure/repositories/tag.repository';
import { OutboxRepository } from '../backend/infrastructure/repositories/outbox.repository';
import { TaxonomyService } from '../backend/src/services/taxonomy.service';
import { ConceptDocumentService } from '../backend/src/services/concept-document.service';
import { ConflictError, ValidationError, NotFoundError } from '../backend/domain/errors';

test('Phase 2: Canonical AST and Markdown Round-trip Fidelity', () => {
  const source = [
    '# Título Principal',
    'Párrafo con texto **negrita**, *cursiva*, `código inline`, $E=mc^2$ y [[NotaReferencia|Mi Alias]].',
    '```mermaid\ngraph TD\n  A-->B\n  B-->C\n```',
    '$$\na^2 + b^2 = c^2\n$$',
    '| Columna A | Columna B |\n| --- | --- |\n| Valor 1 | Valor 2 |\n| Valor 3 | Valor 4 |',
    '- [x] Tarea completada\n- [ ] Tarea pendiente',
    '- Elemento uno\n- Elemento dos',
    '1. Primer paso\n2. Segundo paso',
    '> Cita textual en bloque'
  ].join('\n\n');

  const ast = markdownToCanonicalAst(source);
  assert.equal(ast.schema_version, 1);
  assert.equal(ast.type, 'doc');

  // Verificar nodos identificados
  const nodeTypes = ast.content.map(n => n.type);
  assert.ok(nodeTypes.includes('heading'));
  assert.ok(nodeTypes.includes('paragraph'));
  assert.ok(nodeTypes.includes('mermaid_block'));
  assert.ok(nodeTypes.includes('math_block'));
  assert.ok(nodeTypes.includes('table'));
  assert.ok(nodeTypes.includes('task_list'));
  assert.ok(nodeTypes.includes('bullet_list'));
  assert.ok(nodeTypes.includes('ordered_list'));
  assert.ok(nodeTypes.includes('blockquote'));

  // Roundtrip
  const reconstructed = canonicalAstToMarkdown(ast);
  assert.equal(reconstructed.trim(), source.trim());
});

test('Phase 2: Concept Document Service (AST Versioning & OCC)', async () => {
  const { sqlite } = await import('../backend/src/db');
  const outboxRepo = new OutboxRepository();
  const docService = new ConceptDocumentService(outboxRepo);

  const ws = 'ws-doc-' + Date.now();
  const conceptId = 'c-doc-' + Date.now();
  const now = new Date().toISOString();

  const markdownSample = '# Hola\n\n```mermaid\ngraph LR\nA-->B\n```';

  // Crear concepto con Markdown plano y sin doc_ast
  sqlite.prepare(`
    INSERT INTO concepts (id, workspace_id, title, explanation, domain, version, created_at, updated_at)
    VALUES (?, ?, 'Nota AST', ?, 'd', 1, ?, ?)
  `).run(conceptId, ws, markdownSample, now, now);

  // 1. getDocument debe auto-generar y persistir el AST
  const doc = docService.getDocument(conceptId);
  assert.equal(doc.version, 1);
  assert.equal(doc.ast.content[0].type, 'heading');
  assert.equal(doc.ast.content[1].type, 'mermaid_block');

  // Verificar que se guardó en BD
  const rawRow = sqlite.prepare(`SELECT doc_ast FROM concepts WHERE id = ?`).get(conceptId) as any;
  assert.ok(rawRow.doc_ast !== null);

  // 2. updateDocument con AST modificado y OCC correcto
  const modifiedAst = {
    ...doc.ast,
    content: [
      ...doc.ast.content,
      {
        type: 'paragraph' as const,
        content: [{ type: 'text' as const, text: 'Párrafo añadido vía AST' }]
      }
    ]
  };

  const updated = docService.updateDocument(conceptId, modifiedAst, 1);
  assert.equal(updated.version, 2);
  assert.ok(updated.markdown.includes('Párrafo añadido vía AST'));

  // 3. updateDocument con OCC mismatch debe fallar con ConflictError
  assert.throws(() => {
    docService.updateDocument(conceptId, modifiedAst, 1);
  }, ConflictError);

  // 4. Verificar que se encolaron trabajos en el Outbox con version = 2
  const jobs = outboxRepo.claimPendingBatch(10);
  const conceptJobs = jobs.filter(j => j.entity_id === conceptId);
  assert.ok(conceptJobs.some(j => j.job_type === 'INDEX_FTS' && j.entity_version === 2));
  assert.ok(conceptJobs.some(j => j.job_type === 'EMBEDDING_VEC' && j.entity_version === 2));
});

test('Phase 2: Taxonomy Terms Hierarchical Tree & Unique Indexes', () => {
  const taxRepo = new TaxonomyRepository();
  const tagRepo = new TagRepository();
  const outboxRepo = new OutboxRepository();
  const taxService = new TaxonomyService(taxRepo, tagRepo, outboxRepo);

  const ws = 'ws-tax-' + Date.now();

  // 1. Crear término raíz
  const root = taxService.createTerm({
    workspace_id: ws,
    name: 'Ciencias Exactas',
    color: '#00ff00'
  });
  assert.equal(root.parent_id, null);

  // 2. Intentar duplicar término raíz -> Conflicto
  assert.throws(() => {
    taxService.createTerm({
      workspace_id: ws,
      name: 'Ciencias Exactas'
    });
  }, ConflictError);

  // 3. Crear sub-término
  const sub1 = taxService.createTerm({
    workspace_id: ws,
    name: 'Física',
    parent_id: root.id
  });

  const sub2 = taxService.createTerm({
    workspace_id: ws,
    name: 'Termodinámica',
    parent_id: sub1.id
  });

  // 4. Árbol de términos
  const tree = taxService.getTermTree(ws);
  assert.equal(tree.length, 1);
  assert.equal(tree[0].name, 'Ciencias Exactas');
  assert.equal(tree[0].children[0].name, 'Física');
  assert.equal(tree[0].children[0].children[0].name, 'Termodinámica');
});

test('Phase 2: Explicit vs Inherited Taxonomy Classification', async () => {
  const { sqlite } = await import('../backend/src/db');
  const taxRepo = new TaxonomyRepository();
  const tagRepo = new TagRepository();
  const outboxRepo = new OutboxRepository();
  const taxService = new TaxonomyService(taxRepo, tagRepo, outboxRepo);

  const ws = 'ws-class-' + Date.now();
  const conceptId = 'c-tax-' + Date.now();
  const now = new Date().toISOString();

  sqlite.prepare(`
    INSERT INTO concepts (id, workspace_id, title, explanation, domain, version, created_at, updated_at)
    VALUES (?, ?, 'Nota Entropía', 'Contenido', 'd', 1, ?, ?)
  `).run(conceptId, ws, now, now);

  const termArea = taxService.createTerm({ workspace_id: ws, name: 'Termodinámica' });
  const termField = taxService.createTerm({ workspace_id: ws, name: 'Sistemas Complejos' });

  // 1. Asignar clasificación explícita
  taxService.assignTerm(conceptId, termArea.id, false);

  // 2. Asignar clasificación heredada de carpeta
  taxService.assignTerm(conceptId, termField.id, true, 'folder-123');

  // 3. Consultar clasificación
  const classification = taxService.getConceptClassification(conceptId);
  assert.equal(classification.explicit.length, 1);
  assert.equal(classification.explicit[0].id, termArea.id);
  assert.equal(classification.inherited.length, 1);
  assert.equal(classification.inherited[0].id, termField.id);
  assert.equal(classification.inherited[0].source_folder_id, 'folder-123');

  // 4. Consulta de conceptos por término
  const conceptsInTerm = taxService.listConceptsByTerm(termArea.id, ws);
  assert.ok(conceptsInTerm.includes(conceptId));

  // 5. Limpieza de clasificaciones heredadas (e.g. al mover de carpeta)
  taxRepo.clearInheritedTermsForConcept(conceptId);
  const afterClear = taxService.getConceptClassification(conceptId);
  assert.equal(afterClear.explicit.length, 1); // La explícita persiste
  assert.equal(afterClear.inherited.length, 0); // La heredada se eliminó
});

test('Phase 2: Tags M:N Association', async () => {
  const { sqlite } = await import('../backend/src/db');
  const taxRepo = new TaxonomyRepository();
  const tagRepo = new TagRepository();
  const outboxRepo = new OutboxRepository();
  const taxService = new TaxonomyService(taxRepo, tagRepo, outboxRepo);

  const ws = 'ws-tags-' + Date.now();
  const conceptId = 'c-tag-' + Date.now();
  const now = new Date().toISOString();

  // Insertar concepto primero para satisfacer la FK de concept_tags
  sqlite.prepare(`
    INSERT INTO concepts (id, workspace_id, title, explanation, domain, version, created_at, updated_at)
    VALUES (?, ?, 'Nota Tag Test', 'Contenido', 'd', 1, ?, ?)
  `).run(conceptId, ws, now, now);

  // 1. Crear Tags
  const tag1 = taxService.createTag({ workspace_id: ws, name: 'DeepTech', color: '#ff0000' });
  const tag2 = taxService.createTag({ workspace_id: ws, name: 'Experimental' });

  // Duplicado en el mismo workspace -> Conflicto
  assert.throws(() => {
    taxService.createTag({ workspace_id: ws, name: 'deeptech' });
  }, ConflictError);

  // 2. Vincular tags a concepto
  taxService.attachTag(conceptId, tag1.id);
  taxService.attachTag(conceptId, tag2.id);

  // 3. Listar tags de la nota
  const tags = taxService.listTagsForConcept(conceptId);
  assert.equal(tags.length, 2);
  assert.deepEqual(tags.map(t => t.name).sort(), ['deeptech', 'experimental']);

  // 4. Desvincular tag
  taxService.detachTag(conceptId, tag1.id);
  const remaining = taxService.listTagsForConcept(conceptId);
  assert.equal(remaining.length, 1);
  assert.equal(remaining[0].name, 'experimental');
});
