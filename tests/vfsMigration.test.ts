import { test } from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { migrateLegacyVfs } from '../backend/src/services/legacy-vfs';
test('VFS migration scopes owners, preserves placements, handles orphans and is idempotent',()=>{
 const db=new Database(':memory:');
 db.exec(`
 CREATE TABLE cerebros(id TEXT PRIMARY KEY,slug TEXT,name TEXT,user_id TEXT,created_at TEXT,updated_at TEXT);
 CREATE TABLE areas(id TEXT PRIMARY KEY,name TEXT,user_id TEXT,cerebro_id TEXT);
 CREATE TABLE domains(id TEXT PRIMARY KEY,name TEXT,user_id TEXT,area_id TEXT);
 CREATE TABLE topics(id TEXT PRIMARY KEY,name TEXT,user_id TEXT,domain_id TEXT);
 CREATE TABLE folders(id TEXT PRIMARY KEY,workspace_id TEXT,parent_id TEXT,name TEXT,sort_order INTEGER,version INTEGER,created_at TEXT,updated_at TEXT,deleted_at TEXT);
 CREATE TABLE concepts(id TEXT PRIMARY KEY,user_id TEXT,domain TEXT,topic_id TEXT,workspace_id TEXT,folder_id TEXT,explanation TEXT);
 INSERT INTO cerebros(id,name,user_id) VALUES ('w','Work','u'),('other','Other','v');
 INSERT INTO areas VALUES ('a','Area','u','w'),('b','Area','v','other');
 INSERT INTO domains VALUES ('d','Shared name','u','a'),('e','Shared name','v','b');
 INSERT INTO topics VALUES ('t','Topic','u','d');
 INSERT INTO concepts VALUES ('note','u','d','t',NULL,NULL,'untouched'),('foreign','v','Shared name',NULL,NULL,NULL,'private'),('root','u','d','t','w',NULL,'root'),('orphan','u','missing',NULL,NULL,NULL,'orphan');
 `);
 const result=migrateLegacyVfs(db,'u');
 assert.equal(result.conceptsUpdated,2);
 const note=db.prepare('SELECT * FROM concepts WHERE id=?').get('note') as any;
 assert.equal(note.workspace_id,'w');assert.equal(note.explanation,'untouched');
 const topic=db.prepare('SELECT * FROM folders WHERE id=?').get(note.folder_id) as any;
 assert.equal(topic.name,'Topic');
 assert.equal((db.prepare('SELECT * FROM concepts WHERE id=?').get('foreign') as any).workspace_id,null);
 assert.equal((db.prepare('SELECT * FROM concepts WHERE id=?').get('root') as any).folder_id,null);
 assert.equal((db.prepare('SELECT * FROM concepts WHERE id=?').get('orphan') as any).workspace_id,'vfs-personal-u');
 assert.deepEqual(migrateLegacyVfs(db,'u'),{foldersCreated:0,conceptsUpdated:0});
 db.close();
});

test('repository persists arbitrary-depth note locations and rejects foreign folders', async () => {
  // The npm test runner supplies an isolated database for repository integration.
  assert.ok(process.env.COGNI_VAULT_DB_PATH, 'Run repository tests through npm test');
  const {sqlite}=await import('../backend/src/db');
  const {ConceptRepository}=await import('../backend/infrastructure/repositories/concept.repository');
  const {randomUUID}=await import('node:crypto');
  const ws=randomUUID(),foreign=randomUUID(),user='vfs-test-'+randomUUID(),now=new Date().toISOString();
  sqlite.prepare('INSERT INTO users (id,email) VALUES (?,?)').run(user,user+'@example.test');
  sqlite.prepare('INSERT INTO cerebros (id,slug,name,user_id,created_at,updated_at) VALUES (?,?,?,?,?,?)').run(ws,ws,'VFS test',user,now,now);
  sqlite.prepare('INSERT INTO cerebros (id,slug,name,user_id,created_at,updated_at) VALUES (?,?,?,?,?,?)').run(foreign,foreign,'Foreign','another-user',now,now);
  let parent:string|null=null;
  for(let level=0;level<7;level++){
    const id=randomUUID();
    sqlite.prepare('INSERT INTO folders (id,workspace_id,parent_id,name,created_at,updated_at) VALUES (?,?,?,?,?,?)').run(id,ws,parent,'Level '+level,now,now);
    parent=id;
  }
  const repo=new ConceptRepository(), id=randomUUID();
  repo.create({id,user_id:user,title:'VFS note',explanation:'| A | B |\n| --- | --- |\n| x | $y$ |',workspace_id:ws,folder_id:parent,updated_at:now});
  assert.equal(repo.findById(id,user)?.folder_id,parent);
  assert.equal(repo.getSummaries(user)[0].workspace_id,ws);
  repo.update({id,user_id:user,workspace_id:ws,folder_id:null});
  assert.equal(repo.findById(id,user)?.folder_id,null);
  assert.throws(()=>repo.update({id,user_id:user,workspace_id:foreign,folder_id:null}));
  assert.throws(()=>repo.update({id,user_id:user,workspace_id:ws,folder_id:'missing'}));
});
