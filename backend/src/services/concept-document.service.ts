import { sqlite } from '../db.js';
import { IOutboxRepository } from '../../domain/interfaces/outbox.repository.interface.js';
import { CanonicalDocumentAst } from '../../domain/ast/canonical-ast.types.js';
import { markdownToCanonicalAst, canonicalAstToMarkdown } from '../../domain/ast/markdown-transpiler.js';
import { NotFoundError, ConflictError, ValidationError } from '../../domain/errors.js';

export class ConceptDocumentService {
  constructor(private readonly outboxRepository: IOutboxRepository) {}

  getDocument(conceptId: string): { ast: CanonicalDocumentAst; markdown: string; version: number } {
    const row = sqlite.prepare(`
      SELECT id, title, explanation, doc_ast, version, schema_version
      FROM concepts
      WHERE id = ? AND deleted_at IS NULL
    `).get(conceptId) as { id: string; title: string; explanation: string; doc_ast: string | null; version: number; schema_version: number } | undefined;

    if (!row) throw new NotFoundError('Nota no encontrada');

    let ast: CanonicalDocumentAst;
    if (row.doc_ast) {
      try {
        ast = JSON.parse(row.doc_ast);
      } catch {
        ast = markdownToCanonicalAst(row.explanation);
      }
    } else {
      ast = markdownToCanonicalAst(row.explanation);
      // Persistir el AST generado perezosamente
      sqlite.prepare(`
        UPDATE concepts SET doc_ast = ? WHERE id = ?
      `).run(JSON.stringify(ast), conceptId);
    }

    return {
      ast,
      markdown: row.explanation,
      version: row.version
    };
  }

  updateDocument(conceptId: string, ast: CanonicalDocumentAst, expectedVersion: number): { ast: CanonicalDocumentAst; markdown: string; version: number } {
    if (!ast || !ast.content) {
      throw new ValidationError('El documento AST no tiene un formato válido');
    }
    if (ast.schema_version !== 1) {
      throw new ValidationError(`schema_version no soportada: ${ast.schema_version}`);
    }

    const now = new Date().toISOString();
    const markdown = canonicalAstToMarkdown(ast);
    const serializedAst = JSON.stringify(ast);

    const result = sqlite.prepare(`
      UPDATE concepts
      SET doc_ast = ?, explanation = ?, version = version + 1, updated_at = ?
      WHERE id = ? AND version = ? AND deleted_at IS NULL
    `).run(serializedAst, markdown, now, conceptId, expectedVersion);

    if (result.changes === 0) {
      const existing = sqlite.prepare(`SELECT version FROM concepts WHERE id = ?`).get(conceptId) as { version: number } | undefined;
      if (!existing) throw new NotFoundError('Nota no encontrada');
      throw new ConflictError(
        `Conflicto de concurrencia (OCC) al actualizar nota: versión esperada ${expectedVersion}, actual ${existing.version}`
      );
    }

    const newVersion = expectedVersion + 1;

    // Encolar trabajos de indexación FTS y vectores
    this.outboxRepository.enqueue({
      job_type: 'INDEX_FTS',
      entity_type: 'concept',
      entity_id: conceptId,
      entity_version: newVersion,
      payload: JSON.stringify({ length: markdown.length })
    });

    this.outboxRepository.enqueue({
      job_type: 'EMBEDDING_VEC',
      entity_type: 'concept',
      entity_id: conceptId,
      entity_version: newVersion
    });

    return {
      ast,
      markdown,
      version: newVersion
    };
  }
}
