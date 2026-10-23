import { AreaRepository } from '../../../infrastructure/repositories/area.repository.js';
import { AreaService } from '../../services/area.service.js';

export const areaRepository = new AreaRepository();
export const areaService = new AreaService(areaRepository);
