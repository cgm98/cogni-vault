import { 
  TaxonomyTerm, 
  TaxonomyTermTreeItem, 
  ConceptTaxonomy, 
  Tag, 
  CreateTaxonomyTermDto, 
  AssignTaxonomyDto, 
  CreateTagDto 
} from '../entities/taxonomy.entity.js';

export interface ITaxonomyRepository {
  createTerm(data: CreateTaxonomyTermDto): TaxonomyTerm;
  findTermById(id: string, workspaceId?: string): TaxonomyTerm | undefined;
  listTermsByWorkspace(workspaceId: string): TaxonomyTerm[];
  getTermTree(workspaceId: string): TaxonomyTermTreeItem[];
  deleteTerm(id: string, workspaceId: string): void;

  assignTerm(data: AssignTaxonomyDto): void;
  removeTerm(conceptId: string, termId: string): void;
  listTermsForConcept(conceptId: string): (TaxonomyTerm & { is_inherited: boolean; source_folder_id: string | null })[];
  listConceptsByTerm(termId: string, workspaceId: string): string[];
  clearInheritedTermsForConcept(conceptId: string): void;
}

export interface ITagRepository {
  createTag(data: CreateTagDto): Tag;
  findTagByName(workspaceId: string, name: string): Tag | undefined;
  listTagsByWorkspace(workspaceId: string): Tag[];
  deleteTag(id: string, workspaceId: string): void;

  attachTag(conceptId: string, tagId: string): void;
  detachTag(conceptId: string, tagId: string): void;
  listTagsForConcept(conceptId: string): Tag[];
  listConceptsByTag(tagId: string, workspaceId: string): string[];
}
