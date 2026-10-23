import { IConceptRepository } from '../../domain/interfaces/concept.repository.interface.js';

export interface CaptureInput {
  text: string;
  domain?: string;
}

export interface CaptureResult {
  title: string;
  explanation: string;
  domain: string;
  isDuplicate: boolean;
  similarConcepts: Array<{ id: string; title: string; similarity: number }>;
}

export class CaptureService {
  constructor(private readonly conceptRepository: IConceptRepository) {}

  async process(input: CaptureInput, userId: string): Promise<CaptureResult> {
    try {
      const rawText = input.text.trim();
      const domain = input.domain || 'core';

      // Compresión conceptual: extraer título y explicación básica
      const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);
      let title = 'Nota rápida';
      let explanation = rawText;

      if (lines.length > 0) {
        // Primera línea como título si no es extremadamente larga (ej. < 60 chars)
        if (lines[0].length < 60) {
          title = lines[0].replace(/^[#-*>\s]+/, ''); // Limpiar markdown básico
          explanation = lines.slice(1).join('\n') || lines[0];
        } else {
          // Si es larga, tomar las primeras palabras para el título
          title = lines[0].split(' ').slice(0, 5).join(' ') + '...';
        }
      }

      // Buscar duplicados / conceptos similares
      const allConcepts = this.conceptRepository.getAll(userId);
      const similarConcepts: Array<{ id: string; title: string; similarity: number }> = [];
      let isDuplicate = false;

      for (const concept of allConcepts) {
        const titleSim = this.calculateSimilarity(title.toLowerCase(), concept.title.toLowerCase());
        
        // Si el título es idéntico o casi idéntico
        if (titleSim > 0.85) {
          isDuplicate = true;
        }

        if (titleSim > 0.3) {
          similarConcepts.push({
            id: concept.id,
            title: concept.title,
            similarity: Math.round(titleSim * 100) / 100
          });
        }
      }

      // Ordenar por similitud
      similarConcepts.sort((a, b) => b.similarity - a.similarity);

      return {
        title,
        explanation,
        domain,
        isDuplicate,
        similarConcepts: similarConcepts.slice(0, 5)
      };
    } catch (error) {
      console.error('Error en CaptureService.process:', error);
      throw error;
    }
  }

  private calculateSimilarity(s1: string, s2: string): number {
    const longer = s1.length > s2.length ? s1 : s2;
    const shorter = s1.length > s2.length ? s2 : s1;
    
    if (longer.length === 0) return 1.0;
    
    const distance = this.levenshtein(longer, shorter);
    return (longer.length - distance) / longer.length;
  }

  private levenshtein(a: string, b: string): number {
    const matrix = [];
    for (let i = 0; i <= b.length; i++) matrix[i] = [i];
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // sustitución
            matrix[i][j - 1] + 1,     // inserción
            matrix[i - 1][j] + 1      // eliminación
          );
        }
      }
    }
    return matrix[b.length][a.length];
  }
}
