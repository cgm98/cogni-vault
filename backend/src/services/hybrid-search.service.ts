import { ISearchRepository } from '../../domain/interfaces/search.repository.interface.js';
import { IEmbeddingProvider } from '../../domain/interfaces/embedding-provider.interface.js';
import {
  HybridSearchResponse,
  SearchOptions,
  SearchResultItem,
  SearchEntityType
} from '../../domain/entities/search.entity.js';

export class HybridSearchService {
  constructor(
    private readonly searchRepo: ISearchRepository,
    private readonly embeddingProvider: IEmbeddingProvider
  ) {}

  async search(
    query: string,
    workspaceId: string,
    options: SearchOptions = {}
  ): Promise<HybridSearchResponse> {
    const limit = Math.max(1, Math.min(options.limit ?? 20, 100));
    const alpha = Math.max(0.0, Math.min(options.alpha ?? 0.5, 1.0)); // 0.0 = solo vector, 1.0 = solo FTS
    const candidateLimit = Math.min(limit * 3, 100);

    if (!query || query.trim().length === 0) {
      return { query, workspace_id: workspaceId, total_results: 0, items: [] };
    }

    // 1. Canal Léxico (FTS5 BM25)
    const ftsMatches = this.searchRepo.queryFts(
      query,
      workspaceId,
      candidateLimit,
      options.entityTypes
    );

    // Mapa de rangos léxicos (1-indexed)
    const lexicalRanks = new Map<string, { rank: number; bm25: number; item: any }>();
    ftsMatches.forEach((match, idx) => {
      lexicalRanks.set(match.entity_id, {
        rank: idx + 1,
        bm25: match.bm25_rank,
        item: match
      });
    });

    // 2. Canal Vectorial (sqlite-vec KNN Cosine)
    const queryVector = await this.embeddingProvider.embed(query);
    const knnMatches = this.searchRepo.queryKnn(queryVector, candidateLimit);

    // Filtrar candidatos vectoriales por workspace y entity_type
    const vectorRanks = new Map<string, { rank: number; distance: number; payload: any }>();
    let vecRankCounter = 1;

    for (const knn of knnMatches) {
      // Reutilizar payload de FTS si ya existe, de lo contrario consultar repository
      const cached = lexicalRanks.get(knn.entity_id);
      const payload = cached ? cached.item : this.searchRepo.getEntityPayload(knn.entity_id);

      if (payload && payload.workspace_id === workspaceId) {
        if (!options.entityTypes || options.entityTypes.includes(payload.entity_type as SearchEntityType)) {
          vectorRanks.set(knn.entity_id, {
            rank: vecRankCounter++,
            distance: knn.distance,
            payload
          });
        }
      }
    }

    // 3. Fusión RRF (Reciprocal Rank Fusion con k = 60)
    const k = 60;
    const allEntityIds = new Set<string>([...lexicalRanks.keys(), ...vectorRanks.keys()]);
    const scoredItems: SearchResultItem[] = [];

    for (const entityId of allEntityIds) {
      const lexInfo = lexicalRanks.get(entityId);
      const vecInfo = vectorRanks.get(entityId);

      const payload = lexInfo?.item || vecInfo?.payload;
      if (!payload) continue;

      const rLex = lexInfo ? lexInfo.rank : Infinity;
      const rVec = vecInfo ? vecInfo.rank : Infinity;

      // Canal Léxico ponderado por orden de ranking
      const rrfLex = rLex !== Infinity ? alpha / (k + rLex) : 0;
      
      // Canal Vectorial ponderado por similitud de coseno real (1 - distance) para no asignar puntaje alto a items no afines
      const simVec = vecInfo ? Math.max(0.0, 1.0 - vecInfo.distance) : 0;
      const rrfVec = rVec !== Infinity ? ((1 - alpha) * simVec) / (k + rVec) : 0;
      
      const rrfTotal = rrfLex + rrfVec;

      // Normalización a escala [0, 1] multiplicando por (k + 1)
      const hybridScore = Math.min(1.0, rrfTotal * (k + 1));

      scoredItems.push({
        entity_id: entityId,
        entity_type: payload.entity_type,
        workspace_id: payload.workspace_id,
        title: payload.title,
        snippet: this.generateSnippet(payload.content, query),
        lexical_rank: lexInfo ? lexInfo.rank : undefined,
        vector_distance: vecInfo ? vecInfo.distance : undefined,
        hybrid_score: Math.round(hybridScore * 10000) / 10000
      });
    }

    // 4. Ordenar descendentemente por score híbrido
    scoredItems.sort((a, b) => b.hybrid_score - a.hybrid_score);
    const finalItems = scoredItems.slice(0, limit);

    return {
      query,
      workspace_id: workspaceId,
      total_results: finalItems.length,
      items: finalItems
    };
  }

  private generateSnippet(content: string, query: string, maxLength = 160): string {
    if (!content) return '';
    const cleanContent = content.replace(/\s+/g, ' ').trim();
    if (cleanContent.length <= maxLength) return cleanContent;

    const lowerContent = cleanContent.toLowerCase();
    const queryTokens = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);

    let matchIdx = -1;
    for (const token of queryTokens) {
      const idx = lowerContent.indexOf(token);
      if (idx !== -1) {
        matchIdx = idx;
        break;
      }
    }

    if (matchIdx === -1) {
      return cleanContent.slice(0, maxLength) + '...';
    }

    const start = Math.max(0, matchIdx - 40);
    const end = Math.min(cleanContent.length, start + maxLength);
    const prefix = start > 0 ? '...' : '';
    const suffix = end < cleanContent.length ? '...' : '';

    return `${prefix}${cleanContent.slice(start, end)}${suffix}`;
  }
}
