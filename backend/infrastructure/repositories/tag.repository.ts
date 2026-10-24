import crypto from 'crypto';
import { sqlite } from '../../src/db.js';
import { ITagRepository } from '../../domain/interfaces/taxonomy.repository.interface.js';
import { Tag, CreateTagDto } from '../../domain/entities/taxonomy.entity.js';
import { ConflictError, NotFoundError } from '../../domain/errors.js';

export class TagRepository implements ITagRepository {
  createTag(data: CreateTagDto): Tag {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    try {
      sqlite.prepare(`
        INSERT INTO tags (id, workspace_id, name, color, created_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(id, data.workspace_id, data.name.trim().toLowerCase(), data.color ?? null, now);
    } catch (err: any) {
      if (err.message && err.message.includes('UNIQUE constraint failed')) {
        throw new ConflictError(`La etiqueta "${data.name.trim().toLowerCase()}" ya existe en este workspace`);
      }
      throw err;
    }

    return this.findTagByName(data.workspace_id, data.name.trim().toLowerCase())!;
  }

  findTagByName(workspaceId: string, name: string): Tag | undefined {
    return sqlite.prepare(`
      SELECT * FROM tags WHERE workspace_id = ? AND name = ?
    `).get(workspaceId, name.trim().toLowerCase()) as Tag | undefined;
  }

  listTagsByWorkspace(workspaceId: string): Tag[] {
    return sqlite.prepare(`
      SELECT * FROM tags WHERE workspace_id = ? ORDER BY name ASC
    `).all(workspaceId) as Tag[];
  }

  deleteTag(id: string, workspaceId: string): void {
    const res = sqlite.prepare(`
      DELETE FROM tags WHERE id = ? AND workspace_id = ?
    `).run(id, workspaceId);
    if (res.changes === 0) throw new NotFoundError('Etiqueta no encontrada');
  }

  attachTag(conceptId: string, tagId: string): void {
    const now = new Date().toISOString();
    sqlite.prepare(`
      INSERT OR IGNORE INTO concept_tags (concept_id, tag_id, created_at)
      VALUES (?, ?, ?)
    `).run(conceptId, tagId, now);
  }

  detachTag(conceptId: string, tagId: string): void {
    sqlite.prepare(`
      DELETE FROM concept_tags WHERE concept_id = ? AND tag_id = ?
    `).run(conceptId, tagId);
  }

  listTagsForConcept(conceptId: string): Tag[] {
    return sqlite.prepare(`
      SELECT t.* FROM tags t
      JOIN concept_tags ct ON t.id = ct.tag_id
      WHERE ct.concept_id = ?
      ORDER BY t.name ASC
    `).all(conceptId) as Tag[];
  }

  listConceptsByTag(tagId: string, workspaceId: string): string[] {
    const rows = sqlite.prepare(`
      SELECT c.id FROM concepts c
      JOIN concept_tags ct ON c.id = ct.concept_id
      WHERE ct.tag_id = ? AND c.workspace_id = ? AND c.deleted_at IS NULL
    `).all(tagId, workspaceId) as { id: string }[];

    return rows.map(r => r.id);
  }
}
