export interface FileItem {
  id: string;
  name: string;
  path?: string;
  isFolder?: boolean;
  folderId?: string | null;
  content?: string;
  createdAt?: number;
  updatedAt?: number;
  temporal_facet?: string;
  conceptId?: string;
  domainId?: string;
  workspaceId?: string | null;
}

export interface FolderItem {
  kind?: 'workspace' | 'folder' | 'area' | 'domain' | 'topic';
  id: string;
  name: string;
  path?: string;
  parentId?: string | null;
  icon?: string;
  children?: (FileItem | FolderItem)[];
  temporal_facet?: string;
  facetCount?: number;
  totalCount?: number;
  dimmed?: boolean;
}

export interface TabItem {
  id: string;
  fileId?: string;
  title?: string;
  conceptId?: string;
  mode?: string;
  isDirty?: boolean;
}

export type SaveStatus = 'saved' | 'saving' | 'dirty' | 'error';
