'use client';

import React, { useState, useCallback } from 'react';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  Plus,
  RefreshCw,
  CheckCircle2,
  Building2,
  User,
  Sparkles,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { WeeklyWorkItemDto } from '@/lib/schemas';
import { useWeeklyReport } from '@/hooks/useWeeklyReport';

interface WeeklyReportManagerProps {
  initialDate?: string;
  onSignalAdded?: (text: string) => void;
}

export default function WeeklyReportManager({
  initialDate,
  onSignalAdded,
}: WeeklyReportManagerProps) {
  // 1. Weekly Report Controller Hook
  const {
    selectedDate,
    setSelectedDate,
    periods,
    shiftWeek: handleShiftWeek,
    currentReport,
    setCurrentReport,
    perfBlocks,
    planBlocks,
    isLoading,
    isDownloading,
    statusMessage,
    setStatusMessage,
    aggregateReport,
    saveReport,
    downloadHwpx,
  } = useWeeklyReport({
    initialDate,
    onSignalAdded,
  });

  const handleAggregateFromTasks = useCallback(async () => {
    await aggregateReport();
  }, [aggregateReport]);

  const handleSaveReport = useCallback(async () => {
    await saveReport();
  }, [saveReport]);

  const [activeMobileTab, setActiveMobileTab] = useState<'both' | 'performance' | 'plan'>('both');

  // New item modal/inline state
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [newItemStatus, setNewItemStatus] = useState<'performance' | 'plan'>('performance');
  const [newItemOrder, setNewItemOrder] = useState<number>(8);
  const [newItemProject, setNewItemProject] = useState<string>('서울체력장 강남센터');
  const [newItemPeriod, setNewItemPeriod] = useState<string>('');
  const [newItemTarget, setNewItemTarget] = useState<string>('');
  const [newItemLocation, setNewItemLocation] = useState<string>('');
  const [newItemContent, setNewItemContent] = useState<string>('');
  const [newItemMetrics, setNewItemMetrics] = useState<string>('');

  // Download HWPX
  const handleDownloadHwpx = async () => {
    if (!currentReport) return;
    const blob = await downloadHwpx();
    if (blob) {
      setStatusMessage('✅ 표준 2단 대조 HWPX 다운로드 완료');
    }
  };

  // Add Item to current report
  const handleAddItem = () => {
    if (!currentReport) return;
    const newItem: WeeklyWorkItemDto = {
      id: `item-${Date.now()}`,
      projectOrder: newItemOrder,
      projectName: newItemProject,
      period: newItemPeriod || (newItemStatus === 'performance' ? periods.performanceLabel : periods.planLabel),
      target: newItemTarget || undefined,
      location: newItemLocation || undefined,
      contents: newItemContent ? [newItemContent] : ['신체활동 추진 업무'],
      metrics: newItemMetrics || undefined,
      status: newItemStatus,
    };

    setCurrentReport({
      ...currentReport,
      items: [...currentReport.items, newItem],
      updatedAt: new Date().toISOString(),
    });

    setShowAddModal(false);
    setNewItemContent('');
    setNewItemMetrics('');
    setNewItemTarget('');
    setNewItemLocation('');
  };

  // Delete Item
  const handleDeleteItem = (itemId: string) => {
    if (!currentReport) return;
    setCurrentReport({
      ...currentReport,
      items: currentReport.items.filter((it) => it.id !== itemId),
      updatedAt: new Date().toISOString(),
    });
  };

  return (
    <div className="w-full max-w-md mx-auto sm:max-w-4xl px-3 py-4 space-y-4">
      {/* 1. Header Card (Rule S: Mobile-first 448px compliant) */}
      <div className="bg-slate-900 text-white rounded-2xl p-4 shadow-xl border border-slate-800">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-600/30 rounded-lg text-blue-400">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight">주간업무 실적 · 계획</h2>
              <p className="text-xs text-slate-400">공공 표준 2단 대조 HWPX 자동 빌더</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-950/60 px-2.5 py-1 rounded-full border border-emerald-800/60">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>0-Overlap</span>
          </div>
        </div>

        {/* Wednesday Cycle Date Picker */}
        <div className="bg-slate-800/80 rounded-xl p-3 border border-slate-700/60 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-300 font-medium flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-blue-400" />
              보고 기준일 (매주 수요일)
            </span>
            <span className="text-xs font-mono font-semibold text-blue-300">
              {periods.targetWednesday}
            </span>
          </div>

          <div className="flex items-center justify-between gap-1">
            <button
              onClick={() => handleShiftWeek(-7)}
              className="p-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-200 transition-colors"
              title="이전 주 수요일"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-slate-900 border border-slate-700 text-xs text-white rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 text-center font-mono"
            />

            <button
              onClick={() => handleShiftWeek(7)}
              className="p-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-200 transition-colors"
              title="다음 주 수요일"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Periods Preview Badge */}
          <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 border-t border-slate-700/60">
            <div className="bg-blue-950/40 border border-blue-800/40 rounded p-1.5">
              <span className="text-blue-300 block font-semibold">금주 실적 기간</span>
              <span className="text-slate-200 font-mono">{periods.performanceLabel}</span>
            </div>
            <div className="bg-purple-950/40 border border-purple-800/40 rounded p-1.5">
              <span className="text-purple-300 block font-semibold">차주 계획 기간</span>
              <span className="text-slate-200 font-mono">{periods.planLabel}</span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-3 gap-2 mt-3">
          <button
            onClick={handleAggregateFromTasks}
            disabled={isLoading}
            className="flex items-center justify-center gap-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs py-2 px-2 rounded-xl font-medium transition-colors text-slate-200"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>태스크 집계</span>
          </button>

          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center justify-center gap-1 bg-blue-600 hover:bg-blue-500 text-xs py-2 px-2 rounded-xl font-medium transition-colors text-white shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>항목 추가</span>
          </button>

          <button
            onClick={handleDownloadHwpx}
            disabled={isDownloading || !currentReport}
            className="flex items-center justify-center gap-1 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-xs py-2 px-2 rounded-xl font-medium transition-colors duration-150 text-white shadow-sm"
          >
            <Download className={`w-3.5 h-3.5 ${isDownloading ? 'animate-bounce' : ''}`} />
            <span>HWPX 다운</span>
          </button>
        </div>

        {statusMessage && (
          <div className="mt-2 text-xs text-center text-blue-300 bg-blue-950/60 py-1 px-2 rounded border border-blue-800/50">
            {statusMessage}
          </div>
        )}
      </div>

      {/* 2. Public Administration Department Strip (Table 0 Replica) */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-3 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <Building2 className="w-4 h-4 text-slate-600" />
          <span className="font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
            ❚ {currentReport?.departmentName || '보건행정과'}
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-slate-700">
          <User className="w-3.5 h-3.5 text-slate-500" />
          <span className="font-semibold">{currentReport?.teamTitle || '건강증진팀장 김지영'}</span>
        </div>
      </div>

      {/* 3. Mobile View Switcher (Visible on mobile only) */}
      <div className="flex sm:hidden bg-slate-100 p-1 rounded-xl text-xs font-medium">
        <button
          onClick={() => setActiveMobileTab('both')}
          className={`flex-1 py-1.5 rounded-lg transition-colors ${
            activeMobileTab === 'both' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-600'
          }`}
        >
          2단 전체보기
        </button>
        <button
          onClick={() => setActiveMobileTab('performance')}
          className={`flex-1 py-1.5 rounded-lg transition-colors ${
            activeMobileTab === 'performance' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600'
          }`}
        >
          실적 ({perfBlocks.length})
        </button>
        <button
          onClick={() => setActiveMobileTab('plan')}
          className={`flex-1 py-1.5 rounded-lg transition-colors ${
            activeMobileTab === 'plan' ? 'bg-purple-600 text-white shadow-sm' : 'text-slate-600'
          }`}
        >
          계획 ({planBlocks.length})
        </button>
      </div>

      {/* 4. Two-Column Comparative Table (Table 1 Replica) */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {/* Table 1 Header Row (Row 0) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-slate-200 bg-slate-50 border-b border-slate-200 text-center font-bold text-xs">
          {/* Performance Column Header */}
          {(activeMobileTab === 'both' || activeMobileTab === 'performance') && (
            <div className="p-3 bg-blue-50/60">
              <span className="text-sm font-extrabold text-slate-900 block">업무실적</span>
              <span className="text-xs text-blue-700 font-medium font-mono">
                {periods.performanceLabel}
              </span>
            </div>
          )}

          {/* Plan Column Header */}
          {(activeMobileTab === 'both' || activeMobileTab === 'plan') && (
            <div className="p-3 bg-purple-50/60">
              <span className="text-sm font-extrabold text-slate-900 block">업무계획</span>
              <span className="text-xs text-purple-700 font-medium font-mono">
                {periods.planLabel}
              </span>
            </div>
          )}
        </div>

        {/* Table 1 Content Row (Row 1) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-slate-200">
          {/* Left Column: Performance Actuals */}
          {(activeMobileTab === 'both' || activeMobileTab === 'performance') && (
            <div className="p-3.5 space-y-4">
              {perfBlocks.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-400">
                  등록 업무 실적 없음
                </div>
              ) : (
                perfBlocks.map((block, idx) => (
                  <div
                    key={`perf-${block.projectOrder}-${idx}`}
                    className="group border border-slate-100 bg-slate-50/50 hover:bg-slate-50 p-2.5 rounded-xl transition-colors space-y-1 text-xs"
                  >
                    {/* Project Title (12pt Bold Blue #0000FF replica) */}
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-blue-700 text-sm">
                        {block.projectName.startsWith(`${block.projectOrder}.`)
                          ? block.projectName
                          : `${block.projectOrder}. ${block.projectName}`}
                      </h4>
                      <button
                        onClick={() => {
                          const item = currentReport?.items.find(
                            (it) => it.projectName === block.projectName && it.status === 'performance'
                          );
                          if (item) handleDeleteItem(item.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 p-1 transition-opacity"
                        title="항목 삭제"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {block.period && (
                      <p className="text-slate-600 pl-1">○ 기    간 : {block.period}</p>
                    )}
                    {block.target && (
                      <p className="text-slate-600 pl-1">○ 대    상 : {block.target}</p>
                    )}
                    {block.location && (
                      <p className="text-slate-600 pl-1">○ 장    소 : {block.location}</p>
                    )}

                    {block.contents && block.contents.length > 0 && (
                      <div className="pl-1">
                        <p className="text-slate-600">○ 내    용</p>
                        {block.contents.map((c, cIdx) => (
                          <p key={cIdx} className="text-slate-700 pl-3">
                            - {c.replace(/^[-\s]+/, '')}
                          </p>
                        ))}
                      </div>
                    )}

                    {block.metrics && (
                      <p className="text-emerald-700 font-medium pl-1 bg-emerald-50/60 rounded px-1 py-0.5">
                        ○ 실    적 : {block.metrics}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {/* Right Column: Next Plan */}
          {(activeMobileTab === 'both' || activeMobileTab === 'plan') && (
            <div className="p-3.5 space-y-4">
              {planBlocks.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-400">
                  등록 업무 계획 없음
                </div>
              ) : (
                planBlocks.map((block, idx) => (
                  <div
                    key={`plan-${block.projectOrder}-${idx}`}
                    className="group border border-slate-100 bg-slate-50/50 hover:bg-slate-50 p-2.5 rounded-xl transition-colors space-y-1 text-xs"
                  >
                    {/* Project Title (12pt Bold Blue #0000FF replica) */}
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-blue-700 text-sm">
                        {block.projectName.startsWith(`${block.projectOrder}.`)
                          ? block.projectName
                          : `${block.projectOrder}. ${block.projectName}`}
                      </h4>
                      <button
                        onClick={() => {
                          const item = currentReport?.items.find(
                            (it) => it.projectName === block.projectName && it.status === 'plan'
                          );
                          if (item) handleDeleteItem(item.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 p-1 transition-opacity"
                        title="항목 삭제"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {block.period && (
                      <p className="text-slate-600 pl-1">○ 기    간 : {block.period}</p>
                    )}
                    {block.target && (
                      <p className="text-slate-600 pl-1">○ 대    상 : {block.target}</p>
                    )}
                    {block.location && (
                      <p className="text-slate-600 pl-1">○ 장    소 : {block.location}</p>
                    )}

                    {block.contents && block.contents.length > 0 && (
                      <div className="pl-1">
                        <p className="text-slate-600">○ 내    용</p>
                        {block.contents.map((c, cIdx) => (
                          <p key={cIdx} className="text-slate-700 pl-3">
                            - {c.replace(/^[-\s]+/, '')}
                          </p>
                        ))}
                      </div>
                    )}

                    {block.metrics && (
                      <p className="text-purple-700 font-medium pl-1 bg-purple-50/60 rounded px-1 py-0.5">
                        ○ 계    획 : {block.metrics}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end gap-2 pt-1">
        <button
          onClick={handleSaveReport}
          disabled={isLoading || !currentReport}
          className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold py-2 px-4 rounded-xl shadow-sm transition-colors"
        >
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          <span>보고서 내용 저장</span>
        </button>
      </div>

      {/* 5. Add Item Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-4 space-y-3 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-blue-600" />
                주간업무 추가
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 text-xs p-1"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div>
                <label className="block text-slate-600 font-medium mb-1">구분</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewItemStatus('performance')}
                    className={`py-1.5 rounded-lg border text-center font-medium ${
                      newItemStatus === 'performance'
                        ? 'bg-blue-50 border-blue-500 text-blue-700'
                        : 'border-slate-200 text-slate-600'
                    }`}
                  >
                    금주 실적
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewItemStatus('plan')}
                    className={`py-1.5 rounded-lg border text-center font-medium ${
                      newItemStatus === 'plan'
                        ? 'bg-purple-50 border-purple-500 text-purple-700'
                        : 'border-slate-200 text-slate-600'
                    }`}
                  >
                    차주 계획
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-1">
                  <label className="block text-slate-600 font-medium mb-1">순서</label>
                  <input
                    type="number"
                    value={newItemOrder}
                    onChange={(e) => setNewItemOrder(Number(e.target.value))}
                    className="w-full border border-slate-200 rounded-lg p-1.5"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-slate-600 font-medium mb-1">사업명</label>
                  <input
                    type="text"
                    value={newItemProject}
                    onChange={(e) => setNewItemProject(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg p-1.5"
                    placeholder="서울체력장 강남센터"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-600 font-medium mb-1">기간</label>
                <input
                  type="text"
                  value={newItemPeriod}
                  onChange={(e) => setNewItemPeriod(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg p-1.5"
                  placeholder={newItemStatus === 'performance' ? periods.performanceLabel : periods.planLabel}
                />
              </div>

              <div>
                <label className="block text-slate-600 font-medium mb-1">내용 (추진사항)</label>
                <textarea
                  value={newItemContent}
                  onChange={(e) => setNewItemContent(e.target.value)}
                  rows={2}
                  className="w-full border border-slate-200 rounded-lg p-1.5"
                  placeholder="과학적 체력 측정 및 개인 맞춤형 운동처방 서비스 제공"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-600 font-medium mb-1">대상</label>
                  <input
                    type="text"
                    value={newItemTarget}
                    onChange={(e) => setNewItemTarget(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg p-1.5"
                    placeholder="구민, 직장인"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-medium mb-1">장소</label>
                  <input
                    type="text"
                    value={newItemLocation}
                    onChange={(e) => setNewItemLocation(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg p-1.5"
                    placeholder="보건소 체력측정실"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-600 font-medium mb-1">수치 실적 / 목표</label>
                <input
                  type="text"
                  value={newItemMetrics}
                  onChange={(e) => setNewItemMetrics(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg p-1.5"
                  placeholder="금주 측정 48명 / 누계 1,280명"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="py-1.5 px-3 rounded-lg border border-slate-200 text-slate-600 text-xs"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleAddItem}
                className="py-1.5 px-3 rounded-lg bg-blue-600 text-white font-medium text-xs hover:bg-blue-500"
              >
                추가 완료
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
