import { Concept, ConceptWithMemory, ConceptSummary } from '../../domain/entities/concept.entity.js';
import { defaultDomainFor } from '../../domain/entities/domain.entity.js';
import { ConceptVersion, ConceptVersionSummary, SNAPSHOT_WINDOW_MS } from '../../domain/entities/concept-version.entity.js';
import { IConceptRepository } from '../../domain/interfaces/concept.repository.interface.js';
import { IDomainRepository } from '../../domain/interfaces/domain.repository.interface.js';
import { IConceptVersionRepository } from '../../domain/interfaces/concept-version.repository.interface.js';
import { NotFoundError } from '../../domain/errors.js';
import { eventBus } from '../../domain/events.js';
import { generateId } from '../utils.js';

export class ConceptService {
  constructor(
    private readonly conceptRepository: IConceptRepository,
    private readonly domainRepository: IDomainRepository,
    private readonly conceptVersionRepository: IConceptVersionRepository
  ) {}

  // Toda nota debe pertenecer a un dominio real: uno vacío o inexistente
  // la dejaría invisible en el árbol de archivos del cliente.
  private resolveDomain(domain: string | null | undefined, userId: string): string {
    if (domain && this.domainRepository.findById(domain, userId)) {
      return domain;
    }
    const fallback = defaultDomainFor(userId);
    if (!this.domainRepository.findById(fallback.id, userId)) {
      this.domainRepository.create(fallback);
    }
    return fallback.id;
  }

  getAll(userId: string, limit?: number, offset?: number): ConceptWithMemory[] {
    return this.conceptRepository.getAll(userId, limit, offset);
  }

  getSummaries(userId: string): ConceptSummary[] {
    return this.conceptRepository.getSummaries(userId);
  }

  getById(id: string, userId: string): ConceptWithMemory | undefined {
    return this.conceptRepository.findById(id, userId);
  }

  listByFacet(cerebroId: string, facet: import('../../domain/entities/concept.entity.js').TemporalFacet, userId: string): ConceptWithMemory[] {
    return this.conceptRepository.listByFacet(cerebroId, facet, userId);
  }

  // authorType: provenance seteada solo acá, nunca en update() — ver concept.entity.ts.
  // Default 'human' cubre scripts de import/seed, que no pasan por un token de agente.
  create(data: Partial<Concept>, userId: string, authorType: 'human' | 'agent' = 'human'): Concept {
    const id = data.id || generateId('c');
    const now = new Date().toISOString();

    const newConcept = {
      id,
      user_id: userId,
      title: data.title!,
      explanation: data.explanation!,
      intuition: data.intuition || null,
      workspace_id: data.workspace_id ?? null,
      folder_id: data.folder_id ?? null,
      domain: this.resolveDomain(data.domain, userId),
      topic_id: data.topic_id || null,
      temporal_facet: data.temporal_facet || 'PAST_MEMORY',
      facet_subtype: data.facet_subtype || null,
      strength: data.strength !== undefined ? Number(data.strength) : 0.7,
      difficulty: data.difficulty !== undefined ? Number(data.difficulty) : 3,
      status: data.status || 'active',
      created_at: now,
      updated_at: now,
      author_type: authorType
    };

    this.conceptRepository.create(newConcept);

    eventBus.emit('concept.created', {
      id: newConcept.id,
      timestamp: now,
      data: { ...newConcept, name: newConcept.title, entityType: 'concept' }
    });

    if (newConcept.status === 'active') {
      eventBus.emit('concept.consolidated', {
        id: newConcept.id,
        timestamp: now,
        data: { ...newConcept, name: newConcept.title, entityType: 'concept' }
      });
    }

    return newConcept as Concept;
  }

  update(id: string, data: Partial<Concept>, userId: string): Concept {
    const existing = this.conceptRepository.findById(id, userId);
    // Una nota en papelera es invisible para la edición: solo restore/purge.
    if (!existing || existing.deleted_at) {
      throw new NotFoundError('Concepto no encontrado');
    }

    const now = new Date().toISOString();
    const updated = {
      id,
      user_id: userId,
      title: data.title || existing.title,
      explanation: data.explanation !== undefined ? data.explanation : existing.explanation,
      intuition: data.intuition !== undefined ? data.intuition : existing.intuition,
      domain: this.resolveDomain(data.domain !== undefined ? data.domain : existing.domain, userId),
      topic_id: data.topic_id !== undefined ? data.topic_id : existing.topic_id,
      workspace_id: data.workspace_id !== undefined ? data.workspace_id : existing.workspace_id,
      folder_id: data.folder_id !== undefined ? data.folder_id : existing.folder_id,
      temporal_facet: data.temporal_facet !== undefined ? data.temporal_facet : existing.temporal_facet,
      facet_subtype: data.facet_subtype !== undefined ? data.facet_subtype : existing.facet_subtype,
      strength: data.strength !== undefined ? Number(data.strength) : existing.strength,
      difficulty: data.difficulty !== undefined ? Number(data.difficulty) : existing.difficulty,
      status: data.status || existing.status,
      updated_at: now
    };


    // Snapshot del estado PREVIO: garantiza recuperar cómo estaba la nota
    // antes de la sesión de edición. Ventana de 5 min = una versión por sesión.
    // Se compara el valor aplicado (cubre ediciones solo-título y strings vacíos).
    if (updated.explanation !== existing.explanation) {
      const last = this.conceptVersionRepository.latestCreatedAt(id);
      if (!last || Date.now() - Date.parse(last) >= SNAPSHOT_WINDOW_MS) {
        this.conceptVersionRepository.create({
          id: generateId('cv'),
          concept_id: id,
          title: existing.title,
          explanation: existing.explanation,
          created_at: now
        });
      }
    }

    this.conceptRepository.update(updated);

    eventBus.emit('concept.updated', {
      id,
      timestamp: now,
      data: { ...updated, name: updated.title, entityType: 'concept' }
    });

    if (updated.status === 'active' && existing.status !== 'active') {
      eventBus.emit('concept.consolidated', {
        id,
        timestamp: now,
        data: { ...updated, name: updated.title, entityType: 'concept' }
      });
    }

    return updated as Concept;
  }

  delete(id: string, userId: string): void {
    const existing = this.conceptRepository.findById(id, userId);
    if (!existing) {
      throw new NotFoundError('Concepto no encontrado');
    }
    if (existing.deleted_at) {
      return; // ya está en la papelera: no-op idempotente
    }

    this.conceptRepository.delete(id, userId);

    eventBus.emit('concept.deleted', {
      id,
      timestamp: new Date().toISOString(),
      data: { id, name: existing.title, entityType: 'concept' }
    });
  }

  getTrashed(userId: string): ConceptWithMemory[] {
    return this.conceptRepository.getTrashed(userId);
  }

  restore(id: string, userId: string): ConceptWithMemory {
    const existing = this.conceptRepository.findById(id, userId);
    if (!existing || !existing.deleted_at) {
      throw new NotFoundError('Concepto no encontrado en la papelera');
    }

    this.conceptRepository.restore(id, userId);

    eventBus.emit('concept.restored', {
      id,
      timestamp: new Date().toISOString(),
      data: { id, name: existing.title, entityType: 'concept' }
    });

    return this.conceptRepository.findById(id, userId)!;
  }

  // El borrado definitivo exige pasar por la papelera: nunca destruye una nota viva.
  purge(id: string, userId: string): void {
    const existing = this.conceptRepository.findById(id, userId);
    if (!existing || !existing.deleted_at) {
      throw new NotFoundError('Concepto no encontrado en la papelera');
    }

    this.conceptRepository.purge(id, userId);

    eventBus.emit('concept.purged', {
      id,
      timestamp: new Date().toISOString(),
      data: { id, name: existing.title, entityType: 'concept' }
    });
  }

  // Historial de versiones. getVersions/getVersion funcionan también para
  // notas en papelera (las versiones sobreviven al trash); solo restoreVersion
  // exige una nota viva, igual que update().
  getVersions(conceptId: string, userId: string): ConceptVersionSummary[] {
    if (!this.conceptRepository.findById(conceptId, userId)) {
      throw new NotFoundError('Concepto no encontrado');
    }
    return this.conceptVersionRepository.getForConcept(conceptId);
  }

  getVersion(conceptId: string, versionId: string, userId: string): ConceptVersion {
    if (!this.conceptRepository.findById(conceptId, userId)) {
      throw new NotFoundError('Concepto no encontrado');
    }
    const version = this.conceptVersionRepository.findById(versionId);
    if (!version || version.concept_id !== conceptId) {
      throw new NotFoundError('Versión no encontrada');
    }
    return version;
  }

  restoreVersion(conceptId: string, versionId: string, userId: string): ConceptWithMemory {
    const existing = this.conceptRepository.findById(conceptId, userId);
    if (!existing || existing.deleted_at) {
      throw new NotFoundError('Concepto no encontrado');
    }
    const version = this.conceptVersionRepository.findById(versionId);
    if (!version || version.concept_id !== conceptId) {
      throw new NotFoundError('Versión no encontrada');
    }

    const now = new Date().toISOString();

    // Snapshot forzado del estado actual (ignora la ventana): restaurar nunca pierde nada.
    this.conceptVersionRepository.create({
      id: generateId('cv'),
      concept_id: conceptId,
      title: existing.title,
      explanation: existing.explanation,
      created_at: now
    });

    // repo.update directo, NO this.update(): evita re-disparar la ventana de
    // snapshot y la normalización de dominio; drizzle ignora columnas undefined.
    this.conceptRepository.update({
      id: conceptId,
      user_id: userId,
      title: version.title,
      explanation: version.explanation,
      updated_at: now
    });

    const restored = this.conceptRepository.findById(conceptId, userId)!;

    eventBus.emit('concept.updated', {
      id: conceptId,
      timestamp: now,
      data: { ...restored, name: restored.title, entityType: 'concept' }
    });

    return restored;
  }
}
