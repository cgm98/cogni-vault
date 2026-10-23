import AdmZip from 'adm-zip';
import path from 'path';
import fs from 'fs';
import { uploadsDir } from '../../infrastructure/uploads.js';
import { AreaService } from './area.service.js';
import { DomainService } from './domain.service.js';
import { TopicService } from './topic.service.js';
import { ConceptService } from './concept.service.js';
import { RelationService } from './relation.service.js';
import { generateId } from '../utils.js';

export interface ImportDeps {
  areaService: AreaService;
  domainService: DomainService;
  topicService: TopicService;
  conceptService: ConceptService;
  relationService: RelationService;
}

export interface ImportReport {
  areasCreadas: number;
  dominiosCreados: number;
  temasCreados: number;
  notasCreadas: number;
  notasOmitidas: number;
  relacionesCreadas: number;
  relacionesOmitidas: number;
  imagenesImportadas: number;
}

const IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg']);

const norm = (s: string) => s.trim().toLowerCase();
// Clave laxa para casar wikilinks (PascalCase) con títulos reales ("DomainCore" ≈ "Domain Core")
const linkKey = (s: string) =>
  s.normalize('NFD').toLowerCase().replace(/[^a-z0-9]/g, '');

interface NoteLink {
  target: string;
  type: string;
}

interface ParsedNote {
  front: Record<string, string>;
  body: string;
  links: NoteLink[];
}

function parseNote(raw: string): ParsedNote {
  const front: Record<string, string> = {};
  let body = raw;
  if (raw.startsWith('---')) {
    const end = raw.indexOf('\n---', 3);
    if (end !== -1) {
      const yaml = raw.slice(raw.indexOf('\n') + 1, end);
      for (const line of yaml.split('\n')) {
        const m = line.match(/^([A-Za-z_]+):\s*(.*)$/);
        if (m) {
          const q = m[2].match(/^"(.*)"$/);
          front[m[1]] = (q ? q[1] : m[2]).replace(/\\"/g, '"');
        }
      }
      body = raw.slice(end + 4).replace(/^[^\S\n]*\n/, '');
    }
  }
  // La sección de wikilinks del export se convierte en relaciones, no en texto
  const links: NoteLink[] = [];
  const cx = body.indexOf('\n## Conexiones');
  if (cx !== -1) {
    for (const line of body.slice(cx).split('\n')) {
      const m = line.match(/^-\s*\[\[([^\]|]+)(?:\|[^\]]*)?\]\](?:\s*\(([^)]+)\))?/);
      if (m) links.push({ target: m[1].trim(), type: m[2]?.trim() || 'related_to' });
    }
    body = body.slice(0, cx);
  }
  return { front, body: body.trim(), links };
}

export function importVaultZip(buf: Buffer, deps: ImportDeps, userId: string): ImportReport {
  const zip = new AdmZip(buf);
  const report: ImportReport = {
    areasCreadas: 0,
    dominiosCreados: 0,
    temasCreados: 0,
    notasCreadas: 0,
    notasOmitidas: 0,
    relacionesCreadas: 0,
    relacionesOmitidas: 0,
    imagenesImportadas: 0
  };

  // Imágenes del zip → uploads/; las notas se reescriben para apuntar al server
  const zipImages = new Set<string>();
  for (const entry of zip.getEntries()) {
    if (entry.isDirectory) continue;
    const base = entry.entryName.split(/[\\/]/).filter(Boolean).pop()!;
    const ext = base.split('.').pop()?.toLowerCase() || '';
    if (!IMAGE_EXTS.has(ext) || !/^[A-Za-z0-9._ -]+$/.test(base)) continue;
    zipImages.add(base);
    const dest = path.join(uploadsDir, base);
    if (!fs.existsSync(dest)) {
      fs.writeFileSync(dest, entry.getData());
      report.imagenesImportadas++;
    }
  }

  // ![alt](ruta/img.png) o ![[img.png]] → ![alt](/api/v1/images/img.png) si la imagen vino en el zip
  const rewriteImageRefs = (body: string): string => body
    .replace(/!\[([^\]]*)\]\((?!https?:\/\/|\/api\/)([^)]+)\)/g, (m, alt, ref) => {
      const base = decodeURIComponent(ref).split(/[\\/]/).pop()!;
      return zipImages.has(base) ? `![${alt}](/api/v1/images/${base})` : m;
    })
    .replace(/!\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/g, (m, ref) => {
      const base = ref.trim().split(/[\\/]/).pop()!;
      return zipImages.has(base) ? `![](/api/v1/images/${base})` : m;
    });

  const areaByName = new Map(deps.areaService.getAll(userId).map(a => [norm(a.name), a]));
  const domainByName = new Map(deps.domainService.getAll(userId).map(d => [norm(d.name), d]));
  const topicByKey = new Map(deps.topicService.getAll(userId).map(t => [`${t.domain_id}|${norm(t.name)}`, t]));

  const conceptIdByKey = new Map<string, string>();
  const conceptIdByLink = new Map<string, string>();
  for (const c of deps.conceptService.getAll(userId)) {
    conceptIdByKey.set(`${c.domain}|${norm(c.title)}`, c.id);
    conceptIdByLink.set(linkKey(c.title), c.id);
  }

  const pendingLinks: { fromId: string; link: NoteLink }[] = [];

  for (const entry of zip.getEntries()) {
    if (entry.isDirectory || !entry.entryName.toLowerCase().endsWith('.md')) continue;
    // Compress-Archive de Windows escribe las rutas con '\'
    const parts = entry.entryName.split(/[\\/]/).filter(Boolean);
    const fileName = parts.pop()!;
    if (parts.some(p => p.startsWith('.'))) continue;

    // Regla de carpetas: Area/Dominio/Tema/Nota.md (niveles más profundos se ignoran)
    let areaName: string | null = null;
    let domainName: string;
    let topicName: string | null = null;
    if (parts.length === 0) {
      domainName = 'Importado';
    } else if (parts.length === 1) {
      domainName = parts[0];
    } else {
      areaName = parts[0];
      domainName = parts[1];
      topicName = parts[2] || null;
    }
    // "Sin Area" es el placeholder del export, no un área real
    if (areaName && norm(areaName) === 'sin area') areaName = null;

    let area = areaName ? areaByName.get(norm(areaName)) : undefined;
    if (areaName && !area) {
      area = deps.areaService.create({ id: generateId('area'), name: areaName }, userId);
      areaByName.set(norm(areaName), area);
      report.areasCreadas++;
    }

    let domain = domainByName.get(norm(domainName));
    if (!domain) {
      domain = deps.domainService.create({
        id: generateId('domain'),
        name: domainName,
        area_id: area?.id || null
      }, userId);
      domainByName.set(norm(domainName), domain);
      report.dominiosCreados++;
    }

    let topic = topicName ? topicByKey.get(`${domain.id}|${norm(topicName)}`) : undefined;
    if (topicName && !topic) {
      topic = deps.topicService.create({
        id: generateId('topic'),
        domain_id: domain.id,
        name: topicName
      }, userId);
      topicByKey.set(`${domain.id}|${norm(topicName)}`, topic);
      report.temasCreados++;
    }

    const { front, body, links } = parseNote(entry.getData().toString('utf-8'));
    const title = front.original_title || front.title || fileName.replace(/\.md$/i, '');
    const baseName = fileName.replace(/\.md$/i, '');

    const key = `${domain.id}|${norm(title)}`;
    let conceptId = conceptIdByKey.get(key);
    if (conceptId) {
      report.notasOmitidas++;
    } else {
      const strength = Number(front.strength);
      const difficulty = Number(front.difficulty);
      const created = deps.conceptService.create({
        title,
        explanation: rewriteImageRefs(body) || title,
        domain: domain.id,
        topic_id: topic?.id || null,
        strength: Number.isFinite(strength) ? strength : undefined,
        difficulty: Number.isFinite(difficulty) ? difficulty : undefined,
        status: ['active', 'draft', 'archived'].includes(front.status) ? front.status as 'active' | 'draft' | 'archived' : undefined
      }, userId);
      conceptId = created.id;
      conceptIdByKey.set(key, conceptId);
      report.notasCreadas++;
    }

    conceptIdByLink.set(linkKey(baseName), conceptId);
    conceptIdByLink.set(linkKey(title), conceptId);
    for (const link of links) pendingLinks.push({ fromId: conceptId, link });
  }

  // Relaciones al final: los destinos pueden ser notas que aparecen después en el zip
  const linkedPairs = new Set<string>();
  for (const r of deps.relationService.getAll(userId)) {
    linkedPairs.add([r.from_concept_id, r.to_concept_id].sort().join('|'));
  }
  for (const { fromId, link } of pendingLinks) {
    const toId = conceptIdByLink.get(linkKey(link.target));
    const pair = toId ? [fromId, toId].sort().join('|') : '';
    if (!toId || toId === fromId || linkedPairs.has(pair)) {
      report.relacionesOmitidas++;
      continue;
    }
    deps.relationService.create({
      from_concept_id: fromId,
      to_concept_id: toId,
      relation_type: link.type,
      source: 'import'
    }, userId);
    linkedPairs.add(pair);
    report.relacionesCreadas++;
  }

  return report;
}
