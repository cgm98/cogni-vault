export interface Question {
  id: string;
  concept_id: string;
  question_type: string;
  prompt: string;
  answer: string;
  difficulty?: number;
  created_at: string;
}

export interface DueQuestion {
  concept_id: string;
  concept_title: string;
  domain?: string | null;
  question_id: string;
  question_type: string;
  prompt: string;
  answer: string;
}
