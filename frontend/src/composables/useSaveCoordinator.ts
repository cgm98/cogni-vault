import { ref, computed, getCurrentScope, onScopeDispose } from 'vue';
import type { SaveStatus } from '../types';

interface SaveOptions {
  exists: (id: string) => boolean;
  save: (id: string) => Promise<unknown>;
  delay?: number;
  onSaveSuccess?: (id: string) => void;
  onSaveError?: (id: string, error: Error & { details?: unknown }) => void;
  onRetryExhausted?: (id: string) => void;
}

export function useSaveCoordinator(options: SaveOptions) {
  const saveStates = ref<Record<string, SaveStatus>>({});
  const saveErrors = ref<Record<string, string>>({});
  const recentlySaved = ref<Record<string, boolean>>({});
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  const revisions = new Map<string, number>();
  const flights = new Map<string, Promise<boolean>>();
  const hasUnsavedChanges = computed(() => Object.values(saveStates.value).some(s => s !== 'saved'));

  function cancelScheduledSave(id: string) {
    const timer = timers.get(id);
    if (timer) clearTimeout(timer);
    timers.delete(id);
  }

  function markDirty(id: string) {
    revisions.set(id, (revisions.get(id) || 0) + 1);
    saveStates.value[id] = 'dirty';
    recentlySaved.value[id] = false;
  }

  function scheduleSave(id: string) {
    markDirty(id);
    cancelScheduledSave(id);
    timers.set(id, setTimeout(() => { void persistFile(id); }, options.delay ?? 650));
  }

  async function persistFile(id: string, settings: { showToast?: boolean; isRetry?: boolean } = {}): Promise<boolean> {
    cancelScheduledSave(id);
    const pending = flights.get(id);
    if (pending) return pending;
    if (!options.exists(id)) return false;

    const operation = (async () => {
      while (options.exists(id)) {
        const revision = revisions.get(id) || 0;
        saveStates.value[id] = 'saving';
        let failure: Error | null = null;
        for (let attempt = 0; attempt < 2; attempt++) {
          try {
            await options.save(id);
            failure = null;
            break;
          } catch (error) {
            failure = error instanceof Error ? error : new Error(String(error));
          }
        }
        if (failure) {
          saveStates.value[id] = 'error';
          saveErrors.value[id] = failure.message;
          options.onSaveError?.(id, failure);
          options.onRetryExhausted?.(id);
          return false;
        }
        // A newer edit arrived during the request. Save it before declaring success.
        if (revision !== (revisions.get(id) || 0)) {
          cancelScheduledSave(id);
          continue;
        }
        saveStates.value[id] = 'saved';
        delete saveErrors.value[id];
        recentlySaved.value[id] = true;
        if (settings.showToast) options.onSaveSuccess?.(id);
        return true;
      }
      return false;
    })();
    flights.set(id, operation);
    try { return await operation; }
    finally { flights.delete(id); }
  }

  async function flushUnsaved(): Promise<boolean> {
    const ids = Object.keys(saveStates.value).filter(id => saveStates.value[id] !== 'saved');
    const results = await Promise.all(ids.map(id => persistFile(id)));
    return results.every(Boolean) && !hasUnsavedChanges.value;
  }

  function clearSaveTracking(id?: string) {
    const ids = id ? [id] : Object.keys(saveStates.value);
    for (const key of ids) {
      cancelScheduledSave(key);
      revisions.delete(key);
      delete saveStates.value[key];
      delete saveErrors.value[key];
      delete recentlySaved.value[key];
    }
  }

  if (getCurrentScope()) onScopeDispose(() => {
    for (const timer of timers.values()) clearTimeout(timer);
    timers.clear();
  });

  return {
    saveStates, saveErrors, recentlySaved, hasUnsavedChanges,
    markDirty, clearSaveTracking, handleRestored: clearSaveTracking,
    cancelScheduledSave, scheduleSave, persistFile, flushUnsaved
  };
}
