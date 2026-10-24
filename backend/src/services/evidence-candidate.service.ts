import { HybridSearchService } from './hybrid-search.service.js';
import { IEpistemicRepository } from '../../domain/interfaces/epistemic.repository.interface.js';
import {
  CandidateSearchOptions,
  CandidateSearchResponse,
  EvidenceCandidate,
  EvidenceOrientation
} from '../../domain/entities/search.entity.js';

export class EvidenceCandidateService {
  constructor(
    private readonly hybridSearch: HybridSearchService,
    private readonly epistemicRepo: IEpistemicRepository
  ) {}

  async findCandidates(
    workspaceId: string,
    statement: string,
    conditions?: string,
    options: CandidateSearchOptions = {}
  ): Promise<CandidateSearchResponse> {
    const threshold = options.threshold ?? 0.35; // Umbral mínimo theta_min para evitar falsos positivos
    const limit = options.limit ?? 5;

    const query = conditions ? `${statement} ${conditions}` : statement;

    // 1. Recuperación híbrida restringida a evidencias y fuentes
    const searchRes = await this.hybridSearch.search(query, workspaceId, {
      limit: limit * 2,
      alpha: 0.4, // Mayor peso semántico para alineación conceptual
      entityTypes: ['anchor', 'source']
    });

    if (searchRes.items.length === 0) {
      return {
        status: 'ABSTAIN',
        reason: 'NO_MATCH',
        threshold_applied: threshold,
        statement,
        candidates: []
      };
    }

    // 2. Aplicar Invariante de Abstención: si el candidato top está por debajo del umbral theta_min
    const topScore = searchRes.items[0].hybrid_score;
    if (topScore < threshold) {
      return {
        status: 'ABSTAIN',
        reason: 'INSUFFICIENT_EVIDENCE',
        threshold_applied: threshold,
        statement,
        candidates: []
      };
    }

    // 3. Formatear y calificar candidatos calificados
    const candidates: EvidenceCandidate[] = [];

    for (const item of searchRes.items) {
      if (item.hybrid_score < threshold) continue;

      let anchorId = item.entity_id;
      let sourceId = '';
      let sourceTitle = item.title;
      let exactQuote = item.snippet;

      if (item.entity_type === 'anchor') {
        const anchor = this.epistemicRepo.findAnchorById(item.entity_id);
        if (anchor) {
          sourceId = anchor.source_id;
          exactQuote = anchor.exact_quote;
          const src = this.epistemicRepo.findSourceById(anchor.source_id);
          if (src) sourceTitle = src.title;
        }
      } else if (item.entity_type === 'source') {
        sourceId = item.entity_id;
        const anchors = this.epistemicRepo.listAnchorsBySource(sourceId);
        if (anchors.length > 0) {
          anchorId = anchors[0].id;
          exactQuote = anchors[0].exact_quote;
        } else {
          continue; // Fuente sin anclas específicas no puede servir de ancla directa
        }
      }

      // Evaluación heurística de orientación preliminar (SUPPORTS vs REFUTES)
      const orientation = this.evaluateProvisionalOrientation(statement, exactQuote);

      candidates.push({
        anchor_id: anchorId,
        source_id: sourceId,
        source_title: sourceTitle,
        exact_quote: exactQuote,
        confidence_score: item.hybrid_score,
        potential_relation: orientation,
        candidate_only: true
      });

      if (candidates.length >= limit) break;
    }

    if (candidates.length === 0) {
      return {
        status: 'ABSTAIN',
        reason: 'INSUFFICIENT_EVIDENCE',
        threshold_applied: threshold,
        statement,
        candidates: []
      };
    }

    return {
      status: 'CANDIDATES_FOUND',
      threshold_applied: threshold,
      statement,
      candidates
    };
  }

  private evaluateProvisionalOrientation(statement: string, quote: string): EvidenceOrientation {
    const quoteLower = quote.toLowerCase();
    const refutationTriggers = [
      ' no ', 'nunca', 'falso', 'refuta', 'discrepa', 'incompatible',
      'aislante', 'no conduce', 'desmiente', 'contrario a', 'sin evidencia'
    ];

    const hasRefutation = refutationTriggers.some(t => quoteLower.includes(t));
    if (hasRefutation) {
      return 'REFUTES';
    }

    return 'SUPPORTS';
  }
}
