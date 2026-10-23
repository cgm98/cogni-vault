import test from 'node:test';
import assert from 'node:assert/strict';
import { noteHierarchy, treeRows } from '../frontend/src/lib/noteTree';
const workspaces = [{id:'w1',name:'Uno'},{id:'w2',name:'Dos'},{id:'empty',name:'Vacío'}];
const areas = [{id:'a1',name:'Área uno',cerebro_id:'w1'},{id:'a2',name:'Área dos',cerebro_id:'w2'}];
const domains = [{id:'d1',name:'Compartido',area_id:'a1'},{id:'d2',name:'Compartido',area_id:'a2'},{id:'loose',name:'Sin área',area_id:null}];
const topics = [{id:'t1',name:'Tema uno',domain_id:'d1'},{id:'t2',name:'Tema dos',domain_id:'d2'}];
const hierarchy = noteHierarchy(workspaces,areas,domains,topics);
test('workspace filtering follows IDs through topics, domains and areas without name collisions', () => {
  assert.deepEqual(hierarchy.foldersFor('w1').map(f=>f.id),['a1','d1','t1']);
  assert.deepEqual(hierarchy.foldersFor('empty'),[]);
  assert.equal(hierarchy.location({domain:'d2',topic_id:'t1'}).workspaceId,'w1');
  assert.equal(hierarchy.location({domain:'d2'}).workspaceId,'w2');
  assert.equal(hierarchy.location({domain:'Compartido'}).workspaceId,null);
  assert.equal(hierarchy.location({domain:'loose'}).workspaceId,null);
  assert.equal(hierarchy.location({domain:'missing'}).folderId,'root');
});
test('tree keeps empty folders, counts nested notes and search reveals matching ancestors', () => {
  const folders = hierarchy.foldersFor('w1');
  const files = [{id:'n1',name:'Encontrable',folderId:'t1'},{id:'n2',name:'Directa',folderId:'d1'}];
  const collapsed = treeRows(folders,files,new Set());
  assert.equal(collapsed.length,1);
  assert.equal(collapsed[0].count,2);
  assert.deepEqual(treeRows(folders,files,new Set(),'Encontrable').map(r=>r.id),['a1','d1','t1','n1']);
  assert.deepEqual(treeRows(folders,files,new Set(),'Compartido').map(r=>r.id),['a1','d1','t1','n1','n2']);
  assert.deepEqual(treeRows(folders,[],new Set(['a1','d1'])).map(r=>r.id),['a1','d1','t1']);
  assert.equal(treeRows(folders,files,new Set(),'ausente').length,0);
});
test('orphan notes remain accessible in all spaces without duplication', () => {
  const folders = hierarchy.foldersFor();
  const files=[{id:'n',name:'Sin carpeta',folderId:'missing'}];
  const rows=treeRows(folders,files,new Set(folders.map(f=>f.id)));
  assert.equal(rows.filter(r=>r.id==='n').length,1);
  assert.ok(rows.some(r=>r.id==='empty'));
});
test('SQLite workspace tree and facets exclude other workspaces, users and deleted notes', async () => {
  process.env.COGNI_VAULT_DB_PATH=':memory:';
  const {sqlite,db}=await import('../backend/src/db');
  const {getTableConfig}=await import('drizzle-orm/sqlite-core');
  const {cerebros}=await import('../backend/src/schemas/cerebro.schema');
  const {areas:areaTable}=await import('../backend/src/schemas/area.schema');
  const {domains:domainTable}=await import('../backend/src/schemas/domain.schema');
  const {topics:topicTable}=await import('../backend/src/schemas/topic.schema');
  const {concepts}=await import('../backend/src/schemas/concept.schema');
  try {
    for(const table of [cerebros,areaTable,domainTable,topicTable,concepts]) {
      const config=getTableConfig(table);
      sqlite.exec('CREATE TABLE "'+config.name+'" ('+config.columns.map(c=>'"'+c.name+'" '+c.getSQLType()+(c.primary?' PRIMARY KEY':'')+(c.notNull?' NOT NULL':'')).join(',')+')');
    }
    for(const w of workspaces) db.insert(cerebros).values({...w,slug:w.id,user_id:'u',created_at:'now',updated_at:'now'}).run();
    for(const a of areas) db.insert(areaTable).values({...a,user_id:'u'}).run();
    for(const d of domains) db.insert(domainTable).values({...d,user_id:'u',color:'#fff'}).run();
    for(const t of topics) db.insert(topicTable).values({...t,user_id:'u'}).run();
    const records=[{id:'one',domain:'d1'},{id:'two',domain:'d2',topic_id:'t2'},{id:'topic-wins',domain:'d2',topic_id:'t1'},{id:'deleted',domain:'d1',deleted_at:'now'},{id:'other-user',domain:'d1',user_id:'other'},{id:'unassigned',domain:'loose'}];
    for(const record of records) db.insert(concepts).values({title:'Note',explanation:'',user_id:'u',created_at:'now',updated_at:'now',author_type:'human',temporal_facet:'PAST_MEMORY',...record}).run();
    const {CerebroRepository}=await import('../backend/infrastructure/repositories/cerebro.repository');
    const {ConceptRepository}=await import('../backend/infrastructure/repositories/concept.repository');
    const repo=new CerebroRepository();
    const tree=repo.getCerebroTree('w1','u')!;
    assert.deepEqual(tree.domains.map(d=>d.id),['d1']);
    assert.deepEqual(tree.topics.map(t=>t.id),['t1']);
    assert.deepEqual(tree.concepts.map(c=>c.id),['one','topic-wins']);
    assert.deepEqual(repo.getCerebroTree('empty','u')?.concepts,[]);
    assert.equal(repo.getCerebroTree('w1','other'),undefined);
    assert.deepEqual(new ConceptRepository().listByFacet('w2','PAST_MEMORY','u').map(c=>c.id),['two']);
  } finally {sqlite.close();}
});
