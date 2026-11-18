'use client';

import { useCallback, useMemo, useContext } from 'react';
import { useQuery, useMutation, QueryClientContext } from '@tanstack/react-query';
import { queryClient as defaultQueryClient } from '@/lib/query-client';
import { readSheet, addRow, updateRow, deleteRow } from '@/lib/sheets-api';
import { Project, ChecklistItem, generateId } from '@/types';

const STORAGE_KEY = 'hchps-projects';
const TOMBSTONE_STORAGE_KEY = 'hchps-global-tombstones';

function readLocalTombstones(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(TOMBSTONE_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item: unknown) => {
        if (typeof item === 'string') return item;
        if (item && typeof item === 'object' && 'id' in item && typeof (item as { id: unknown }).id === 'string') {
          return (item as { id: string }).id;
        }
        return '';
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

function recordLocalTombstone(id: string): void {
  if (typeof window === 'undefined' || !id) return;
  try {
    const raw = window.localStorage.getItem(TOMBSTONE_STORAGE_KEY);
    const list = raw ? JSON.parse(raw) : [];
    const array = Array.isArray(list) ? list : [];
    const exists = array.some((item: unknown) =>
      typeof item === 'string' ? item === id : Boolean(item && typeof item === 'object' && (item as { id?: string }).id === id)
    );
    if (!exists) {
      array.push(id);
      window.localStorage.setItem(TOMBSTONE_STORAGE_KEY, JSON.stringify(array));
    }
  } catch {
    // Ignore storage quota errors
  }
}

export function useProjects(options?: { enabled?: boolean }) {
  const enabled = options?.enabled ?? true;
  const queryClientContext = useContext(QueryClientContext);
  const queryClient = queryClientContext || defaultQueryClient;

  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ['PROJECTS'],
    queryFn: async () => {
      try {
        const rows = await readSheet<Project>('PROJECTS');
        const deletedSet = new Set(readLocalTombstones());
        const filtered = (Array.isArray(rows) ? rows : []).filter(p => !deletedSet.has(p.id));
        if (filtered.length > 0) {
          try { localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered)); } catch {}
          return filtered;
        }
        // Fallback to localStorage if rows is empty
        try {
          const stored = localStorage.getItem(STORAGE_KEY);
          if (stored) {
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed)) return parsed.filter((p: Project) => !deletedSet.has(p.id));
          }
        } catch {}
        return filtered;
      } catch {
        // Offline / error fallback to localStorage
        try {
          const stored = localStorage.getItem(STORAGE_KEY);
          if (stored) {
            const parsed = JSON.parse(stored);
            const deletedSet = new Set(readLocalTombstones());
            if (Array.isArray(parsed)) return parsed.filter((p: Project) => !deletedSet.has(p.id));
          }
        } catch {}
        return [];
      }
    },
    initialData: () => {
      if (typeof window === 'undefined') return [];
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          const deletedSet = new Set(readLocalTombstones());
          if (Array.isArray(parsed)) return parsed.filter((p: Project) => !deletedSet.has(p.id));
        }
      } catch {}
      return [];
    },
    initialDataUpdatedAt: 0,
    enabled,
    staleTime: 1000,
    refetchOnWindowFocus: true,
    refetchIntervalInBackground: false,
  }, queryClient);

  const addProjectMut = useMutation({
    mutationFn: (newProject: Project) => addRow('PROJECTS', newProject),
    onMutate: async (newProject: Project) => {
      await queryClient.cancelQueries({ queryKey: ['PROJECTS'] });
      const previous = queryClient.getQueryData<Project[]>(['PROJECTS']);
      const next = [newProject, ...(previous || [])];
      queryClient.setQueryData<Project[]>(['PROJECTS'], next);
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
      return { previous };
    },
    onError: (err, newProject, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['PROJECTS'], context.previous);
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(context.previous)); } catch {}
      }
    },
    onSettled: () => {
      if (queryClient.getDefaultOptions().queries?.gcTime !== 0) {
        queryClient.invalidateQueries({ queryKey: ['PROJECTS'] });
      }
    }
  }, queryClient);

  const updateProjectMut = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Project> }) =>
      updateRow('PROJECTS', id, updates),
    onMutate: async ({ id, updates }) => {
      await queryClient.cancelQueries({ queryKey: ['PROJECTS'] });
      const previous = queryClient.getQueryData<Project[]>(['PROJECTS']);
      const updatedFields = { ...updates, updatedAt: new Date().toISOString() };
      const next = (previous || []).map(p => p.id === id ? { ...p, ...updatedFields } : p);
      queryClient.setQueryData<Project[]>(['PROJECTS'], next);
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
      return { previous };
    },
    onError: (err, vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['PROJECTS'], context.previous);
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(context.previous)); } catch {}
      }
    },
    onSettled: () => {
      if (queryClient.getDefaultOptions().queries?.gcTime !== 0) {
        queryClient.invalidateQueries({ queryKey: ['PROJECTS'] });
      }
    }
  }, queryClient);

  const deleteProjectMut = useMutation({
    mutationFn: (id: string) => deleteRow('PROJECTS', id),
    onMutate: async (id: string) => {
      recordLocalTombstone(id);
      await queryClient.cancelQueries({ queryKey: ['PROJECTS'] });
      const previous = queryClient.getQueryData<Project[]>(['PROJECTS']);
      const next = (previous || []).filter(p => p.id !== id);
      queryClient.setQueryData<Project[]>(['PROJECTS'], next);
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
      return { previous };
    },
    onError: (err, id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['PROJECTS'], context.previous);
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(context.previous)); } catch {}
      }
    },
    onSettled: () => {
      if (queryClient.getDefaultOptions().queries?.gcTime !== 0) {
        queryClient.invalidateQueries({ queryKey: ['PROJECTS'] });
      }
    }
  }, queryClient);

  // Pre-indexed O(1) lookup Map for projects by ID
  const projectsByIdMap = useMemo(() => {
    const map = new Map<string, Project>();
    for (const p of projects) {
      map.set(p.id, p);
    }
    return map;
  }, [projects]);

  const addProject = useCallback((project: Omit<Project, 'id' | 'createdAt' | 'updatedAt' | 'checklistItems'>) => {
    const now = new Date().toISOString();
    const newProject: Project = { ...project, id: generateId(), checklistItems: [], createdAt: now, updatedAt: now };
    addProjectMut.mutate(newProject);
    return newProject;
  }, [addProjectMut]);

  const updateProject = useCallback((id: string, updates: Partial<Project>) => {
    updateProjectMut.mutate({ id, updates });
  }, [updateProjectMut]);

  const deleteProject = useCallback((id: string) => {
    deleteProjectMut.mutate(id);
    
    // CASCADE DELETE: Delete associated tasks and invalidate ['TASKS']
    import('@/lib/sheets-api').then(({ readSheet: readTasksSheet, deleteRow: deleteTaskRow }) => {
      readTasksSheet<import('@/types').Task>('TASKS').then(tasks => {
        const tasksToDelete: import('@/types').Task[] = [];
        for (let i = 0; i < tasks.length; i++) {
          if (tasks[i].projectId === id) tasksToDelete.push(tasks[i]);
        }
        if (tasksToDelete.length > 0) {
          Promise.all(tasksToDelete.map(t => deleteTaskRow('TASKS', t.id))).then(() => {
            queryClient.invalidateQueries({ queryKey: ['TASKS'] });
          }).catch(err => console.error('Cascade delete tasks failed:', err));
        }
      }).catch(err => console.error('Failed to read TASKS for cascade delete:', err));
    });
  }, [deleteProjectMut, queryClient]);

  const addChecklistItem = useCallback((projectId: string, text: string) => {
    const item: ChecklistItem = { id: generateId(), text, completed: false };
    const project = projectsByIdMap.get(projectId);
    if (project) {
      const updatedChecklist = [...(project.checklistItems || []), item];
      updateProject(projectId, { checklistItems: updatedChecklist });
    }
    return item;
  }, [projectsByIdMap, updateProject]);

  const toggleChecklistItem = useCallback((projectId: string, itemId: string) => {
    const project = projectsByIdMap.get(projectId);
    if (project && project.checklistItems) {
      const updatedChecklist = project.checklistItems.map(it =>
        it.id === itemId ? { ...it, completed: !it.completed } : it
      );
      updateProject(projectId, { checklistItems: updatedChecklist });
    }
  }, [projectsByIdMap, updateProject]);

  const deleteChecklistItem = useCallback((projectId: string, itemId: string) => {
    const project = projectsByIdMap.get(projectId);
    if (project && project.checklistItems) {
      const updatedChecklist = project.checklistItems.filter(it => it.id !== itemId);
      updateProject(projectId, { checklistItems: updatedChecklist });
    }
  }, [projectsByIdMap, updateProject]);

  const getProjectProgress = useCallback((projectId: string) => {
    const project = projectsByIdMap.get(projectId);
    if (!project || !project.checklistItems || project.checklistItems.length === 0) return 0;
    let completed = 0;
    const items = project.checklistItems;
    for (let i = 0; i < items.length; i++) {
      if (items[i].completed) completed++;
    }
    return Math.round((completed / items.length) * 100);
  }, [projectsByIdMap]);

  const getProjectById = useCallback((id: string) => {
    return projectsByIdMap.get(id);
  }, [projectsByIdMap]);

  return { projects, addProject, updateProject, deleteProject, addChecklistItem, toggleChecklistItem, deleteChecklistItem, getProjectProgress, getProjectById };
}

