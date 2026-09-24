import { useObjectStore } from '../stores/objectStore';
import type { TrackedObject } from '../types';

export function useSelectedObject(): TrackedObject | null {
  return useObjectStore((s) => (s.selectedId ? (s.objects[s.selectedId] ?? null) : null));
}

export function useObject(id: string | null): TrackedObject | null {
  return useObjectStore((s) => (id ? (s.objects[id] ?? null) : null));
}
