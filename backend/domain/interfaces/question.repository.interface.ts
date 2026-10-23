import { Question } from '../entities/question.entity.js';

export interface IQuestionRepository {
  deleteAutomaticQuestions(conceptId: string): void;
  createMany(questions: Question[]): void;
  getForConcept(conceptId: string, userId: string): Question[];
}
