export interface Area {
  id: string;
  cerebro_id?: string | null;
  user_id: string;
  name: string;
  color?: string | null;
  description?: string | null;
  temporal_facet?: string;
  created_at?: string;
  updated_at?: string;
}
