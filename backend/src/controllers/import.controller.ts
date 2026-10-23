import { Response } from 'express';
import { importVaultZip } from '../services/vault-import.service.js';
import { areaService } from '../di/containers/area.container.js';
import { domainService } from '../di/containers/domain.container.js';
import { topicService } from '../di/containers/topic.container.js';
import { conceptService } from '../di/containers/concept.container.js';
import { relationService } from '../di/containers/relation.container.js';
import { AuthRequest } from '../http/middlewares/auth.middleware.js';

export class ImportController {
  static importZip(req: AuthRequest, res: Response) {
    if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
      return res.status(400).json({
        error: { message: 'Se esperaba un archivo .zip en el cuerpo de la petición', code: 'VALIDATION_ERROR' }
      });
    }
    const report = importVaultZip(req.body, { areaService, domainService, topicService, conceptService, relationService }, req.user!.userId);
    res.status(201).json({ data: report });
  }
}
