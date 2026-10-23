export function useConfirm() {
  async function confirm(options: string | { title?: string; message: string; confirmLabel?: string; destructive?: boolean }): Promise<boolean> {
    const msg = typeof options === 'string' ? options : (options.message || options.title || '¿Confirmar?');
    return window.confirm(msg);
  }
  return { confirm };
}
