export const WIKILINK_RE = /\[\[(.*?)\]\]/g;

export function isFileLink(link: string): boolean {
  return link.startsWith('file:');
}

export function isSymbolLink(link: string): boolean {
  return link.startsWith('symbol:') || link.startsWith('sym:');
}

export function linkKey(target: string): string {
  return target.trim().toLowerCase();
}

