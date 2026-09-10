'use client';

import { useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { readSheet, addRow, updateRow, deleteRow } from '@/lib/sheets-api';
import { Task, TaskStatus, TaskPriority, generateId } from '@/types';
import { isHoliday } from '@/lib/holidays';

const WEEKDAYS_MAP: Record<string, number> = { '일': 0, '월': 1, '화': 2, '수': 3, '목': 4, '금': 5, '토': 6 };
const adjustedDay = (d: number) => (d === 0 ? 6 : d - 1); // Mon=0, Sun=6

function formatYMD(nextDate: Date) {
  const y = nextDate.getFullYear();
  const m = String(nextDate.getMonth() + 1).padStart(2, '0');
  const d = String(nextDate.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function calculateNextDueDate(currentDueDate?: string, recurrence?: string): string | undefined {
  if (!recurrence) return currentDueDate;
  
  const baseDate = currentDueDate ? new Date(currentDueDate) : new Date();
  
  if (recurrence === '매일') {
    const nextDate = new Date(baseDate);
    do {
      nextDate.setDate(nextDate.getDate() + 1);
    } while (isHoliday(nextDate));
    return formatYMD(nextDate);
  }

  if (recurrence.startsWith('매주 ') || recurrence.startsWith('격주 ')) {
    const isBiweekly = recurrence.startsWith('격주 ');
    const daysStr = recurrence.replace(isBiweekly ? '격주 ' : '매주 ', '');
    const allowedDays = daysStr.split(', ').map(d => d.replace('요일', '')); 
    const allowedIndices = allowedDays.map(d => WEEKDAYS_MAP[d]).filter(i => i !== undefined);
    
    if (allowedIndices.length > 0) {
      const nextDate = new Date(baseDate);
      let baseAdjDay = adjustedDay(baseDate.getDay());
      let weeksSkipped = false;
      
      while (true) {
        nextDate.setDate(nextDate.getDate() + 1);
        let currAdjDay = adjustedDay(nextDate.getDay());
        
        // If we wrap around to a new week
        if (currAdjDay < baseAdjDay) {
          if (isBiweekly && !weeksSkipped) {
            nextDate.setDate(nextDate.getDate() + 7); // Skip one week
            weeksSkipped = true;
            currAdjDay = adjustedDay(nextDate.getDay());
          }
          baseAdjDay = -1; // reset base so we don't skip again in this loop
        }
        
        if (allowedIndices.includes(nextDate.getDay())) {
          if (!isHoliday(nextDate)) {
            return formatYMD(nextDate);
          }
        }
      }
    }
  }

  // Monthly or simple weekly fallback
  const nextDate = new Date(baseDate);
  if (recurrence.includes('월') || recurrence.includes('달')) {
    nextDate.setMonth(nextDate.getMonth() + 1);
    while (isHoliday(nextDate)) nextDate.setDate(nextDate.getDate() + 1);
  } else {
    nextDate.setDate(nextDate.getDate() + 7);
    while (isHoliday(nextDate)) nextDate.setDate(nextDate.getDate() + 1);
  }
  
  return formatYMD(nextDate);
}

export function useTasks() {
  const queryClient = useQueryClient();

  const { data: tasks = [], isLoading, error } = useQuery({
    queryKey: ['TASKS'],
    queryFn: () => readSheet<Task>('TASKS'),
    staleTime: 1000,
    refetchOnWindowFocus: true,
    refetchIntervalInBackground: false,
  });

  const addTaskMut = useMutation({
    mutationFn: (newTask: Task) => addRow('TASKS', newTask),
    onMutate: async (newTask) => {
      await queryClient.cancelQueries({ queryKey: ['TASKS'] });
      const previousTasks = queryClient.getQueryData<Task[]>(['TASKS']);
      queryClient.setQueryData<Task[]>(['TASKS'], (old) => [newTask, ...(old || [])]);
      return { previousTasks };
    },
    onError: (err, newTask, context) => {
      if (context?.previousTasks) queryClient.setQueryData(['TASKS'], context.previousTasks);
    },
    onSettled: () => {
      if (queryClient.getDefaultOptions().queries?.gcTime !== 0) {
        queryClient.invalidateQueries({ queryKey: ['TASKS'] });
      }
    }
  });

  const updateTaskMut = useMutation({
    mutationFn: ({ id, updates }: { id: string, updates: Partial<Task> }) => updateRow('TASKS', id, updates),
    onMutate: async ({ id, updates }) => {
      await queryClient.cancelQueries({ queryKey: ['TASKS'] });
      const previousTasks = queryClient.getQueryData<Task[]>(['TASKS']);
      
      const updatedFields = { ...updates, updatedAt: new Date().toISOString() };
      queryClient.setQueryData<Task[]>(['TASKS'], (old) => 
        (old || []).map(t => t.id === id ? { ...t, ...updatedFields } : t)
      );
      
      return { previousTasks };
    },
    onError: (err, variables, context) => {
      if (context?.previousTasks) queryClient.setQueryData(['TASKS'], context.previousTasks);
    },
    onSettled: () => {
      if (queryClient.getDefaultOptions().queries?.gcTime !== 0) {
        queryClient.invalidateQueries({ queryKey: ['TASKS'] });
      }
    }
  });

  const deleteTaskMut = useMutation({
    mutationFn: (id: string) => deleteRow('TASKS', id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['TASKS'] });
      const previousTasks = queryClient.getQueryData<Task[]>(['TASKS']);
      queryClient.setQueryData<Task[]>(['TASKS'], (old) => (old || []).filter(t => t.id !== id));
      return { previousTasks };
    },
    onError: (err, id, context) => {
      if (context?.previousTasks) queryClient.setQueryData(['TASKS'], context.previousTasks);
    },
    onSettled: () => {
      if (queryClient.getDefaultOptions().queries?.gcTime !== 0) {
        queryClient.invalidateQueries({ queryKey: ['TASKS'] });
      }
    }
  });

  // Pre-indexed O(1) lookup Map for tasks by ID
  const tasksByIdMap = useMemo(() => {
    const map = new Map<string, Task>();
    for (const t of tasks) {
      map.set(t.id, t);
    }
    return map;
  }, [tasks]);

  const addTask = useCallback((taskPayload: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) => {
    const now = new Date().toISOString();
    const newTask: Task = { ...taskPayload, id: generateId(), createdAt: now, updatedAt: now };
    addTaskMut.mutate(newTask);
    return newTask;
  }, [addTaskMut]);

  const updateTask = useCallback(async (id: string, updates: Partial<Task>) => {
    const task = tasksByIdMap.get(id);

    if (task && updates.status === 'done' && task.status !== 'done' && task.recurrence) {
      const nextDate = calculateNextDueDate(task.dueDate, task.recurrence);
      
      let shouldDuplicate = true;
      if (nextDate && task.recurrenceEndDate) {
        if (new Date(nextDate) > new Date(task.recurrenceEndDate)) {
          shouldDuplicate = false;
        }
      }

      if (shouldDuplicate) {
        const nextTaskPayload = {
          title: task.title,
          description: task.description,
          status: 'todo' as TaskStatus,
          priority: task.priority,
          category: task.category,
          dueDate: nextDate,
          projectId: task.projectId,
          tags: [...task.tags],
          recurrence: task.recurrence,
          recurrenceStartDate: task.recurrenceStartDate,
          recurrenceEndDate: task.recurrenceEndDate,
          recurrenceCount: task.recurrenceCount
        };
        const now = new Date().toISOString();
        const nextTask: Task = { ...nextTaskPayload, id: generateId(), createdAt: now, updatedAt: now };
        
        try {
          // Serialized mutation chain to prevent queryClient race conditions
          await addTaskMut.mutateAsync(nextTask);
        } catch (err) {
          console.error('[Concurrency Error] Failed to auto-duplicate recurring task:', err);
        }
      }
    }

    updateTaskMut.mutate({ id, updates });
  }, [tasksByIdMap, updateTaskMut, addTaskMut]);

  const deleteTask = useCallback((id: string) => {
    deleteTaskMut.mutate(id);
  }, [deleteTaskMut]);

  const moveTask = useCallback((id: string, status: TaskStatus) => {
    updateTask(id, { status });
  }, [updateTask]);

  const stats = useMemo(() => {
    let todo = 0, inProgress = 0, done = 0;
    const total = tasks.length;
    for (let i = 0; i < total; i++) {
      const t = tasks[i];
      if (t.status === 'todo') todo++;
      else if (t.status === 'in-progress') inProgress++;
      else if (t.status === 'done') done++;
    }
    return { total, todo, inProgress, done, overdue: 0, completionRate: total > 0 ? Math.round((done / total) * 100) : 0 };
  }, [tasks]);

  const filterTasks = useCallback((filters: { status?: TaskStatus; priority?: TaskPriority; category?: string; search?: string; projectId?: string }) => {
    const { status, priority, category, projectId, search } = filters;
    const searchLower = search ? search.toLowerCase().trim() : '';

    if (!status && !priority && !category && !projectId && !searchLower) {
      return tasks;
    }

    const result: Task[] = [];
    for (let i = 0; i < tasks.length; i++) {
      const t = tasks[i];
      if (status && t.status !== status) continue;
      if (priority && t.priority !== priority) continue;
      if (category && t.category !== category) continue;
      if (projectId && t.projectId !== projectId) continue;
      if (searchLower) {
        const titleMatch = t.title.toLowerCase().includes(searchLower);
        const descMatch = t.description ? t.description.toLowerCase().includes(searchLower) : false;
        let tagMatch = false;
        for (let j = 0; j < t.tags.length; j++) {
          if (t.tags[j].toLowerCase().includes(searchLower)) {
            tagMatch = true;
            break;
          }
        }
        if (!titleMatch && !descMatch && !tagMatch) continue;
      }
      result.push(t);
    }
    return result;
  }, [tasks]);

  const getTaskById = useCallback((id: string) => {
    return tasksByIdMap.get(id);
  }, [tasksByIdMap]);

  return { tasks, isLoading, error, addTask, updateTask, deleteTask, moveTask, stats, filterTasks, getTaskById };
}
