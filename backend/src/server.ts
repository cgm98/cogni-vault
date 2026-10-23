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

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.raw({ type: 'application/zip', limit: '100mb' }));
app.use(express.raw({ type: 'image/*', limit: '10mb' }));

// Auth guard global
app.use(authMiddleware);

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
