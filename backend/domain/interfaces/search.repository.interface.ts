import {
  FtsIndexEntry,
  IndexMetadataEntry,
  SearchEntityType
} from '../entities/search.entity.js';

export interface FtsMatchRecord {
  entity_id: string;
  entity_type: SearchEntityType;
  workspace_id: string;
  title: string;
  content: string;
  bm25_rank: number;
}

export interface KnnMatchRecord {
  entity_id: string;
  distance: number;
}

export interface ISearchRepository {
  upsertFts(entry: FtsIndexEntry): void;
  deleteFts(entityId: string): void;

  upsertVector(entityId: string, embedding: Float32Array): void;
  deleteVector(entityId: string): void;

  queryFts(query: string, workspaceId: string, limit: number, entityTypes?: SearchEntityType[]): FtsMatchRecord[];
  queryKnn(embedding: Float32Array, limit: number): KnnMatchRecord[];

  getMetadata(entityId: string): IndexMetadataEntry | null;
  upsertMetadata(entry: IndexMetadataEntry): void;
  deleteMetadata(entityId: string): void;

  getEntityPayload(entityId: string): {
    entity_id: string;
    entity_type: SearchEntityType;
    workspace_id: string;
    title: string;
    content: string;
  } | null;
}
