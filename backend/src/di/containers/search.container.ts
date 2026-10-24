import { SearchRepository } from '../../../infrastructure/repositories/search.repository.js';
import { HybridEmbeddingProvider } from '../../../infrastructure/embedding/embedding.provider.js';
import { SearchIndexerService } from '../../services/search-indexer.service.js';
import { HybridSearchService } from '../../services/hybrid-search.service.js';
import { EvidenceCandidateService } from '../../services/evidence-candidate.service.js';
import { epistemicRepository } from './epistemic.container.js';
import { outboxService } from './folder.container.js';

export const searchRepository = new SearchRepository();
export const embeddingProvider = new HybridEmbeddingProvider();

export const searchIndexerService = new SearchIndexerService(
  searchRepository,
  embeddingProvider
);

// Conectar indexador a la cola asíncrona outbox
searchIndexerService.registerOutboxHandlers(outboxService);

export const hybridSearchService = new HybridSearchService(
  searchRepository,
  embeddingProvider
);

export const evidenceCandidateService = new EvidenceCandidateService(
  hybridSearchService,
  epistemicRepository
);
