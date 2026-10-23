export const SNAPSHOT_WINDOW_MS = 1000 * 60 * 15; // 15 minutos

export interface ConceptVersion {
  id: string;
  concept_id: string;
  title: string;
  explanation: string;
  created_at: string;
  version_number?: number;
  user_id?: string;
}

export type ConceptVersionSummary = Pick<ConceptVersion, 'id' | 'concept_id' | 'created_at'> & {
  version_number?: number;
};
