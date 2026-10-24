import Database from 'better-sqlite3';
import { mkdtemp, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { spawn } from 'node:child_process';

// Integration tests use repositories bound to the app connection. Always isolate writes.
const dir=await mkdtemp(join(tmpdir(),'cogni-tests-'));
const dbPath=join(dir,'vault.db');
const source=new Database(process.env.COGNI_VAULT_DB_PATH || resolve('db/cogni_vault.db'),{readonly:true});
try {await source.backup(dbPath);} finally {source.close();}
const files=['notes','noteTree','markdown','liveEditor','phase1-folders-outbox','phase2-ast-taxonomy','phase3-epistemic-evidence','phase4-search-retrieval','markdownTable','vfsMigration'].map(name=>'tests/'+name+'.test.ts');
let code=1;
try {
 code=await new Promise((resolve,reject)=>{
  const child=spawn(process.execPath,['--import','tsx','--test','--test-concurrency=1',...files],{stdio:'inherit',env:{...process.env,COGNI_VAULT_DB_PATH:dbPath}});
  child.on('error',reject);child.on('exit',value=>resolve(value??1));
 });
} finally {await rm(dir,{recursive:true,force:true});}
process.exitCode=code;
