export interface Folder {
  id: string;
  workspace_id: string;
  parent_id: string | null;
  name: string;
  sort_order: number;
  version: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  trash_batch_id: string | null;
}

export interface FolderTreeItem extends Folder {
  children: FolderTreeItem[];
  concept_count: number;
}

export interface TrashBatch {
  id: string;
  workspace_id: string;
  initiated_by: string;
  item_count: number;
  created_at: string;
  restored_at: string | null;
}

export interface CreateFolderDto {
  workspace_id: string;
  name: string;
  parent_id?: string | null;
  sort_order?: number;
}

export interface UpdateFolderDto {
  name?: string;
  sort_order?: number;
}

export interface MoveFolderDto {
  target_parent_id: string | null;
  expected_version: number;
}
