export interface Cerebro {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  icon?: string | null;
  color?: string | null;
  user_id: string;
  created_at: string;
  updated_at: string;
}

export interface CerebroKnowledgeTree {
  id: string;
  name: string;
  areas: any[];
  domains: any[];
  topics: any[];
  concepts: any[];
}
