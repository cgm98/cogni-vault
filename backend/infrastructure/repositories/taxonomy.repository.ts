import crypto from 'crypto';
import { sqlite } from '../../src/db.js';
import { ITaxonomyRepository } from '../../domain/interfaces/taxonomy.repository.interface.js';
import { 
  TaxonomyTerm, 
  TaxonomyTermTreeItem, 
  CreateTaxonomyTermDto, 
  AssignTaxonomyDto 
} from '../../domain/entities/taxonomy.entity.js';
import { ValidationError, ConflictError, NotFoundError } from '../../domain/errors.js';

export class TaxonomyRepository implements ITaxonomyRepository {
  createTerm(data: CreateTaxonomyTermDto): TaxonomyTerm {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    if (data.parent_id) {
      const parent = this.findTermById(data.parent_id, data.workspace_id);
      if (!parent) {
        throw new ValidationError('El término padre no existe en este workspace');
      }
    }

    try {
      sqlite.prepare(`
        INSERT INTO taxonomy_terms (id, workspace_id, parent_id, name, color, description, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        data.workspace_id,
        data.parent_id ?? null,
        data.name.trim(),
        data.color ?? null,
        data.description ?? null,
        now
      );
    } catch (err: any) {
      if (err.message && err.message.includes('UNIQUE constraint failed')) {
        throw new ConflictError(`Ya existe un término con el nombre "${data.name.trim()}" en este nivel`);
      }
      throw err;
    }

    return this.findTermById(id, data.workspace_id)!;
  }

  findTermById(id: string, workspaceId?: string): TaxonomyTerm | undefined {
    if (workspaceId) {
      return sqlite.prepare(`
        SELECT * FROM taxonomy_terms WHERE id = ? AND workspace_id = ?
      `).get(id, workspaceId) as TaxonomyTerm | undefined;
    }
    return sqlite.prepare(`
      SELECT * FROM taxonomy_terms WHERE id = ?
    `).get(id) as TaxonomyTerm | undefined;
  }

  listTermsByWorkspace(workspaceId: string): TaxonomyTerm[] {
    return sqlite.prepare(`
      SELECT * FROM taxonomy_terms WHERE workspace_id = ? ORDER BY name ASC
    `).all(workspaceId) as TaxonomyTerm[];
  }

  getTermTree(workspaceId: string): TaxonomyTermTreeItem[] {
    const allTerms = this.listTermsByWorkspace(workspaceId);
    if (allTerms.length === 0) return [];

    const map = new Map<string, TaxonomyTermTreeItem>();
    for (const t of allTerms) {
      map.set(t.id, { ...t, children: [] });
    }

    const roots: TaxonomyTermTreeItem[] = [];

    for (const t of allTerms) {
      const current = map.get(t.id)!;
      if (t.parent_id && map.has(t.parent_id)) {
        map.get(t.parent_id)!.children.push(current);
      } else {
        roots.push(current);
      }
    }

    return roots;
  }

  deleteTerm(id: string, workspaceId: string): void {
    const term = this.findTermById(id, workspaceId);
    if (!term) throw new NotFoundError('Término taxonómico no encontrado');

    sqlite.prepare(`
      DELETE FROM taxonomy_terms WHERE id = ? AND workspace_id = ?
    `).run(id, workspaceId);
  }

  assignTerm(data: AssignTaxonomyDto): void {
    const now = new Date().toISOString();
    sqlite.prepare(`
      INSERT INTO concept_taxonomy (concept_id, term_id, is_inherited, source_folder_id, assigned_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(concept_id, term_id) DO UPDATE SET
        is_inherited = excluded.is_inherited,
        source_folder_id = excluded.source_folder_id,
        assigned_at = excluded.assigned_at
    `).run(
      data.concept_id,
      data.term_id,
      data.is_inherited ? 1 : 0,
      data.source_folder_id ?? null,
      now
    );
  }

  removeTerm(conceptId: string, termId: string): void {
    sqlite.prepare(`
      DELETE FROM concept_taxonomy WHERE concept_id = ? AND term_id = ?
    `).run(conceptId, termId);
  }

  listTermsForConcept(conceptId: string): (TaxonomyTerm & { is_inherited: boolean; source_folder_id: string | null })[] {
    return sqlite.prepare(`
      SELECT t.*, ct.is_inherited, ct.source_folder_id
      FROM concept_taxonomy ct
      JOIN taxonomy_terms t ON ct.term_id = t.id
      WHERE ct.concept_id = ?
      ORDER BY ct.is_inherited ASC, t.name ASC
    `).all(conceptId).map((row: any) => ({
      ...row,
      is_inherited: Boolean(row.is_inherited)
    }));
  }

  listConceptsByTerm(termId: string, workspaceId: string): string[] {
    // Retorna conceptos que tienen asignado este término o cualquiera de sus sub-términos
    const rows = sqlite.prepare(`
      WITH RECURSIVE term_hierarchy AS (
        SELECT id FROM taxonomy_terms WHERE id = ? AND workspace_id = ?
        UNION ALL
        SELECT t.id FROM taxonomy_terms t JOIN term_hierarchy h ON t.parent_id = h.id
      )
      SELECT DISTINCT c.id
      FROM concepts c
      JOIN concept_taxonomy ct ON c.id = ct.concept_id
      JOIN term_hierarchy th ON ct.term_id = th.id
      WHERE c.workspace_id = ? AND c.deleted_at IS NULL
    `).all(termId, workspaceId, workspaceId) as { id: string }[];

    return rows.map(r => r.id);
  }

  clearInheritedTermsForConcept(conceptId: string): void {
    sqlite.prepare(`
      DELETE FROM concept_taxonomy WHERE concept_id = ? AND is_inherited = 1
    `).run(conceptId);
  }
}
