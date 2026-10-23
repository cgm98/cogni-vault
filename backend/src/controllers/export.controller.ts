import { Response } from 'express';
import AdmZip from 'adm-zip';
import path from 'path';
import fs from 'fs';
import { buildVaultFiles } from '../services/vault-export.service.js';
import { uploadsDir } from '../uploads.js';
import { AuthRequest } from '../http/middlewares/auth.middleware.js';

export class ExportController {
  static exportZip(req: AuthRequest, res: Response) {
    const areaId = typeof req.query.areaId === 'string' ? req.query.areaId : undefined;
    const { notes, images, folders, areaName } = buildVaultFiles(req.user!.userId, { areaId });
    const zip = new AdmZip();
    for (const dir of folders) {
      // Entrada de directorio explícita: entryName termina en '/' y buffer vacío (ver docs de adm-zip)
      zip.addFile(`${dir}/`, Buffer.alloc(0));
    }
    for (const f of notes) {
      zip.addFile(f.relPath, Buffer.from(f.content, 'utf-8'));
    }
    for (const name of images) {
      const file = path.join(uploadsDir, name);
      if (fs.existsSync(file)) {
        zip.addFile(`_attachments/${name}`, fs.readFileSync(file));
      }
    }
    const dateStr = new Date().toISOString().slice(0, 10);
    const sanitizedArea = areaName
      ? areaName.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase()
      : null;
    const filename = sanitizedArea
      ? `backup_notas_${sanitizedArea}_${dateStr}.zip`
      : `backup_notas_todas_las_areas_${dateStr}.zip`;

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
    res.send(zip.toBuffer());
  }
}
