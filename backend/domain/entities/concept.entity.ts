export type TemporalFacet = 'PAST_MEMORY' | 'PRESENT_DISCERNMENT' | 'FUTURE_PROVIDENCE';

export interface Concept {
  id: string;
  cerebro_id?: string | null;
  domain?: string | null;
  area_id?: string | null;
  topic_id?: string | null;
  title: string;
  explanation: string;
  intuition?: string | null;
  code_snippet?: string | null;
  strength?: number;
  difficulty?: number;
  status?: string;
  temporal_facet?: TemporalFacet;
  facet_subtype?: string | null;
  author_type?: string;
  deleted_at?: string | null;
  is_trashed?: boolean;
  trashed_at?: string | null;
  user_id: string;
  created_at?: string;
  updated_at: string;
}

export interface ConceptWithMemory extends Concept {
  memory_score?: number;
  last_reviewed_at?: string | null;
  stability?: number;
  difficulty_score?: number;
  reps?: number;
  lapses?: number;
}

export interface ConceptSummary {
  id: string;
  title: string;
  domain: string | null;
  topic_id?: string | null;
  created_at?: string;
  temporal_facet?: TemporalFacet;
  updated_at: string;
}
