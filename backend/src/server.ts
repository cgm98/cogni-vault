import express from 'express';
import { authMiddleware } from './http/middlewares/auth.middleware.js';
import { errorHandler } from './http/middlewares/error-handler.js';

import { CerebroController } from './controllers/cerebro.controller.js';
import { AreaController } from './controllers/area.controller.js';
import { DomainController } from './controllers/domain.controller.js';
import { TopicController } from './controllers/topic.controller.js';
import { ConceptController } from './controllers/concept.controller.js';
import { AnalyticsController } from './controllers/analytics.controller.js';
import { ExportController } from './controllers/export.controller.js';
import { ImportController } from './controllers/import.controller.js';
import { ImageController } from './controllers/image.controller.js';
import { FolderController } from './controllers/folder.controller.js';
import { TaxonomyController } from './controllers/taxonomy.controller.js';
import { EpistemicController } from './controllers/epistemic.controller.js';
import { SearchController } from './controllers/search.controller.js';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.raw({ type: 'application/zip', limit: '100mb' }));
app.use(express.raw({ type: 'image/*', limit: '10mb' }));

// Auth guard global
app.use(authMiddleware);

// Rutas Carpetas (Árbol N-Niveles, Mover, Papelera y Restauración)
app.post('/api/folders/migrate-legacy', FolderController.migrateUser);
app.get('/api/workspaces/:workspaceId/folders/tree', FolderController.getTree);
app.get('/api/workspaces/:workspaceId/folders', FolderController.getAll);
app.post('/api/workspaces/:workspaceId/folders', FolderController.create);
app.post('/api/workspaces/:workspaceId/migrate-hierarchy', FolderController.migrateWorkspace);
app.get('/api/folders/:id', FolderController.getById);
app.put('/api/folders/:id', FolderController.update);
app.patch('/api/folders/:id/move', FolderController.move);
app.delete('/api/folders/:id', FolderController.trash);
app.post('/api/folders/trash-batches/:batchId/restore', FolderController.restoreBatch);

// Rutas Taxonomía y Términos Desacoplados
app.get('/api/workspaces/:workspaceId/taxonomy/terms/tree', TaxonomyController.getTermTree);
app.get('/api/workspaces/:workspaceId/taxonomy/terms', TaxonomyController.listTerms);
app.post('/api/workspaces/:workspaceId/taxonomy/terms', TaxonomyController.createTerm);
app.delete('/api/taxonomy/terms/:id', TaxonomyController.deleteTerm);

// Rutas Clasificación de Conceptos (Explícita vs Heredada)
app.get('/api/concepts/:id/taxonomy', TaxonomyController.getConceptClassification);
app.post('/api/concepts/:id/taxonomy', TaxonomyController.assignTerm);
app.delete('/api/concepts/:id/taxonomy/:termId', TaxonomyController.removeTerm);

// Rutas Etiquetas (Tags M:N)
app.get('/api/workspaces/:workspaceId/tags', TaxonomyController.listTags);
app.post('/api/workspaces/:workspaceId/tags', TaxonomyController.createTag);
app.delete('/api/tags/:id', TaxonomyController.deleteTag);
app.get('/api/concepts/:id/tags', TaxonomyController.listTagsForConcept);
app.post('/api/concepts/:id/tags', TaxonomyController.attachTag);
app.delete('/api/concepts/:id/tags/:tagId', TaxonomyController.detachTag);

// Rutas Documento Canónico AST
app.get('/api/concepts/:id/ast', TaxonomyController.getConceptAst);
app.put('/api/concepts/:id/ast', TaxonomyController.updateConceptAst);

// Rutas Epistémicas y Evidencia (Fase 3: Fuentes, Anclas, Afirmaciones y Relaciones)
app.get('/api/workspaces/:workspaceId/sources', EpistemicController.listSources);
app.post('/api/workspaces/:workspaceId/sources', EpistemicController.createSource);
app.get('/api/sources/:sourceId/anchors', EpistemicController.listAnchors);
app.post('/api/sources/:sourceId/anchors', EpistemicController.createAnchor);
app.get('/api/concepts/:id/claims', EpistemicController.listClaims);
app.post('/api/concepts/:id/claims', EpistemicController.createClaim);
app.patch('/api/claims/:id/review', EpistemicController.reviewClaim);
app.get('/api/claims/:id/evidence', EpistemicController.listEvidenceForClaim);
app.post('/api/claims/:id/evidence', EpistemicController.linkEvidence);
app.delete('/api/claims/:id/evidence/:anchorId', EpistemicController.unlinkEvidence);
app.post('/api/claims/relations', EpistemicController.createRelation);
app.patch('/api/claims/relations/:id/status', EpistemicController.updateRelationStatus);
app.get('/api/concepts/:id/epistemic-graph', EpistemicController.getConceptGraph);

// Rutas Búsqueda Híbrida e Inteligencia Evaluada (Fase 4: FTS5 + sqlite-vec + Candidatos)
app.get('/api/workspaces/:workspaceId/search', SearchController.search);
app.post('/api/workspaces/:workspaceId/claims/candidates', SearchController.findCandidates);
app.post('/api/workspaces/:workspaceId/index/:entityType/:entityId', SearchController.indexEntity);

// Rutas Cerebros
app.get('/api/cerebros', CerebroController.getAll);
app.get('/api/cerebros/:id', CerebroController.getById);
app.get('/api/cerebros/slug/:slug', CerebroController.getBySlug);
app.get('/api/cerebros/:id/tree', CerebroController.getKnowledgeTree);
app.get('/api/cerebros/:id/facets/:facet', CerebroController.listConceptsByFacet);
app.post('/api/cerebros', CerebroController.create);
app.put('/api/cerebros/:id', CerebroController.update);
app.delete('/api/cerebros/:id', CerebroController.delete);

// Rutas Áreas
app.get('/api/areas', AreaController.getAll);
app.get('/api/areas/:id', AreaController.getById);
app.post('/api/areas', AreaController.create);
app.put('/api/areas/:id', AreaController.update);
app.delete('/api/areas/:id', AreaController.delete);

// Rutas Dominios
app.get('/api/domains', DomainController.getAll);
app.get('/api/domains/:id', DomainController.getById);
app.post('/api/domains', DomainController.create);
app.put('/api/domains/:id', DomainController.update);
app.delete('/api/domains/:id', DomainController.delete);

// Rutas Tópicos
app.get('/api/topics', TopicController.getAll);
app.get('/api/topics/:id', TopicController.getById);
app.post('/api/topics', TopicController.create);
app.put('/api/topics/:id', TopicController.update);
app.delete('/api/topics/:id', TopicController.delete);

// Rutas Conceptos
app.get('/api/concepts', ConceptController.getAll);
app.get('/api/concepts/summaries', ConceptController.getSummaries);
app.get('/api/concepts/trashed', ConceptController.getTrashed);
app.get('/api/concepts/:id', ConceptController.getById);
app.post('/api/concepts', ConceptController.create);
app.put('/api/concepts/:id', ConceptController.update);
app.delete('/api/concepts/:id', ConceptController.delete);
app.post('/api/concepts/:id/restore', ConceptController.restore);
app.delete('/api/concepts/:id/purge', ConceptController.purge);
app.post('/api/concepts/capture', ConceptController.capture);
app.post('/api/concepts/draft', ConceptController.generateDraft);
app.get('/api/concepts/:id/suggestions', ConceptController.getSuggestions);
app.get('/api/concepts/:id/versions', ConceptController.getVersions);
app.get('/api/concepts/:id/versions/:versionId', ConceptController.getVersion);
app.post('/api/concepts/:id/versions/:versionId/restore', ConceptController.restoreVersion);

// Rutas Analíticas
app.get('/api/analytics/stats', AnalyticsController.getStats);
app.get('/api/analytics/gaps', AnalyticsController.getGaps);
app.get('/api/analytics/events', AnalyticsController.getEvents);

// Import / Export / Imágenes
app.get('/api/vault/export', ExportController.exportZip);
app.post('/api/vault/import', ImportController.importZip);
app.post('/api/images/:name', ImageController.upload);
app.get('/api/images/:name', ImageController.serve);

// Middleware centralizado de errores
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`[Cogni-Vault Backend] API escuchando en http://localhost:${PORT}`);
});

export { app };
