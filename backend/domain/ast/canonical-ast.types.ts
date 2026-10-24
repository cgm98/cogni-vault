export type AstNodeType =
  | 'doc'
  | 'heading'
  | 'paragraph'
  | 'code_block'
  | 'mermaid_block'
  | 'math_block'
  | 'blockquote'
  | 'bullet_list'
  | 'ordered_list'
  | 'task_list'
  | 'task_item'
  | 'list_item'
  | 'table'
  | 'table_row'
  | 'table_cell'
  | 'text'
  | 'math_inline'
  | 'wikilink';

export interface AstMark {
  type: 'bold' | 'italic' | 'code' | 'strikethrough' | 'link';
  attrs?: Record<string, any>;
}

export interface AstNode {
  type: AstNodeType;
  attrs?: Record<string, any>;
  content?: AstNode[];
  text?: string;
  marks?: AstMark[];
}

export interface CanonicalDocumentAst {
  schema_version: number;
  type: 'doc';
  content: AstNode[];
}
