import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as sqliteVec from 'sqlite-vec';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ruta dedicada para cogni_vault.db
const candidatePaths = [
  path.resolve(__dirname, '../../db/cogni_vault.db'),
  path.resolve(__dirname, '../../../db/cogni_vault.db'),
  path.resolve(process.cwd(), 'db/cogni_vault.db')
];
const dbPath = process.env.COGNI_VAULT_DB_PATH || candidatePaths.find(p => fs.existsSync(p)) || candidatePaths[0];

export const sqlite = new Database(dbPath);
sqlite.pragma('foreign_keys = ON');
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('synchronous = NORMAL');

// Cargar extensión sqlite-vec para vectores de documentos (doc_chunk_vectors)
try {
  sqliteVec.load(sqlite);
} catch (e) {
  console.warn('sqlite-vec warning in cogni-vault:', (e as Error).message);
}

export const db = drizzle(sqlite);
