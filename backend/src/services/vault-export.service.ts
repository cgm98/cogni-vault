import { sqlite } from '../../infrastructure/database/connection.js';

export interface VaultFile {
  relPath: string;
  content: string;
}

export interface VaultExport {
  notes: VaultFile[];
  // Nombres de archivo en uploads/ referenciados por las notas
  images: string[];
  // Rutas de área/dominio/tema sin notas: el zip debe conservarlas igual
  folders: string[];
  areaName?: string;
}

function toPascalCase(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]/g, ' ')
    .trim()
    .split(/\s+/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join('');
}

// Nombres de carpeta legibles pero válidos en Windows/Linux
function sanitizeFolder(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, ' ').replace(/\s+/g, ' ').trim() || 'Sin Nombre';
}

export function buildVaultFiles(userId: string, options?: { areaId?: string }): VaultExport {
  const allAreas = sqlite.prepare('SELECT * FROM areas WHERE user_id = ?').all(userId) as any[];
  const allDomains = sqlite.prepare('SELECT * FROM domains WHERE user_id = ?').all(userId) as any[];
  const allTopics = sqlite.prepare('SELECT * FROM topics WHERE user_id = ?').all(userId) as any[];
  // Incluye la papelera: es un respaldo, y las notas borradas se purgan solas a los 30 días.
  const allConcepts = sqlite.prepare('SELECT * FROM concepts WHERE user_id = ?').all(userId) as any[];
  const allRelations = sqlite.prepare(`
    SELECT r.* FROM relations r
    INNER JOIN concepts c ON c.id = r.from_concept_id
    WHERE c.user_id = ?
  `).all(userId) as any[];

  let areas = allAreas;
  let domains = allDomains;
  let topics = allTopics;
  let concepts = allConcepts;
  let selectedAreaName: string | undefined = undefined;

  if (options?.areaId && options.areaId !== 'all') {
    const targetArea = allAreas.find(a => a.id === options.areaId);
    if (targetArea) {
      selectedAreaName = targetArea.name;
      areas = [targetArea];
      const targetDomainIds = new Set(allDomains.filter(d => d.area_id === targetArea.id).map(d => d.id));
      const targetDomainNames = new Set(allDomains.filter(d => d.area_id === targetArea.id).map(d => d.name));
      domains = allDomains.filter(d => d.area_id === targetArea.id);
      
      const targetTopicIds = new Set(allTopics.filter(t => targetDomainIds.has(t.domain_id)).map(t => t.id));
      topics = allTopics.filter(t => targetDomainIds.has(t.domain_id));

      concepts = allConcepts.filter(c => {
        if (c.topic_id && targetTopicIds.has(c.topic_id)) return true;
        if (c.domain && (targetDomainIds.has(c.domain) || targetDomainNames.has(c.domain))) return true;
        return false;
      });
    }
  }

  const areaById = new Map(allAreas.map(a => [a.id, a]));
  const domainById = new Map(allDomains.map(d => [d.id, d]));
  const topicById = new Map(allTopics.map(t => [t.id, t]));
  const conceptIdSet = new Set(concepts.map(c => c.id));

  // Nombres de nota únicos globalmente para que los wikilinks resuelvan sin ambigüedad
  const usedNames = new Set<string>();
  const idToPascal = new Map<string, string>();
  for (const c of concepts) {
    const base = toPascalCase(c.title) || 'Nota';
    let name = base;
    let i = 1;
    while (usedNames.has(name)) name = `${base}${i++}`;
    usedNames.add(name);
    idToPascal.set(c.id, name);
  }

  // Solo salientes y con tipo: el import las reconstruye tal cual;
  // las entrantes las muestra Obsidian como backlinks
  const outgoing = new Map<string, { toId: string; type: string }[]>(concepts.map(c => [c.id, []]));
  for (const r of allRelations) {
    if (conceptIdSet.has(r.from_concept_id) && conceptIdSet.has(r.to_concept_id)) {
      outgoing.get(r.from_concept_id)!.push({ toId: r.to_concept_id, type: r.relation_type });
    }
  }

  const files: VaultFile[] = [];
  const usedImages = new Set<string>();
  for (const c of concepts) {
    const domain = domainById.get(c.domain);
    const area = domain?.area_id ? areaById.get(domain.area_id) : undefined;
    const topic = c.topic_id ? topicById.get(c.topic_id) : undefined;

    const areaName = area?.name || 'Sin Area';
    const domainName = domain?.name || 'Sin Dominio';
    const folders = [areaName, domainName, ...(topic ? [topic.name] : [])].map(sanitizeFolder);

    const pascalName = idToPascal.get(c.id)!;
    const dateStr = c.created_at ? c.created_at.slice(0, 10) : new Date().toISOString().slice(0, 10);
    const isTrashed = !!c.deleted_at;

    const tags = ['  - Nota', `  - ${toPascalCase(domainName)}`];
    if (area) tags.push(`  - ${toPascalCase(areaName)}`);
    if (topic) tags.push(`  - ${toPascalCase(topic.name)}`);
    if (isTrashed) tags.push('  - Papelera');

    const frontmatter = [
      '---',
      `title: "${pascalName}"`,
      `original_title: "${c.title.replace(/"/g, '\\"')}"`,
      'tags:',
      ...tags,
      `date: ${dateStr}`,
      'type: Nota',
      `area: "${areaName}"`,
      `domain: "${domainName}"`,
      ...(topic ? [`topic: "${topic.name}"`] : []),
      `strength: ${c.strength ?? 0.7}`,
      `difficulty: ${c.difficulty ?? 3}`,
      `status: "${c.status || 'active'}"`,
      ...(isTrashed ? [`deleted_at: "${c.deleted_at}"`] : []),
      '---',
      ''
    ].join('\n');

    let body = c.explanation || '';
    // Imágenes subidas a la app → ruta relativa dentro del zip
    body = body.replace(/\]\(\/api\/v1\/images\/([A-Za-z0-9._-]+)\)/g, (_m: string, name: string) => {
      usedImages.add(name);
      return `](_attachments/${name})`;
    });
    if (c.intuition && !body.includes(c.intuition)) {
      body += `\n\n### Intuición\n> *${c.intuition}*`;
    }

    const relatedLinks = (outgoing.get(c.id) || [])
      .map(r => ({ name: idToPascal.get(r.toId), type: r.type }))
      .filter((r): r is { name: string; type: string } => !!r.name)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(r => `- [[${r.name}]] (${r.type})`)
      .join('\n');

    const connectionsSection = ['', '## Conexiones', relatedLinks || 'No hay conexiones directas.'].join('\n');

    const pathPrefix = isTrashed ? ['Papelera', ...folders] : folders;

    files.push({
      relPath: `${pathPrefix.join('/')}/${pascalName}.md`,
      content: frontmatter + body + connectionsSection + '\n'
    });
  }

  // Carpetas sin notas (áreas/dominios/temas vacíos): el zip las conserva igual,
  // como entradas de directorio explícitas — si no, no aparecerían en absoluto.
  const folderPaths = new Set<string>();
  for (const a of areas) {
    folderPaths.add(sanitizeFolder(a.name));
  }
  for (const d of domains) {
    const area = d.area_id ? areaById.get(d.area_id) : undefined;
    folderPaths.add([area?.name || 'Sin Area', d.name].map(sanitizeFolder).join('/'));
  }
  for (const t of topics) {
    const domain = domainById.get(t.domain_id);
    const area = domain?.area_id ? areaById.get(domain.area_id) : undefined;
    folderPaths.add([area?.name || 'Sin Area', domain?.name || 'Sin Dominio', t.name].map(sanitizeFolder).join('/'));
  }

  return {
    notes: files,
    images: [...usedImages],
    folders: [...folderPaths],
    areaName: selectedAreaName
  };
}
