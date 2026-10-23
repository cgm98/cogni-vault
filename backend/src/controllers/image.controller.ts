import { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { randomUUID } from 'node:crypto';
import { uploadsDir } from '../uploads.js';

const EXT_BY_MIME: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/svg+xml': 'svg'
};

export class ImageController {
  static upload(req: Request, res: Response) {
    const ext = EXT_BY_MIME[(req.headers['content-type'] || '').split(';')[0]];
    if (!ext || !Buffer.isBuffer(req.body) || req.body.length === 0) {
      return res.status(400).json({
        error: { message: 'Se esperaba una imagen (png, jpg, gif, webp o svg) en el cuerpo', code: 'VALIDATION_ERROR' }
      });
    }
    const name = `img-${randomUUID()}.${ext}`;
    fs.writeFileSync(path.join(uploadsDir, name), req.body);
    res.status(201).json({ data: { name, url: `/api/v1/images/${name}` } });
  }

  static serve(req: Request, res: Response) {
    const name = req.params.name;
    if (!/^[A-Za-z0-9._ -]+$/.test(name) || name.includes('..')) {
      return res.status(400).json({ error: { message: 'Nombre de imagen inválido', code: 'VALIDATION_ERROR' } });
    }
    const file = path.join(uploadsDir, name);
    if (!fs.existsSync(file)) {
      return res.status(404).json({ error: { message: 'Imagen no encontrada', code: 'NOT_FOUND' } });
    }
    res.sendFile(file);
  }
}
