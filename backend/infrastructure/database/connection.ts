import { sqlite, db } from '../../src/db.js';

export { sqlite, db };

export function initDb(): void {
  sqlite.pragma('foreign_keys = ON');
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('synchronous = NORMAL');
}
