'use client';

/**
 * VITAL Work & Wealth Architecture — Weekly Report Controller Hook
 * Module: src/hooks/useWeeklyReport.ts
 * Standards: Rule 1 (M-V-C Controller Isolation), Rule G (HWPX Standard), Rule M (개조식)
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import type { WeeklyReportDto } from '@/lib/schemas';
import {
  type WednesdayBatchPeriods,
  computeWednesdayBatchPeriods,
  groupWeeklyItemsByProject,
  type WeeklyProjectBlock,
} from '@/lib/weekly/wednesday-batcher';

export interface UseWeeklyReportOptions {
  /** Initial selected date string (YYYY-MM-DD) */
  initialDate?: string;
  /** Automatically fetch report on date change (default: true) */
  autoFetch?: boolean;
  /** Callback fired after successful report save */
  onSignalAdded?: (text: string) => void;
}

export interface UseWeeklyReportReturn {
  // Date & Periods
  selectedDate: string;
  setSelectedDate: (date: string) => void;
  periods: WednesdayBatchPeriods;
  shiftWeek: (offsetDays: number) => void;

  // Report Data
  currentReport: WeeklyReportDto | null;
  setCurrentReport: React.Dispatch<React.SetStateAction<WeeklyReportDto | null>>;
  allReports: WeeklyReportDto[];
  perfBlocks: WeeklyProjectBlock[];
  planBlocks: WeeklyProjectBlock[];

  // Loading & Error States
  loading: boolean;
  isLoading: boolean;
  error: string | null;
  statusMessage: string | null;
  setStatusMessage: (msg: string | null) => void;
  isAggregating: boolean;
  isSaving: boolean;
  isGeneratingHwpx: boolean;
  isDownloading: boolean;

  // Actions
  fetchReport: (targetWed: string) => Promise<WeeklyReportDto | null>;
  aggregateReport: (targetDate?: string) => Promise<WeeklyReportDto | null>;
  aggregateFromTasks: (targetDate?: string) => Promise<WeeklyReportDto | null>;
  saveReport: (reportToSave?: WeeklyReportDto) => Promise<boolean>;
  generateHwpx: (reportToDownload?: WeeklyReportDto) => Promise<Blob | null>;
  downloadHwpx: (reportToDownload?: WeeklyReportDto) => Promise<Blob | null>;
}

export function useWeeklyReport(options?: UseWeeklyReportOptions): UseWeeklyReportReturn {
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    return options?.initialDate || new Date().toISOString().split('T')[0];
  });

  const [currentReport, setCurrentReport] = useState<WeeklyReportDto | null>(null);
  const [allReports, setAllReports] = useState<WeeklyReportDto[]>([]);

  const [isLoading, setIsLoading] = useState(false);
  const [isAggregating, setIsAggregating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const autoFetch = options?.autoFetch ?? true;

  const periods: WednesdayBatchPeriods = useMemo(() => {
    try {
      return computeWednesdayBatchPeriods(selectedDate);
    } catch {
      return computeWednesdayBatchPeriods(new Date().toISOString().split('T')[0]);
    }
  }, [selectedDate]);

  const fetchReport = useCallback(async (targetWed: string): Promise<WeeklyReportDto | null> => {
    setIsLoading(true);
    setStatusMessage(null);
    setError(null);
    try {
      const res = await fetch(`/api/weekly-report?date=${targetWed}`);
      if (!res.ok) throw new Error('서버 응답 오류');
      const data = await res.json();
      if (data && data.success && data.currentReport) {
        setCurrentReport(data.currentReport);
        if (data.allReports) setAllReports(data.allReports);
        return data.currentReport;
      }
      return null;
    } catch (err: any) {
      const msg = err?.message || '보고서 데이터 로드 실패';
      setError(msg);
      setStatusMessage('보고서 데이터 로드 실패');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (autoFetch && periods.targetWednesday) {
      fetchReport(periods.targetWednesday);
    }
  }, [autoFetch, periods.targetWednesday, fetchReport]);

  const shiftWeek = useCallback((offsetDays: number) => {
    const current = new Date(`${periods.targetWednesday}T00:00:00Z`);
    current.setUTCDate(current.getUTCDate() + offsetDays);
    setSelectedDate(current.toISOString().split('T')[0]);
  }, [periods.targetWednesday]);

  const { perfBlocks, planBlocks } = useMemo(() => {
    if (!currentReport || !currentReport.items) {
      return { perfBlocks: [], planBlocks: [] };
    }
    const grouped = groupWeeklyItemsByProject(currentReport.items);
    return { perfBlocks: grouped.performance, planBlocks: grouped.plan };
  }, [currentReport]);

  const aggregateReport = useCallback(async (targetDate?: string): Promise<WeeklyReportDto | null> => {
    const dateToAggregate = targetDate || periods.targetWednesday;
    setIsLoading(true);
    setIsAggregating(true);
    setStatusMessage(null);
    setError(null);
    try {
      const res = await fetch('/api/weekly-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'aggregate', date: dateToAggregate }),
      });
      const data = await res.json();
      if (data && data.success && data.report) {
        setCurrentReport(data.report);
        setStatusMessage('TASKS 실적 · 계획 자동 집계 완료');
        return data.report;
      }
      return null;
    } catch (err: any) {
      const msg = err?.message || '태스크 집계 오류 발생';
      setError(msg);
      setStatusMessage('태스크 집계 오류 발생');
      return null;
    } finally {
      setIsLoading(false);
      setIsAggregating(false);
    }
  }, [periods.targetWednesday]);

  const saveReport = useCallback(async (reportToSave?: WeeklyReportDto): Promise<boolean> => {
    const target = reportToSave || currentReport;
    if (!target) return false;
    setIsLoading(true);
    setIsSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/weekly-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save-report', report: target }),
      });
      const data = await res.json();
      if (data && data.success) {
        setStatusMessage('주간업무 보고서 저장 완료');
        options?.onSignalAdded?.(
          `[주간보고 저장] ${target.reportDate} (실적 ${perfBlocks.length}건, 계획 ${planBlocks.length}건)`
        );
        return true;
      }
      return false;
    } catch (err: any) {
      const msg = err?.message || '저장 중 오류 발생';
      setError(msg);
      setStatusMessage('저장 중 오류 발생');
      return false;
    } finally {
      setIsLoading(false);
      setIsSaving(false);
    }
  }, [currentReport, options, perfBlocks.length, planBlocks.length]);

  const generateHwpx = useCallback(async (reportToDownload?: WeeklyReportDto): Promise<Blob | null> => {
    const target = reportToDownload || currentReport;
    if (!target) return null;
    setIsDownloading(true);
    setStatusMessage(null);
    setError(null);
    try {
      const res = await fetch('/api/weekly-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate-hwpx', report: target }),
      });
      if (!res.ok) throw new Error('HWPX 생성 오류');
      const blob = await res.blob();

      if (typeof window !== 'undefined' && window.URL && document) {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `(${periods.targetWednesday.replace(/-/g, '')}) 보건소 주간 업무실적 및 계획(건강증진팀)_신체활동.hwpx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      }
      return blob;
    } catch (err: any) {
      const msg = err?.message || 'HWPX 다운로드 실패';
      setError(msg);
      setStatusMessage('HWPX 다운로드 실패');
      return null;
    } finally {
      setIsDownloading(false);
    }
  }, [currentReport, periods.targetWednesday]);

  return {
    selectedDate,
    setSelectedDate,
    periods,
    shiftWeek,
    currentReport,
    setCurrentReport,
    allReports,
    perfBlocks,
    planBlocks,
    loading: isLoading,
    isLoading,
    error,
    statusMessage,
    setStatusMessage,
    isAggregating,
    isSaving,
    isGeneratingHwpx: isDownloading,
    isDownloading,
    fetchReport,
    aggregateReport,
    aggregateFromTasks: aggregateReport,
    saveReport,
    generateHwpx,
    downloadHwpx: generateHwpx,
  };
}
