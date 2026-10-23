import { computed, toValue, type MaybeRefOrGetter } from 'vue';
import { renderMarkdown, renderMarkdownDocument } from '../lib/markdown';
export function useMarkdown(content?: MaybeRefOrGetter<string>) {
  return {
    rendered: computed(() => renderMarkdown(toValue(content) || '')),
    render: renderMarkdown,
    renderSegments: renderMarkdownDocument
  };
}
