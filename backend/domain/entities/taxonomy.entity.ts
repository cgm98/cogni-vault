export interface TaxonomyTerm {
  id: string;
  workspace_id: string;
  parent_id: string | null;
  name: string;
  color: string | null;
  description: string | null;
  created_at: string;
}

export interface TaxonomyTermTreeItem extends TaxonomyTerm {
  children: TaxonomyTermTreeItem[];
}

export interface ConceptTaxonomy {
  concept_id: string;
  term_id: string;
  is_inherited: boolean;
  source_folder_id: string | null;
  assigned_at: string;
}

export interface Tag {
  id: string;
  workspace_id: string;
  name: string;
  color: string | null;
  created_at: string;
}

export interface ConceptTag {
  concept_id: string;
  tag_id: string;
  created_at: string;
}

export interface CreateTaxonomyTermDto {
  workspace_id: string;
  name: string;
  parent_id?: string | null;
  color?: string | null;
  description?: string | null;
}

export interface AssignTaxonomyDto {
  concept_id: string;
  term_id: string;
  is_inherited?: boolean;
  source_folder_id?: string | null;
}

export interface CreateTagDto {
  workspace_id: string;
  name: string;
  color?: string | null;
}
