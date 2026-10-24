import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { requestJson } from '../lib/api';
import type { Folder, FolderTreeNode, FolderConceptSummary } from '../types/folder.types';
export interface FlatFolderEntry { id:string; name:string; depth:number; version:number }
export const useFolderStore = defineStore('folder', () => {
  const folders=ref<Folder[]>([]);
  const tree=ref<FolderTreeNode[]>([]);
  const rootConcepts=ref<FolderConceptSummary[]>([]);
  const selectedFolderId=ref<string|null>(null);
  const loading=ref(false),error=ref<string|null>(null);
  let request=0;
  const flattenedFolders=computed<FlatFolderEntry[]>(()=>{
    const result:FlatFolderEntry[]=[];
    const visit=(nodes:FolderTreeNode[],depth:number)=>{for(const n of nodes){result.push({...n,depth});visit(n.children||[],depth+1);}};
    visit(tree.value,0);return result;
  });
  const totalNotesCount=computed(()=>rootConcepts.value.length);
  async function migrateLegacy() {
    return requestJson<{foldersCreated:number;conceptsUpdated:number;backupPath:string|null}>('/api/folders/migrate-legacy',{method:'POST'});
  }
  async function fetchAll(workspaces:string[]) {
    const token=++request; loading.value=true;error.value=null;
    try {
      const results=await Promise.all(workspaces.map(id=>requestJson<Folder[]>('/api/workspaces/'+encodeURIComponent(id)+'/folders')));
      if(token===request) folders.value=results.flat();
    } catch(e) { if(token===request) error.value=e instanceof Error?e.message:'No se pudieron cargar las carpetas';throw e; }
    finally {if(token===request)loading.value=false;}
  }
  async function fetchTree(workspaceId:string) {
    const data=await requestJson<FolderTreeNode[]>('/api/workspaces/'+encodeURIComponent(workspaceId)+'/folders/tree');
    tree.value=data;
    const flat:Folder[]=[];const visit=(nodes:FolderTreeNode[])=>{for(const node of nodes){flat.push(node);visit(node.children||[]);}};visit(data);
    folders.value=[...folders.value.filter(f=>f.workspace_id!==workspaceId),...flat];
  }
  async function createFolder(ws:string,name:string,parent:string|null=null) {
    const item=await requestJson<Folder>('/api/workspaces/'+ws+'/folders',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:name.trim(),parent_id:parent})});
    await fetchTree(ws);return item;
  }
  async function renameFolder(ws:string,id:string,name:string) {
    await requestJson('/api/folders/'+id,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({workspace_id:ws,name})});await fetchTree(ws);
  }
  async function moveFolder(ws:string,id:string,parent:string|null,version:number) {
    await requestJson('/api/folders/'+id+'/move',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({workspace_id:ws,target_parent_id:parent,expected_version:version})});await fetchTree(ws);
  }
  async function trashBatch(ws:string,ids:string[]=[],_conceptIds:string[]=[]) {
    for(const id of ids) await requestJson('/api/folders/'+id+'?workspaceId='+encodeURIComponent(ws),{method:'DELETE'});
    await fetchTree(ws);
  }
  async function restoreBatch(ws:string,batch:string) {
    const result=await requestJson('/api/folders/trash-batches/'+batch+'/restore',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({workspace_id:ws})});await fetchTree(ws);return result;
  }
  function selectFolder(id:string|null){selectedFolderId.value=id;}
  return {folders,tree,rootConcepts,selectedFolderId,loading,error,flattenedFolders,totalNotesCount,migrateLegacy,fetchAll,fetchTree,createFolder,renameFolder,moveFolder,trashBatch,restoreBatch,selectFolder};
});
