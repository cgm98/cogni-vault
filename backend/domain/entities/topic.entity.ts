export interface Topic {
  id: string;
  user_id: string;
  domain_id: string;
  name: string;
  color?: string | null;
  description?: string | null;
  temporal_facet?: string;
  created_at?: string;
  updated_at?: string;
}
