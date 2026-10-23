import type { TemporalFacet } from './cerebro.types';

export interface Concept {
  id: string;
  title: string;
  explanation: string;
  intuition?: string | null;
  domain?: string | null;
  topic_id?: string | null;
  area_id?: string | null;
  cerebro_id?: string | null;
  strength?: number;
  difficulty?: number;
  status?: string;
  temporal_facet?: TemporalFacet;
  facet_subtype?: string | null;
  author_type?: string;
  retrievability?: number;
  review_count?: number;
  created_at?: string;
  updated_at?: string;
  deleted_at?: string | null;
  last_review_at?: string | null;
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
