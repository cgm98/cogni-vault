import { ITaxonomyRepository, ITagRepository } from '../../domain/interfaces/taxonomy.repository.interface.js';
import { IOutboxRepository } from '../../domain/interfaces/outbox.repository.interface.js';
import { TaxonomyTerm, TaxonomyTermTreeItem, Tag, CreateTaxonomyTermDto, CreateTagDto } from '../../domain/entities/taxonomy.entity.js';
import { ValidationError, NotFoundError } from '../../domain/errors.js';

export class TaxonomyService {
  constructor(
    private readonly taxonomyRepository: ITaxonomyRepository,
    private readonly tagRepository: ITagRepository,
    private readonly outboxRepository: IOutboxRepository
  ) {}

  // --- Términos Taxonómicos ---
  createTerm(data: CreateTaxonomyTermDto): TaxonomyTerm {
    if (!data.name || data.name.trim().length === 0) {
      throw new ValidationError('El nombre del término taxonómico no puede estar vacío');
    }

    const term = this.taxonomyRepository.createTerm(data);

    this.outboxRepository.enqueue({
      job_type: 'SYNC_HIERARCHY',
      entity_type: 'taxonomy_term',
      entity_id: term.id,
      entity_version: 1,
      payload: JSON.stringify({ workspace_id: data.workspace_id, action: 'create' })
    });

    return term;
  }

  getTermTree(workspaceId: string): TaxonomyTermTreeItem[] {
    return this.taxonomyRepository.getTermTree(workspaceId);
  }

  listTerms(workspaceId: string): TaxonomyTerm[] {
    return this.taxonomyRepository.listTermsByWorkspace(workspaceId);
  }

  deleteTerm(id: string, workspaceId: string): void {
    this.taxonomyRepository.deleteTerm(id, workspaceId);
  }

  // --- Clasificación de Conceptos ---
  assignTerm(conceptId: string, termId: string, isInherited = false, sourceFolderId?: string | null): void {
    this.taxonomyRepository.assignTerm({
      concept_id: conceptId,
      term_id: termId,
      is_inherited: isInherited,
      source_folder_id: sourceFolderId ?? null
    });

    this.outboxRepository.enqueue({
      job_type: 'INDEX_FTS',
      entity_type: 'concept_taxonomy',
      entity_id: conceptId,
      entity_version: 1,
      payload: JSON.stringify({ term_id: termId, is_inherited: isInherited })
    });
  }

  removeTerm(conceptId: string, termId: string): void {
    this.taxonomyRepository.removeTerm(conceptId, termId);
  }

  getConceptClassification(conceptId: string) {
    const terms = this.taxonomyRepository.listTermsForConcept(conceptId);
    return {
      explicit: terms.filter(t => !t.is_inherited),
      inherited: terms.filter(t => t.is_inherited)
    };
  }

  listConceptsByTerm(termId: string, workspaceId: string): string[] {
    return this.taxonomyRepository.listConceptsByTerm(termId, workspaceId);
  }

  // --- Etiquetas (Tags) ---
  createTag(data: CreateTagDto): Tag {
    if (!data.name || data.name.trim().length === 0) {
      throw new ValidationError('El nombre de la etiqueta no puede estar vacío');
    }
    return this.tagRepository.createTag(data);
  }

  listTags(workspaceId: string): Tag[] {
    return this.tagRepository.listTagsByWorkspace(workspaceId);
  }

  deleteTag(id: string, workspaceId: string): void {
    this.tagRepository.deleteTag(id, workspaceId);
  }

  attachTag(conceptId: string, tagId: string): void {
    this.tagRepository.attachTag(conceptId, tagId);
  }

  detachTag(conceptId: string, tagId: string): void {
    this.tagRepository.detachTag(conceptId, tagId);
  }

  listTagsForConcept(conceptId: string): Tag[] {
    return this.tagRepository.listTagsForConcept(conceptId);
  }

  listConceptsByTag(tagId: string, workspaceId: string): string[] {
    return this.tagRepository.listConceptsByTag(tagId, workspaceId);
  }
}
