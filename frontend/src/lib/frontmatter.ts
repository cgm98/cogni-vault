export interface ParsedFrontmatter {
  data: Record<string, any>;
  content: string;
  body: string;
}

export function parseFrontmatter(markdown: string): ParsedFrontmatter {
  if (!markdown || !markdown.startsWith('---')) {
    return { data: {}, content: markdown || '', body: markdown || '' };
  }

  const end = markdown.indexOf('\n---', 3);
  if (end === -1) {
    return { data: {}, content: markdown, body: markdown };
  }

  const raw = markdown.slice(3, end).trim();
  const content = markdown.slice(end + 4).trimStart();
  const data: Record<string, any> = {};

  for (const line of raw.split('\n')) {
    const colon = line.indexOf(':');
    if (colon !== -1) {
      const key = line.slice(0, colon).trim();
      const val = line.slice(colon + 1).trim();
      data[key] = val;
    }
  }

  return { data, content, body: content };
}
