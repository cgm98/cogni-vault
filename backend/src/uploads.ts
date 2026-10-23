import path from 'path';
import fs from 'fs';

export const uploadsDir = process.env.UPLOADS_DIR || path.resolve(process.cwd(), 'uploads');

if (!fs.existsSync(uploadsDir)) {
  try {
    fs.mkdirSync(uploadsDir, { recursive: true });
  } catch (err) {
    console.warn('[Uploads] Warning creating uploads directory:', (err as Error).message);
  }
}
