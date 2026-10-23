import { ref } from 'vue';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  text: string;
}

const toasts = ref<ToastMessage[]>([]);

export function useToast() {
  function show(text: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') {
    const id = `toast_${Date.now()}`;
    toasts.value.push({ id, type, text });
    setTimeout(() => {
      toasts.value = toasts.value.filter(t => t.id !== id);
    }, 3000);
  }

  return {
    toasts,
    show,
    success: (msg: string, ..._args: any[]) => show(msg, 'success'),
    error: (msg: string, ..._args: any[]) => show(msg, 'error'),
    info: (msg: string, ..._args: any[]) => show(msg, 'info'),
    warning: (msg: string, ..._args: any[]) => show(msg, 'warning')
  };
}
