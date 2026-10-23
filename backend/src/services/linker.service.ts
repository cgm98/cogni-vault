import { IConceptRepository } from '../../domain/interfaces/concept.repository.interface.js';
import { IRelationRepository } from '../../domain/interfaces/relation.repository.interface.js';

export interface RelationSuggestion {
  targetId: string;
  targetTitle: string;
  suggestedType: string;
  confidence: number;
  reason: string;
}

export class LinkerService {
  constructor(
    private readonly conceptRepository: IConceptRepository,
    private readonly relationRepository: IRelationRepository
  ) {}

  async getSuggestions(conceptId: string, userId: string): Promise<RelationSuggestion[]> {
    const current = this.conceptRepository.findById(conceptId, userId);
    if (!current) return [];

    const allConcepts = this.conceptRepository.getAll(userId);
    const existingRelations = this.relationRepository.getForConcept(conceptId, userId);
    const connectedIds = new Set(
      existingRelations.map(r => r.from_concept_id === conceptId ? r.to_concept_id : r.from_concept_id)
    );

    const suggestions: RelationSuggestion[] = [];

    const currentWords = this.extractKeywords(current.title + ' ' + current.explanation);

    for (const concept of allConcepts) {
      if (concept.id === conceptId || connectedIds.has(concept.id)) continue;

      let confidence = 0;
      let reason = '';
      let suggestedType = 'related_to';

      // Regla 1: Mismo dominio
      if (concept.domain === current.domain) {
        confidence += 0.3;
        reason = `Comparten el dominio "${current.domain}".`;
      }

      // Regla 2: Coincidencia de palabras clave
      const targetWords = this.extractKeywords(concept.title + ' ' + concept.explanation);
      const intersection = currentWords.filter(w => targetWords.includes(w));

      if (intersection.length > 0) {
        const wordMatchBonus = Math.min(0.5, intersection.length * 0.1);
        confidence += wordMatchBonus;
        reason += (reason ? ' Y c' : 'C') + `oinciden en palabras clave: ${intersection.slice(0, 3).join(', ')}.`;
      }

      // Regla 3: Título contenido en la explicación del otro
      if (current.explanation.toLowerCase().includes(concept.title.toLowerCase())) {
        confidence += 0.4;
        suggestedType = 'depends_on';
        reason = `El concepto "${concept.title}" es mencionado en la explicación.`;
      } else if (concept.explanation.toLowerCase().includes(current.title.toLowerCase())) {
        confidence += 0.4;
        suggestedType = 'prerequisite_of';
        reason = `Este concepto es mencionado en la explicación de "${concept.title}".`;
      }

      if (confidence > 0.45) {
        suggestions.push({
          targetId: concept.id,
          targetTitle: concept.title,
          suggestedType,
          confidence: Math.min(0.99, confidence),
          reason
        });
      }
    }

    return suggestions.sort((a, b) => b.confidence - a.confidence).slice(0, 5);
  }

  private extractKeywords(text: string): string[] {
    const stopwords = [
      'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas', 'y', 'que', 'en', 'de', 'para', 'con', 'por', 'como', 'es', 'son', 'se', 'del', 'al', 'o', 'su', 'sus'
    ];
    return text
      .toLowerCase()
      .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?\n]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 3 && !stopwords.includes(w));
  }
}
