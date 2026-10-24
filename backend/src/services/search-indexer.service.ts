import crypto from 'crypto';
import { ISearchRepository } from '../../domain/interfaces/search.repository.interface.js';
import { IEmbeddingProvider } from '../../domain/interfaces/embedding-provider.interface.js';
import { OutboxService } from './outbox.service.js';
import { SearchEntityType } from '../../domain/entities/search.entity.js';

export class SearchIndexerService {
  constructor(
    private readonly searchRepo: ISearchRepository,
    private readonly embeddingProvider: IEmbeddingProvider
  ) {}

  registerOutboxHandlers(outboxService: OutboxService): void {
    outboxService.registerHandler('INDEX_FTS', async (job) => {
      await this.indexEntity(job.entity_type as SearchEntityType, job.entity_id, job.entity_version);
    });

    outboxService.registerHandler('EMBEDDING_VEC', async (job) => {
      await this.indexEntity(job.entity_type as SearchEntityType, job.entity_id, job.entity_version);
    });
  }

  async indexEntity(entityType: SearchEntityType, entityId: string, version = 1): Promise<boolean> {
    const payload = this.searchRepo.getEntityPayload(entityId);
    if (!payload) {
      // Si la entidad fue eliminada o no existe, limpiamos sus entradas en los índices
      this.deleteEntity(entityId);
      return false;
    }

    const fullText = `${payload.title}\n${payload.content}`.trim();
    const contentHash = crypto.createHash('sha256').update(fullText).digest('hex');

    // 1. Indexación Léxica en FTS5
    this.searchRepo.upsertFts({
      entity_id: payload.entity_id,
      entity_type: payload.entity_type,
      workspace_id: payload.workspace_id,
      title: payload.title,
      content: payload.content
    });

    // 2. Generación e Indexación de Vector Semántico (768 dim)
    const embedding = await this.embeddingProvider.embed(fullText);
    this.searchRepo.upsertVector(payload.entity_id, embedding);

    // 3. Registro de Metadatos de Sincronización
    const now = new Date().toISOString();
    this.searchRepo.upsertMetadata({
      entity_id: payload.entity_id,
      entity_type: payload.entity_type,
      workspace_id: payload.workspace_id,
      version,
      fts_indexed_at: now,
      vec_indexed_at: now,
      content_hash: contentHash
    });

    return true;
  }

  deleteEntity(entityId: string): void {
    this.searchRepo.deleteFts(entityId);
    this.searchRepo.deleteVector(entityId);
    this.searchRepo.deleteMetadata(entityId);
  }
}
