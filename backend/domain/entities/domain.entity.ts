export interface Domain {
  id: string;
  cerebro_id?: string | null;
  area_id?: string | null;
  name: string;
  slug?: string;
  color?: string | null;
  description?: string | null;
  temporal_facet?: string;
  user_id: string;
  created_at?: string;
  updated_at?: string;
}

export function defaultDomainFor(userId: string): Domain {
  const now = new Date().toISOString();
  return {
    id: `dom_unclassified_${userId}`,
    name: 'Sin clasificar',
    slug: 'sin-clasificar',
    color: '#6b7280',
    description: 'Dominio por defecto para conceptos sin asignar',
    user_id: userId,
    created_at: now,
    updated_at: now
  };
}
