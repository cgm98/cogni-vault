import { Question, DueQuestion } from '../../domain/entities/question.entity.js';
import { IQuestionRepository } from '../../domain/interfaces/question.repository.interface.js';
import { IConceptRepository } from '../../domain/interfaces/concept.repository.interface.js';
import { IRelationRepository } from '../../domain/interfaces/relation.repository.interface.js';
import { IReviewRepository } from '../../domain/interfaces/review.repository.interface.js';
import { generateId } from '../utils.js';

export class QuestionEngine {
  constructor(
    private readonly questionRepository: IQuestionRepository,
    private readonly conceptRepository: IConceptRepository,
    private readonly relationRepository: IRelationRepository,
    private readonly reviewRepository: IReviewRepository
  ) {}

  generateForConcept(conceptId: string, userId: string): Question[] {
    const concept = this.conceptRepository.findById(conceptId, userId);
    if (!concept) return [];

    // Borrar preguntas existentes previas automáticas
    this.questionRepository.deleteAutomaticQuestions(conceptId);

    const relationsList = this.relationRepository.getForConcept(conceptId, userId);
    const now = new Date().toISOString();
    const generated: Question[] = [];

    // Plantilla 1: Definición
    generated.push({
      id: generateId('q'),
      concept_id: conceptId,
      question_type: 'definition',
      prompt: `¿Cómo definirías el concepto "${concept.title}" en el dominio "${concept.domain}"?`,
      answer: concept.explanation,
      difficulty: concept.difficulty || 3,
      created_at: now
    });

    // Plantilla 2: Intuición (si existe)
    if (concept.intuition) {
      generated.push({
        id: generateId('q'),
        concept_id: conceptId,
        question_type: 'intuition',
        prompt: `¿Cuál es la intuición o analogía clave detrás de "${concept.title}"?`,
        answer: concept.intuition,
        difficulty: Math.max(1, (concept.difficulty || 3) - 1),
        created_at: now
      });
    }

    // Plantilla 3: Relaciones Semánticas
    for (const rel of relationsList) {
      const targetConcept = this.conceptRepository.findById(rel.to_concept_id, userId);
      const targetTitle = targetConcept ? targetConcept.title : 'concepto relacionado';

      let prompt = '';
      let answer = '';

      if (rel.relation_type === 'prerequisite_of') {
        prompt = `¿Por qué "${concept.title}" es un prerrequisito para comprender "${targetTitle}"?`;
        answer = `Porque "${concept.title}" provee las bases conceptuales necesarias que estructuran a "${targetTitle}".`;
      } else if (rel.relation_type === 'depends_on') {
        prompt = `¿De qué manera "${concept.title}" depende del concepto "${targetTitle}"?`;
        answer = `Depende porque requiere comprender e implementar los principios de "${targetTitle}" para funcionar correctamente.`;
      } else if (rel.relation_type === 'contradicts') {
        prompt = `¿Cuál es la contradicción o diferencia clave entre "${concept.title}" y "${targetTitle}"?`;
        answer = `Ambos conceptos se contraponen directamente en su lógica de aplicación o principios fundamentales.`;
      } else {
        prompt = `¿Cómo describirías la relación "${rel.relation_type}" entre "${concept.title}" y "${targetTitle}"?`;
        answer = `Están relacionados semánticamente a nivel de arquitectura y dependencias conceptuales.`;
      }

      generated.push({
        id: generateId('q'),
        concept_id: conceptId,
        question_type: 'relation',
        prompt,
        answer,
        difficulty: Math.min(5, (concept.difficulty || 3) + 1),
        created_at: now
      });
    }

    // Insertar preguntas generadas en bloque usando el repositorio
    if (generated.length > 0) {
      this.questionRepository.createMany(generated);
    }

    return generated;
  }

  getQuestionsForConcept(conceptId: string, userId: string): Question[] {
    return this.questionRepository.getForConcept(conceptId, userId);
  }

  getQuestionsForDueQueue(userId: string): DueQuestion[] {
    const dueConcepts = this.reviewRepository.getDueQueue(userId);
    const result: DueQuestion[] = [];

    for (const concept of dueConcepts) {
      let qs = this.questionRepository.getForConcept(concept.id, userId);
      if (qs.length === 0) {
        qs = this.generateForConcept(concept.id, userId);
      }

      if (qs.length > 0) {
        const randomQ = qs[Math.floor(Math.random() * qs.length)];
        result.push({
          concept_id: concept.id,
          concept_title: concept.title,
          domain: concept.domain,
          question_id: randomQ.id,
          question_type: randomQ.question_type,
          prompt: randomQ.prompt,
          answer: randomQ.answer
        });
      }
    }

    return result;
  }
}
