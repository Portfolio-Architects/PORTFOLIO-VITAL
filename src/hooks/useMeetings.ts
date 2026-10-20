'use client';

import { useCallback, useMemo } from 'react';
import { useGoogleSheet, useSheetCrud } from './useGoogleSheet';
import { Meeting, generateId } from '@/types';

export function useMeetings(options?: { enabled?: boolean }) {
  const enabled = options?.enabled ?? true;
  const [meetings, setMeetings] = useGoogleSheet<Meeting>('MEETINGS', 'hchps-meetings', [], enabled);
  const { syncAdd, syncUpdate, syncDelete } = useSheetCrud<Meeting>('MEETINGS');

  // Pre-indexed O(1) lookup Map for meetings by ID
  const meetingsByIdMap = useMemo(() => {
    const map = new Map<string, Meeting>();
    for (const m of meetings) {
      map.set(m.id, m);
    }
    return map;
  }, [meetings]);

  const addMeeting = useCallback((meeting: Omit<Meeting, 'id' | 'createdAt' | 'updatedAt'>) => {
    const now = new Date().toISOString();
    const newMeeting: Meeting = { ...meeting, id: generateId(), createdAt: now, updatedAt: now };
    setMeetings(prev => [newMeeting, ...prev]);
    syncAdd(newMeeting);
    return newMeeting;
  }, [setMeetings, syncAdd]);

  const updateMeeting = useCallback((id: string, updates: Partial<Meeting>) => {
    const updatedFields = { ...updates, updatedAt: new Date().toISOString() };
    setMeetings(prev => {
      const next: Meeting[] = new Array(prev.length);
      for (let i = 0; i < prev.length; i++) {
        const m = prev[i];
        next[i] = m.id === id ? { ...m, ...updatedFields } : m;
      }
      return next;
    });
    syncUpdate(id, updatedFields);
  }, [setMeetings, syncUpdate]);

  const deleteMeeting = useCallback((id: string) => {
    setMeetings(prev => {
      const next: Meeting[] = [];
      for (let i = 0; i < prev.length; i++) {
        if (prev[i].id !== id) next.push(prev[i]);
      }
      return next;
    });
    syncDelete(id);
  }, [setMeetings, syncDelete]);

  const getUpcomingMeetings = useCallback((limit: number = 5) => {
    const nowTime = Date.now();
    const upcoming: { meeting: Meeting; time: number }[] = [];
    for (let i = 0; i < meetings.length; i++) {
      const m = meetings[i];
      const time = Date.parse(m.datetime) || 0;
      if (time >= nowTime) {
        upcoming.push({ meeting: m, time });
      }
    }
    upcoming.sort((a, b) => a.time - b.time);
    const resultCount = Math.min(limit, upcoming.length);
    const result: Meeting[] = new Array(resultCount);
    for (let i = 0; i < resultCount; i++) {
      result[i] = upcoming[i].meeting;
    }
    return result;
  }, [meetings]);

  const getTodayMeetings = useCallback(() => {
    const today = new Date().toISOString().slice(0, 10);
    const result: Meeting[] = [];
    for (let i = 0; i < meetings.length; i++) {
      const m = meetings[i];
      if (m.datetime && m.datetime.startsWith(today)) {
        result.push(m);
      }
    }
    return result;
  }, [meetings]);

  const getMeetingById = useCallback((id: string) => {
    return meetingsByIdMap.get(id);
  }, [meetingsByIdMap]);

  return { meetings, addMeeting, updateMeeting, deleteMeeting, getUpcomingMeetings, getTodayMeetings, getMeetingById };
}

