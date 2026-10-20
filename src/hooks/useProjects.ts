'use client';

import { useCallback, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useGoogleSheet, useSheetCrud } from './useGoogleSheet';
import { Project, ChecklistItem, generateId } from '@/types';

export function useProjects(options?: { enabled?: boolean }) {
  const enabled = options?.enabled ?? true;
  const queryClient = useQueryClient();
  const [projects, setProjects] = useGoogleSheet<Project>('PROJECTS', 'hchps-projects', [], enabled);
  const { syncAdd, syncUpdate, syncDelete } = useSheetCrud<Project>('PROJECTS');

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
    setProjects(prev => [newProject, ...prev]);
    syncAdd(newProject);
    return newProject;
  }, [setProjects, syncAdd]);

  const updateProject = useCallback((id: string, updates: Partial<Project>) => {
    const updatedFields = { ...updates, updatedAt: new Date().toISOString() };
    setProjects(prev => {
      const next: Project[] = [];
      for (let i = 0; i < prev.length; i++) {
        const p = prev[i];
        next.push(p.id === id ? { ...p, ...updatedFields } : p);
      }
      return next;
    });
    syncUpdate(id, updatedFields);
  }, [setProjects, syncUpdate]);

  const deleteProject = useCallback((id: string) => {
    setProjects(prev => {
      const next: Project[] = [];
      for (let i = 0; i < prev.length; i++) {
        if (prev[i].id !== id) next.push(prev[i]);
      }
      return next;
    });
    syncDelete(id);
    
    // CASCADE DELETE: Delete associated tasks
    import('@/lib/sheets-api').then(({ readSheet, deleteRow }) => {
      readSheet<import('@/types').Task>('TASKS').then(tasks => {
        const tasksToDelete: import('@/types').Task[] = [];
        for (let i = 0; i < tasks.length; i++) {
          if (tasks[i].projectId === id) tasksToDelete.push(tasks[i]);
        }
        if (tasksToDelete.length > 0) {
          Promise.all(tasksToDelete.map(t => deleteRow('TASKS', t.id))).then(() => {
            queryClient.invalidateQueries({ queryKey: ['TASKS'] });
          }).catch(err => console.error('Cascade delete tasks failed:', err));
        }
      }).catch(err => console.error('Failed to read TASKS for cascade delete:', err));
    });
  }, [setProjects, syncDelete, queryClient]);

  const addChecklistItem = useCallback((projectId: string, text: string) => {
    const item: ChecklistItem = { id: generateId(), text, completed: false };
    let updatedChecklist: ChecklistItem[] = [];
    setProjects(prev => {
      const next: Project[] = [];
      for (let i = 0; i < prev.length; i++) {
        const p = prev[i];
        if (p.id === projectId) {
          updatedChecklist = [...p.checklistItems, item];
          next.push({ ...p, checklistItems: updatedChecklist, updatedAt: new Date().toISOString() });
        } else {
          next.push(p);
        }
      }
      return next;
    });
    if (updatedChecklist.length > 0) {
      syncUpdate(projectId, { checklistItems: updatedChecklist as unknown as Project['checklistItems'], updatedAt: new Date().toISOString() });
    }
    return item;
  }, [setProjects, syncUpdate]);

  const toggleChecklistItem = useCallback((projectId: string, itemId: string) => {
    let updatedChecklist: ChecklistItem[] = [];
    setProjects(prev => {
      const next: Project[] = [];
      for (let i = 0; i < prev.length; i++) {
        const p = prev[i];
        if (p.id === projectId) {
          const list: ChecklistItem[] = [];
          for (let j = 0; j < p.checklistItems.length; j++) {
            const it = p.checklistItems[j];
            list.push(it.id === itemId ? { ...it, completed: !it.completed } : it);
          }
          updatedChecklist = list;
          next.push({ ...p, checklistItems: updatedChecklist, updatedAt: new Date().toISOString() });
        } else {
          next.push(p);
        }
      }
      return next;
    });
    if (updatedChecklist.length > 0) {
      syncUpdate(projectId, { checklistItems: updatedChecklist as unknown as Project['checklistItems'], updatedAt: new Date().toISOString() });
    }
  }, [setProjects, syncUpdate]);

  const deleteChecklistItem = useCallback((projectId: string, itemId: string) => {
    let updatedChecklist: ChecklistItem[] = [];
    setProjects(prev => {
      const next: Project[] = [];
      for (let i = 0; i < prev.length; i++) {
        const p = prev[i];
        if (p.id === projectId) {
          const list: ChecklistItem[] = [];
          for (let j = 0; j < p.checklistItems.length; j++) {
            const it = p.checklistItems[j];
            if (it.id !== itemId) list.push(it);
          }
          updatedChecklist = list;
          next.push({ ...p, checklistItems: updatedChecklist, updatedAt: new Date().toISOString() });
        } else {
          next.push(p);
        }
      }
      return next;
    });
    if (updatedChecklist.length > 0) {
      syncUpdate(projectId, { checklistItems: updatedChecklist as unknown as Project['checklistItems'], updatedAt: new Date().toISOString() });
    }
  }, [setProjects, syncUpdate]);

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
