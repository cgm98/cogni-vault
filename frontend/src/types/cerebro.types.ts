export type TemporalFacet = 'PAST_MEMORY' | 'PRESENT_DISCERNMENT' | 'FUTURE_PROVIDENCE' | string;

export interface Cerebro {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  icon?: string;
  color?: string;
  user_id?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Area {
  id: string;
  cerebro_id?: string | null;
  name: string;
  description?: string | null;
  color?: string | null;
  temporal_facet?: TemporalFacet;
}

export interface Domain {
  id: string;
  name: string;
  color: string;
  description?: string | null;
  area_id?: string | null;
  temporal_facet?: TemporalFacet;
}

export interface Topic {
  id: string;
  domain_id: string;
  name: string;
  description?: string | null;
  color?: string | null;
  temporal_facet?: TemporalFacet;
}
