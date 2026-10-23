import { Relation } from '../../domain/entities/relation.entity.js';
import { IRelationRepository } from '../../domain/interfaces/relation.repository.interface.js';
import { IConceptRepository } from '../../domain/interfaces/concept.repository.interface.js';
import { eventBus } from '../../domain/events.js';
import { NotFoundError, ValidationError } from '../../domain/errors.js';
import { generateId } from '../utils.js';

export class RelationService {
  constructor(
    private readonly relationRepository: IRelationRepository,
    private readonly conceptRepository: IConceptRepository
  ) {}

  getAll(userId: string, limit?: number, offset?: number): Relation[] {
    return this.relationRepository.getAll(userId, limit, offset) as Relation[];
  }

  getForConcept(conceptId: string, userId: string): Relation[] {
    return this.relationRepository.getForConcept(conceptId, userId) as Relation[];
  }

  create(data: Partial<Relation>, userId: string): Relation {
    const fromConcept = this.conceptRepository.findById(data.from_concept_id!, userId);
    const toConcept = this.conceptRepository.findById(data.to_concept_id!, userId);

    if (!fromConcept || !toConcept) {
      throw new NotFoundError('Concepto origen o destino no existe');
    }

    this.assertNoCycle(data.from_concept_id!, data.to_concept_id!, data.relation_type!, userId);

    const id = data.id || generateId('r');
    const now = new Date().toISOString();
    
    const newRelation = {
      id,
      from_concept_id: data.from_concept_id!,
      to_concept_id: data.to_concept_id!,
      relation_type: data.relation_type!,
      confidence: data.confidence !== undefined ? Number(data.confidence) : 0.7,
      source: data.source || 'manual',
      created_at: now
    };

    this.relationRepository.create(newRelation);

    eventBus.emit('relation.created', {
      id: newRelation.id,
      timestamp: now,
      data: { 
        ...newRelation, 
        fromName: fromConcept.title,
        toName: toConcept.title,
        entityType: 'relation' 
      }
    });

    return newRelation as Relation;
  }

  // Ciclo solo dentro del MISMO relation_type: "depends_on" formando un ciclo es un bug
  // real (una jerarquía que debería ser DAG dejó de serlo), pero A "relates_to" B
  // "relates_to" C "relates_to" A es una red simétrica perfectamente válida. relation_type
  // es texto libre (sin enum), así que esto tiene que andar para cualquier string, no solo
  // para una lista curada de tipos "jerárquicos" conocidos.
  private assertNoCycle(fromId: string, toId: string, relationType: string, userId: string): void {
    const sameTypeEdges = this.relationRepository.getAll(userId).filter((r) => r.relation_type === relationType);
    const adjacency = new Map<string, string[]>();
    for (const e of sameTypeEdges) {
      const list = adjacency.get(e.from_concept_id) ?? [];
      list.push(e.to_concept_id);
      adjacency.set(e.from_concept_id, list);
    }

    // ¿Hay ya un camino toId -> ... -> fromId? Si sí, agregar fromId -> toId cierra el ciclo.
    const visited = new Set<string>();
    const stack = [toId];
    while (stack.length > 0) {
      const current = stack.pop()!;
      if (current === fromId) {
        throw new ValidationError(`Crear esta relación cerraría un ciclo de tipo '${relationType}' (${fromId} → ... → ${toId} → ${fromId}).`);
      }
      if (visited.has(current)) continue;
      visited.add(current);
      for (const next of adjacency.get(current) ?? []) stack.push(next);
    }
  }

  delete(id: string, userId: string): void {
    const existing = this.relationRepository.getById(id);
    if (!existing || !this.conceptRepository.findById(existing.from_concept_id, userId)) {
      throw new NotFoundError('Relación no encontrada');
    }

    this.relationRepository.delete(id);

    eventBus.emit('relation.deleted', {
      id,
      timestamp: new Date().toISOString(),
      data: { id, entityType: 'relation' }
    });
  }
}
