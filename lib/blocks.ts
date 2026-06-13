// ─── Note body helpers: TipTap JSON construction, plaintext, markdown export ───
// The canonical note body is a TipTap/ProseMirror JSON document. These helpers
// build it from fixtures, derive previews/snippets, and serialize to Markdown.
import type { Json } from './database.types';

type PMNode = { type: string; attrs?: Record<string, unknown>; content?: PMNode[]; text?: string };
export type TipTapDoc = { type: 'doc'; content: PMNode[] };

const text = (s: string): PMNode => ({ type: 'text', text: s });
const paragraph = (s = ''): PMNode => ({ type: 'paragraph', content: s ? [text(s)] : [] });

export const emptyDoc = (): TipTapDoc => ({ type: 'doc', content: [paragraph('')] });

function walkText(node: PMNode | undefined, out: string[]): void {
  if (!node) return;
  if (node.type === 'text' && node.text) out.push(node.text);
  if (node.content) for (const c of node.content) walkText(c, out);
}

/** Flatten all text in a doc to a single string. */
export function docToText(doc: Json | null | undefined): string {
  if (!doc || typeof doc !== 'object') return '';
  const out: string[] = [];
  walkText(doc as unknown as PMNode, out);
  return out.join(' ').replace(/\s+/g, ' ').trim();
}

/** First meaningful paragraph/heading text, truncated — used for list/search snippet. */
export function snippetFromDoc(doc: Json | null | undefined, max = 180): string {
  const d = doc as unknown as PMNode | null;
  if (!d || !d.content) return '';
  for (const node of d.content) {
    if (node.type === 'paragraph' || node.type === 'blockquote' || node.type === 'heading') {
      const out: string[] = [];
      walkText(node, out);
      const s = out.join(' ').replace(/\s+/g, ' ').trim();
      if (s) return s.length > max ? s.slice(0, max).trimEnd() + '…' : s;
    }
  }
  const all = docToText(doc);
  return all.length > max ? all.slice(0, max).trimEnd() + '…' : all;
}

/** Does the doc contain an image node? */
export function docHasImage(doc: Json | null | undefined): boolean {
  const d = doc as unknown as PMNode | null;
  if (!d) return false;
  let found = false;
  const visit = (n: PMNode) => {
    if (n.type === 'image') found = true;
    if (n.content) n.content.forEach(visit);
  };
  visit(d);
  return found;
}

/** Serialize a TipTap doc to Markdown for the editor's Export action. */
export function docToMarkdown(doc: Json | null | undefined, title: string): string {
  const d = doc as unknown as PMNode | null;
  const lines: string[] = [`# ${title}`, ''];
  if (!d || !d.content) return lines.join('\n');
  for (const node of d.content) {
    const inline = () => { const o: string[] = []; walkText(node, o); return o.join(''); };
    switch (node.type) {
      case 'heading': lines.push(`${'#'.repeat((node.attrs?.level as number) || 2)} ${inline()}`, ''); break;
      case 'paragraph': lines.push(inline(), ''); break;
      case 'blockquote': { const o: string[] = []; walkText(node, o); lines.push(`> ${o.join(' ')}`, ''); break; }
      case 'codeBlock': { const o: string[] = []; walkText(node, o); lines.push('```' + ((node.attrs?.language as string) || ''), o.join(''), '```', ''); break; }
      case 'taskList':
        for (const item of node.content || []) {
          const o: string[] = []; walkText(item, o);
          lines.push(`- [${item.attrs?.checked ? 'x' : ' '}] ${o.join(' ')}`);
        }
        lines.push('');
        break;
      case 'bulletList':
      case 'orderedList':
        for (const item of node.content || []) { const o: string[] = []; walkText(item, o); lines.push(`- ${o.join(' ')}`); }
        lines.push('');
        break;
      case 'image': lines.push(`![${(node.attrs?.alt as string) || ''}](${node.attrs?.src})`, ''); break;
      default: { const t = inline(); if (t) lines.push(t, ''); }
    }
  }
  return lines.join('\n');
}

/** Best-effort migration of legacy HTML/Draft content into a TipTap doc (cold paths only). */
export function legacyToDoc(content: string | null | undefined): TipTapDoc {
  if (!content) return emptyDoc();
  // Strip tags, split on block boundaries, wrap each as a paragraph.
  const plain = content
    .replace(/<\/(p|div|h[1-6]|li)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
  const paras = plain.split(/\n+/).map((s) => s.trim()).filter(Boolean);
  if (!paras.length) return emptyDoc();
  return { type: 'doc', content: paras.map((p) => paragraph(p)) };
}
