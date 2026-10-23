import { eq, and } from 'drizzle-orm';
import { db } from '../../src/db.js';
import { areas } from '../../src/schemas/area.schema.js';
import { Area } from '../../domain/entities/area.entity.js';

export class AreaRepository {
  getAll(userId: string): Area[] {
    return db.select()
      .from(areas)
      .where(eq(areas.user_id, userId))
      .all() as unknown as Area[];
  }

  getByCerebro(cerebroId: string, userId: string): Area[] {
    return db.select()
      .from(areas)
      .where(and(eq(areas.cerebro_id, cerebroId), eq(areas.user_id, userId)))
      .all() as unknown as Area[];
  }

  findById(id: string, userId: string): Area | undefined {
    const res = db.select()
      .from(areas)
      .where(and(eq(areas.id, id), eq(areas.user_id, userId)))
      .get();
    return res ? (res as unknown as Area) : undefined;
  }

  create(area: Area): void {
    db.insert(areas).values({
      id: area.id,
      cerebro_id: area.cerebro_id ?? null,
      user_id: area.user_id,
      name: area.name,
      description: area.description ?? null,
      color: area.color ?? null,
      temporal_facet: area.temporal_facet ?? 'PAST_MEMORY'
    }).run();
  }

  update(area: Area): void {
    db.update(areas)
      .set({
        name: area.name,
        description: area.description ?? null,
        color: area.color ?? null,
        temporal_facet: area.temporal_facet ?? 'PAST_MEMORY'
      })
      .where(and(eq(areas.id, area.id), eq(areas.user_id, area.user_id)))
      .run();
  }

  delete(id: string, userId: string): void {
    db.delete(areas)
      .where(and(eq(areas.id, id), eq(areas.user_id, userId)))
      .run();
  }
}
