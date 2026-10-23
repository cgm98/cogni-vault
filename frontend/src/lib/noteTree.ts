import type { FileItem, FolderItem } from '../types';

type Workspace = { id: string; name: string };
type Area = Workspace & { cerebro_id?: string | null };
type Domain = Workspace & { area_id?: string | null };
type Topic = Workspace & { domain_id: string };

export function noteHierarchy(workspaces: Workspace[], areas: Area[], domains: Domain[], topics: Topic[]) {
  const workspaceIds = new Set(workspaces.map(w => w.id));
  const areaMap = new Map(areas.map(a => [a.id, a]));
  const domainMap = new Map(domains.map(d => [d.id, d]));
  const topicMap = new Map(topics.map(t => [t.id, t]));
  const domainWorkspace = (domain?: Domain) => {
    const id = domain?.area_id ? areaMap.get(domain.area_id)?.cerebro_id : null;
    return id && workspaceIds.has(id) ? id : null;
  };
  const folders: FolderItem[] = [
    ...workspaces.map(w => ({ ...w, kind: 'workspace' as const, parentId: 'root' })),
    ...areas.map(a => ({ id: a.id, name: a.name, kind: 'area' as const, parentId: a.cerebro_id && workspaceIds.has(a.cerebro_id) ? a.cerebro_id : 'root' })),
    ...domains.map(d => ({ id: d.id, name: d.name, kind: 'domain' as const, parentId: d.area_id && areaMap.has(d.area_id) ? d.area_id : 'root' })),
    ...topics.map(t => ({ id: t.id, name: t.name, kind: 'topic' as const, parentId: domainMap.has(t.domain_id) ? t.domain_id : 'root' }))
  ];
  const folderMap = new Map(folders.map(f => [f.id, f]));
  function workspaceForFolder(id: string): string | null {
    const seen = new Set<string>();
    let folder = folderMap.get(id);
    while (folder && !seen.has(folder.id)) {
      if (folder.kind === 'workspace') return folder.id;
      seen.add(folder.id);
      folder = folderMap.get(folder.parentId || 'root');
    }
    return null;
  }
  return {
    foldersFor(workspaceId?: string | null) {
      return workspaceId ? folders.filter(f => f.id !== workspaceId && workspaceForFolder(f.id) === workspaceId)
        .map(f => ({ ...f, parentId: f.parentId === workspaceId ? 'root' : f.parentId })) : folders;
    },
    location(note: { domain?: string | null; topic_id?: string | null }) {
      const topic = note.topic_id ? topicMap.get(note.topic_id) : undefined;
      // IDs are authoritative. Legacy names are accepted only when unambiguous.
      const matches = domains.filter(d => d.name === note.domain);
      const domain = topic ? domainMap.get(topic.domain_id) : domainMap.get(note.domain || '') || (matches.length === 1 ? matches[0] : undefined);
      return { folderId: topic?.id || domain?.id || 'root', workspaceId: domainWorkspace(domain) };
    }
  };
}

export interface TreeRow { id: string; name: string; depth: number; folder?: FolderItem; count?: number }
export function treeRows(folders: FolderItem[], files: FileItem[], expanded: Set<string>, query = ''): TreeRow[] {
  const rows: TreeRow[] = [];
  const q = query.trim().toLocaleLowerCase();
  const ids = new Set(folders.map(f => f.id));
  const parent = (id?: string | null) => id && ids.has(id) ? id : 'root';
  const sorted = <T extends { name: string }>(items: T[]) => [...items].sort((a, b) => a.name.localeCompare(b.name, 'es', { numeric: true }));
  function visit(id: string, depth: number, ancestorMatch: boolean, seen: Set<string>): { rows: TreeRow[]; count: number } {
    if (seen.has(id)) return { rows: [], count: 0 };
    const nextSeen = new Set(seen).add(id);
    const result: TreeRow[] = [];
    let count = 0;
    for (const folder of sorted(folders.filter(f => parent(f.parentId) === id))) {
      const match = ancestorMatch || (!!q && folder.name.toLocaleLowerCase().includes(q));
      const children = visit(folder.id, depth + 1, match, nextSeen);
      count += children.count;
      if (!q || match || children.rows.length) {
        result.push({ id: folder.id, name: folder.name, depth, folder, count: children.count });
        if (q || expanded.has(folder.id)) result.push(...children.rows);
      }
    }
    for (const file of sorted(files.filter(f => parent(f.folderId) === id))) {
      if (!q || ancestorMatch || file.name.toLocaleLowerCase().includes(q)) {
        count++;
        result.push({ id: file.id, name: file.name, depth });
      }
    }
    return { rows: result, count };
  }
  rows.push(...visit('root', 0, false, new Set()).rows);
  return rows;
}
