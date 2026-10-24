import type Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';

// Scoped to one owner, transactional, and idempotent. Existing VFS placements win.
export function migrateLegacyVfs(db: Database.Database, userId: string, onlyWorkspace?: string) {
  return db.transaction(() => {
    const now = new Date().toISOString();
    let foldersCreated = 0, conceptsUpdated = 0;
    const spaces = db.prepare('SELECT id FROM cerebros WHERE user_id=?').all(userId) as {id:string}[];
    const spaceIds = new Set(spaces.map(s => s.id));
    const areas = db.prepare('SELECT * FROM areas WHERE user_id=? OR user_id IS NULL').all(userId) as any[];
    const domains = db.prepare('SELECT * FROM domains WHERE user_id=? OR user_id IS NULL').all(userId) as any[];
    const topics = db.prepare('SELECT * FROM topics WHERE user_id=? OR user_id IS NULL').all(userId) as any[];
    const notes = db.prepare('SELECT id, domain, topic_id FROM concepts WHERE user_id=? AND workspace_id IS NULL').all(userId) as any[];
    db.exec('CREATE TABLE IF NOT EXISTS legacy_vfs_map (user_id TEXT, kind TEXT, legacy_id TEXT, folder_id TEXT, PRIMARY KEY(user_id,kind,legacy_id))');
    let fallback: string | undefined;
    const fallbackSpace = () => {
      if (fallback) return fallback;
      const id = 'vfs-personal-' + userId;
      db.prepare('INSERT OR IGNORE INTO cerebros (id,slug,name,user_id,created_at,updated_at) VALUES (?,?,?,?,?,?)').run(id,id,'Personal',userId,now,now);
      fallback = id; return id;
    };
    const domainSpace = (d: any) => {
      const a = areas.find(a => a.id === d?.area_id);
      return a && spaceIds.has(a.cerebro_id) ? a.cerebro_id as string : undefined;
    };
    const folder = (kind:string, item:any, ws:string, parent:string|null):string => {
      const mapped = db.prepare('SELECT folder_id FROM legacy_vfs_map WHERE user_id=? AND kind=? AND legacy_id=?').get(userId,kind,item.id) as any;
      if (mapped) {
        const active = db.prepare('SELECT id FROM folders WHERE id=? AND deleted_at IS NULL').get(mapped.folder_id) as any;
        if (active) return active.id;
      }
      // Reuse earlier migration IDs or an existing folder at the exact location.
      const existing = db.prepare('SELECT id FROM folders WHERE workspace_id=? AND parent_id IS ? AND deleted_at IS NULL AND (id=? OR name=?) ORDER BY id=? DESC LIMIT 1').get(ws,parent,item.id,item.name,item.id) as any;
      const id = existing?.id || (db.prepare('SELECT id FROM folders WHERE id=?').get(item.id) ? randomUUID() : item.id);
      if (!existing) {
        db.prepare('INSERT INTO folders (id,workspace_id,parent_id,name,sort_order,version,created_at,updated_at) VALUES (?,?,?,?,0,1,?,?)').run(id,ws,parent,item.name,now,now);
        foldersCreated++;
      }
      db.prepare('INSERT OR REPLACE INTO legacy_vfs_map VALUES (?,?,?,?)').run(userId,kind,item.id,id);
      return id;
    };
    const areaFolder = (a:any,ws:string) => folder('area',a,ws,null);
    const domainFolder = (d:any,ws:string) => {
      const a = areas.find(a => a.id===d.area_id);
      return folder('domain',d,ws,a && a.cerebro_id===ws ? areaFolder(a,ws) : null);
    };
    // Preserve empty owned hierarchy folders too; mapping prevents resurrection on repeat runs.
    for (const a of areas.filter(a => spaceIds.has(a.cerebro_id) && (!onlyWorkspace || a.cerebro_id===onlyWorkspace))) {
      if (!db.prepare('SELECT 1 FROM legacy_vfs_map WHERE user_id=? AND kind=? AND legacy_id=?').get(userId,'area',a.id)) areaFolder(a,a.cerebro_id);
    }
    for (const d of domains) {
      const ws = domainSpace(d);
      if (!ws || (onlyWorkspace && ws!==onlyWorkspace)) continue;
      if (!db.prepare('SELECT 1 FROM legacy_vfs_map WHERE user_id=? AND kind=? AND legacy_id=?').get(userId,'domain',d.id)) domainFolder(d,ws);
      for (const t of topics.filter(t=>t.domain_id===d.id)) {
        if (!db.prepare('SELECT 1 FROM legacy_vfs_map WHERE user_id=? AND kind=? AND legacy_id=?').get(userId,'topic',t.id)) folder('topic',t,ws,domainFolder(d,ws));
      }
    }
    for (const note of notes) {
      const topic = topics.find(t=>t.id===note.topic_id);
      const byName = domains.filter(d=>d.name===note.domain);
      const domain = domains.find(d=>d.id===(topic?.domain_id || note.domain)) || (byName.length===1 ? byName[0] : undefined);
      const knownSpace = domainSpace(domain);
      if (onlyWorkspace && knownSpace!==onlyWorkspace) continue;
      const ws = knownSpace || fallbackSpace();
      let parent:string|null = domain ? domainFolder(domain,ws) : null;
      if (topic && domain) parent=folder('topic',topic,ws,parent);
      db.prepare('UPDATE concepts SET workspace_id=?,folder_id=? WHERE id=? AND user_id=? AND workspace_id IS NULL').run(ws,parent,note.id,userId);
      conceptsUpdated++;
    }
    return {foldersCreated, conceptsUpdated};
  })();
}
