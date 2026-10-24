export interface Folder {
  id: string;
  workspace_id: string;
  parent_id: string | null;
  name: string;
  sort_order: number;
  version: number;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
  trash_batch_id?: string | null;
}

export interface FolderConceptSummary {
  id: string;
  title: string;
  version: number;
}

export interface FolderTreeNode extends Folder {
  id: string;
  name: string;
  sort_order: number;
  version: number;
  children: FolderTreeNode[];
  concepts: FolderConceptSummary[];
}

export interface FolderTreeResponse {
  workspace_id: string;
  folders: FolderTreeNode[];
  root_concepts: FolderConceptSummary[];
}

export interface MoveFolderPayload {
  target_parent_id: string | null;
  expected_version: number;
}

export interface TrashBatchPayload {
  folder_ids?: string[];
  concept_ids?: string[];
}
