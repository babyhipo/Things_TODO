import { useEffect } from 'react';
import { useTodoStore } from '../../store/useTodoStore';
import { DEFAULT_TEMPLATES } from './defaultTemplates';

export function useSeedTemplates(): void {
  useEffect(() => {
    const { templates } = useTodoStore.getState();
    const existingIds = new Set(templates.map((t) => t.id));
    const missing = DEFAULT_TEMPLATES.filter((t) => !existingIds.has(t.id));
    if (missing.length === 0) return;
    useTodoStore.setState((state) => ({
      templates: [...state.templates, ...missing],
    }));
  }, []);
}
