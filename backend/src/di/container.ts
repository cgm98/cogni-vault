import { areaService, areaRepository } from './containers/area.container.js';
import { domainService, domainRepository } from './containers/domain.container.js';
import { topicService, topicRepository } from './containers/topic.container.js';
import { conceptService, conceptRepository } from './containers/concept.container.js';
import { relationService, relationRepository } from './containers/relation.container.js';

import { CerebroRepository } from '../../infrastructure/repositories/cerebro.repository.js';
import { CerebroService } from '../services/cerebro.service.js';

import { AnalyticsRepository } from '../../infrastructure/repositories/analytics.repository.js';
import { AnalyticsService } from '../services/analytics.service.js';

import { CaptureService } from '../services/capture.service.js';
import { LinkerService } from '../services/linker.service.js';
import { NoteDraftService } from '../services/note-draft.service.js';

import { 
  folderService, 
  folderRepository, 
  outboxService, 
  outboxRepository, 
  hierarchyMigrationService 
} from './containers/folder.container.js';

import {
  taxonomyService,
  taxonomyRepository,
  tagRepository,
  conceptDocumentService
} from './containers/taxonomy.container.js';

import {
  epistemicService,
  epistemicRepository
} from './containers/epistemic.container.js';

import {
  searchRepository,
  embeddingProvider,
  searchIndexerService,
  hybridSearchService,
  evidenceCandidateService
} from './containers/search.container.js';

// Cerebro
export const cerebroRepository = new CerebroRepository();
export const cerebroService = new CerebroService(cerebroRepository);

// Analytics
export const analyticsRepository = new AnalyticsRepository();
export const analyticsService = new AnalyticsService(analyticsRepository);

// Supporting Services
export const captureService = new CaptureService(conceptRepository);
export const linkerService = new LinkerService(conceptRepository, relationRepository);
export const noteDraftService = new NoteDraftService();

// Re-exports
export {
  areaService,
  areaRepository,
  domainService,
  domainRepository,
  topicService,
  topicRepository,
  conceptService,
  conceptRepository,
  relationService,
  relationRepository,
  folderService,
  folderRepository,
  outboxService,
  outboxRepository,
  hierarchyMigrationService,
  taxonomyService,
  taxonomyRepository,
  tagRepository,
  conceptDocumentService,
  epistemicService,
  epistemicRepository,
  searchRepository,
  embeddingProvider,
  searchIndexerService,
  hybridSearchService,
  evidenceCandidateService
};

