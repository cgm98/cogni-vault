export interface Relation {
  id: string;
  from_concept_id: string;
  to_concept_id: string;
  relation_type: string;
  confidence?: number;
  source?: string;
  created_at: string;
}
