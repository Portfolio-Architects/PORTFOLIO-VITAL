'use client';

import React, { useState, useMemo, useCallback } from 'react';
import {
  Check,
  Plus,
  Edit3,
  Save,
  X,
  Trash2,
  Search,
  RotateCcw,
  Download,
  AlertTriangle,
  FileText,
  ShieldAlert,
  Lightbulb,
  Loader2,
  Building2,
  Calendar,
  StickyNote,
} from 'lucide-react';
import type {
  ChecklistPhaseId,
  ChecklistDomain,
  ChecklistPriority,
  FestivalChecklistItem,
} from '@/hooks/useYangjaeFestival';
import type { ChecklistPlaybookTabProps } from './types';
import { CHECKLIST_PHASES, CHECKLIST_DOMAINS } from './types';

interface ChecklistFormState {
  phase: ChecklistPhaseId;
  timingLabel: string;
  domain: ChecklistDomain;
  title: string;
  priority: ChecklistPriority;
  actualDate2026: string;
  history2026: string;
  cooperationDeptsText: string;
  docRef: string;
  lessonWarning: string;
  memo: string;
}

const EMPTY_FORM: ChecklistFormState = {
  phase: 'phase1_plan',
  timingLabel: 'D-60 · 8월 말',
  domain: '기획·장소',
  title: '',
  priority: 'high',
  actualDate2026: '',
  history2026: '',
  cooperationDeptsText: '',
  docRef: '',
  lessonWarning: '',
  memo: '',
};

const PRIORITY_STYLE: Record<ChecklistPriority, { label: string; cls: string }> = {
  must: { label: '필수', cls: 'bg-rose-50 text-rose-700 border-rose-200/90' },
  high: { label: '중요', cls: 'bg-amber-50 text-amber-800 border-amber-200/90' },
  normal: { label: '일반', cls: 'bg-slate-100 text-slate-600 border-slate-200/80' },
};

const PHASE_MAP = Object.fromEntries(
  CHECKLIST_PHASES.map((p) => [p.id, p])
) as Record<ChecklistPhaseId, (typeof CHECKLIST_PHASES)[number]>;

export const ChecklistPlaybookTab: React.FC<ChecklistPlaybookTabProps> = React.memo(({
  checklist,
  historySummary,
  meta,
  editingOverview,
  editOverviewData,
  daysLeft,
  isLocalAdmin,
  isLargeFont,
  isPendingSave,
  onToggleItem,
  onAddItem,
  onUpdateItem,
  onDeleteItem,
  onResetChecks,
  onExportChecklistCsv,
  onStartEditOverview,
  onCancelEditOverview,
  onSaveOverview,
  onChangeOverviewField,
}) => {
  const [selectedPhase, setSelectedPhase] = useState<'all' | ChecklistPhaseId>('all');
  const [selectedDomain, setSelectedDomain] = useState<'전체' | ChecklistDomain>('전체');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [onlyLessons, setOnlyLessons] = useState<boolean>(false);
  const [onlyUnchecked, setOnlyUnchecked] = useState<boolean>(false);
  const [confirmReset, setConfirmReset] = useState<boolean>(false);

  const [showAddForm, setShowAddForm] = useState<boolean>(false);
  const [addForm, setAddForm] = useState<ChecklistFormState>(EMPTY_FORM);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<ChecklistFormState>(EMPTY_FORM);

  const phaseStats = useMemo(() => {
    const map: Record<ChecklistPhaseId, { total: number; done: number }> = {
      phase1_plan: { total: 0, done: 0 },
      phase2_contract: { total: 0, done: 0 },
      phase3_promo: { total: 0, done: 0 },
      phase4_onsite: { total: 0, done: 0 },
      phase5_close: { total: 0, done: 0 },
    };
    for (const item of checklist) {
      const bucket = map[item.phase];
      if (!bucket) continue;
      bucket.total += 1;
      if (item.checked) bucket.done += 1;
    }
    return map;
  }, [checklist]);

  const totalChecked = useMemo(
    () => checklist.filter((i) => i.checked).length,
    [checklist]
  );

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return checklist.filter((item) => {
      if (selectedPhase !== 'all' && item.phase !== selectedPhase) return false;
      if (selectedDomain !== '전체' && item.domain !== selectedDomain) return false;
      if (onlyLessons && !item.lessonWarning) return false;
      if (onlyUnchecked && item.checked) return false;
      if (q) {
        const hay = [
          item.title,
          item.timingLabel,
          item.domain,
          item.actualDate2026,
          item.history2026,
          item.docRef || '',
          item.lessonWarning || '',
          item.memo || '',
          ...(item.cooperationDepts || []),
        ]
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [checklist, selectedPhase, selectedDomain, onlyLessons, onlyUnchecked, searchQuery]);

  const groupedByPhase = useMemo(() => {
    const groups: { phase: (typeof CHECKLIST_PHASES)[number]; items: FestivalChecklistItem[] }[] = [];
    for (const phaseMeta of CHECKLIST_PHASES) {
      const items = filteredItems.filter((item) => item.phase === phaseMeta.id);
      if (items.length > 0) {
        groups.push({ phase: phaseMeta, items });
      }
    }
    return groups;
  }, [filteredItems]);

  const handlePhaseClick = useCallback((phaseId: ChecklistPhaseId) => {
    setSelectedPhase((prev) => (prev === phaseId ? 'all' : phaseId));
  }, []);

  const handleOpenAdd = useCallback(() => {
    setAddForm({
      ...EMPTY_FORM,
      phase: selectedPhase === 'all' ? 'phase1_plan' : selectedPhase,
    });
    setShowAddForm(true);
  }, [selectedPhase]);

  const handleSubmitAdd = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!addForm.title.trim()) return;
      onAddItem({
        phase: addForm.phase,
        timingLabel: addForm.timingLabel.trim() || '신규 시점',
        domain: addForm.domain,
        title: addForm.title.trim(),
        priority: addForm.priority,
        actualDate2026: addForm.actualDate2026.trim(),
        history2026: addForm.history2026.trim(),
        cooperationDepts: addForm.cooperationDeptsText
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        docRef: addForm.docRef.trim() || undefined,
        lessonWarning: addForm.lessonWarning.trim() || undefined,
        memo: addForm.memo.trim() || undefined,
      });
      setShowAddForm(false);
      setAddForm(EMPTY_FORM);
    },
    [addForm, onAddItem]
  );

  const handleStartEdit = useCallback((item: FestivalChecklistItem) => {
    setEditingId(item.id);
    setEditForm({
      phase: item.phase,
      timingLabel: item.timingLabel || '',
      domain: item.domain,
      title: item.title || '',
      priority: item.priority || 'normal',
      actualDate2026: item.actualDate2026 || '',
      history2026: item.history2026 || '',
      cooperationDeptsText: (item.cooperationDepts || []).join(', '),
      docRef: item.docRef || '',
      lessonWarning: item.lessonWarning || '',
      memo: item.memo || '',
    });
  }, []);

  const handleSaveEdit = useCallback(
    (id: string) => {
      if (!editForm.title.trim()) return;
      onUpdateItem(id, {
        phase: editForm.phase,
        timingLabel: editForm.timingLabel.trim(),
        domain: editForm.domain,
        title: editForm.title.trim(),
        priority: editForm.priority,
        actualDate2026: editForm.actualDate2026.trim(),
        history2026: editForm.history2026.trim(),
        cooperationDepts: editForm.cooperationDeptsText
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        docRef: editForm.docRef.trim() || undefined,
        lessonWarning: editForm.lessonWarning.trim() || undefined,
        memo: editForm.memo.trim() || undefined,
      });
      setEditingId(null);
    },
    [editForm, onUpdateItem]
  );

  const lessonsCount = useMemo(
    () => checklist.filter((i) => Boolean(i.lessonWarning)).length,
    [checklist]
  );

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
      {/* LEFT MAIN COLUMN (8/12): 5-Phase Stepper + Interactive Checklist */}
      <div className="xl:col-span-8 space-y-4 min-w-0">
        {/* 5-Phase Horizontal Stepper */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
          {CHECKLIST_PHASES.map((phase) => {
            const stat = phaseStats[phase.id];
            const pct = stat.total > 0 ? Math.round((stat.done / stat.total) * 100) : 0;
            const isActive = selectedPhase === phase.id;
            return (
              <button
                key={phase.id}
                type="button"
                onClick={() => handlePhaseClick(phase.id)}
                className={`text-left rounded-xl border p-3 transition-colors cursor-pointer flex flex-col justify-between gap-2 ${
                  isActive
                    ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                    : 'bg-white text-slate-900 border-slate-200/85 hover:border-slate-300 shadow-2xs'
                }`}
              >
                <div className="flex items-center justify-between gap-1.5">
                  <span
                    className={`text-[10.5px] font-mono tabular-nums font-bold px-1.5 py-0.5 rounded ${
                      isActive ? 'bg-slate-800 text-slate-200' : `${phase.accentBg} ${phase.accentText}`
                    }`}
                  >
                    {phase.windowLabel}
                  </span>
                  <span
                    className={`text-[11px] font-mono tabular-nums font-bold ${
                      isActive ? 'text-emerald-300' : 'text-slate-500'
                    }`}
                  >
                    {stat.done}/{stat.total}
                  </span>
                </div>
                <div>
                  <div className={`${isLargeFont ? 'text-sm' : 'text-xs'} font-extrabold tracking-tight truncate`}>
                    {phase.stepNo}. {phase.shortLabel}
                  </div>
                  <div className={`text-[10.5px] font-medium mt-0.5 ${isActive ? 'text-slate-300' : 'text-slate-400'}`}>
                    {phase.monthLabel}
                  </div>
                </div>
                <div className={`w-full h-1.5 rounded-full overflow-hidden ${isActive ? 'bg-slate-700' : 'bg-slate-100'}`}>
                  <div
                    className={`h-full rounded-full ${isActive ? 'bg-emerald-400' : phase.barClass}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </button>
            );
          })}
        </div>

        {/* Filter & Action Toolbar */}
        <div className="bg-white border border-slate-200/85 rounded-xl p-4 shadow-2xs space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2.5 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2 flex-wrap min-w-0">
              <h3 className={`${isLargeFont ? 'text-base' : 'text-sm sm:text-base'} font-extrabold text-slate-900 tracking-tight`}>
                차년도 체크리스트
              </h3>
              <span className="text-xs font-mono tabular-nums font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200/80">
                완료 {totalChecked}/{checklist.length}
              </span>
              {selectedPhase !== 'all' && (
                <button
                  type="button"
                  onClick={() => setSelectedPhase('all')}
                  className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-900 text-white cursor-pointer"
                >
                  <span>{PHASE_MAP[selectedPhase].shortLabel}</span>
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={onExportChecklistCsv}
                className="px-2.5 py-1.5 text-xs font-semibold bg-white hover:bg-slate-50 text-slate-700 border border-slate-200/90 rounded-lg inline-flex items-center gap-1 cursor-pointer transition-colors"
                title="체크리스트 CSV 다운로드"
              >
                <Download className="w-3.5 h-3.5" />
                <span>CSV</span>
              </button>

              {isLocalAdmin && totalChecked > 0 && (
                confirmReset ? (
                  <div className="inline-flex items-center gap-1 bg-rose-50 border border-rose-200 rounded-lg px-2 py-1">
                    <span className="text-[11px] font-bold text-rose-700">전체 해제</span>
                    <button
                      type="button"
                      onClick={() => {
                        onResetChecks();
                        setConfirmReset(false);
                      }}
                      disabled={isPendingSave}
                      className="px-2 py-0.5 text-[11px] font-bold bg-rose-600 hover:bg-rose-700 text-white rounded cursor-pointer"
                    >
                      확인
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmReset(false)}
                      className="px-1.5 py-0.5 text-[11px] font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
                    >
                      취소
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmReset(true)}
                    className="px-2.5 py-1.5 text-xs font-semibold bg-white hover:bg-slate-50 text-slate-700 border border-slate-200/90 rounded-lg inline-flex items-center gap-1 cursor-pointer transition-colors"
                    title="체크 상태 일괄 초기화"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>체크 초기화</span>
                  </button>
                )
              )}

              {isLocalAdmin && (
                <button
                  type="button"
                  onClick={handleOpenAdd}
                  className="px-3 py-1.5 text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white rounded-lg inline-flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>항목 추가</span>
                </button>
              )}
            </div>
          </div>

          {/* Search + Quick Filters */}
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1 min-w-0">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="항목 · 2026 이력 · 협조부서 · 공문 검색"
                className="w-full pl-8 pr-7 py-1.5 text-xs font-medium border border-slate-200/85 rounded-lg bg-slate-50/70 focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-900/15 focus:border-slate-300 text-slate-900"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                  aria-label="검색어 초기화"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => setOnlyLessons((v) => !v)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border inline-flex items-center gap-1 cursor-pointer transition-colors ${
                  onlyLessons
                    ? 'bg-amber-50 text-amber-800 border-amber-300'
                    : 'bg-white text-slate-600 border-slate-200/85 hover:bg-slate-50'
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>교훈 반영 {lessonsCount}</span>
              </button>
              <button
                type="button"
                onClick={() => setOnlyUnchecked((v) => !v)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border cursor-pointer transition-colors ${
                  onlyUnchecked
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-600 border-slate-200/85 hover:bg-slate-50'
                }`}
              >
                미완료만
              </button>
            </div>
          </div>

          {/* Domain Pills */}
          <div className="flex flex-wrap gap-1.5">
            {CHECKLIST_DOMAINS.map((dom) => {
              const active = selectedDomain === dom;
              return (
                <button
                  key={dom}
                  type="button"
                  onClick={() => setSelectedDomain(dom)}
                  className={`px-2.5 py-1 rounded-lg text-[11.5px] font-bold border cursor-pointer transition-colors ${
                    active
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-slate-50/80 text-slate-600 border-slate-200/80 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  {dom}
                </button>
              );
            })}
          </div>
        </div>

        {/* Add New Checklist Item Form */}
        {showAddForm && (
          <form
            onSubmit={handleSubmitAdd}
            className="bg-white border border-slate-300 rounded-xl p-4 shadow-xs space-y-3"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h4 className="text-sm font-extrabold text-slate-900">신규 체크 항목</h4>
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <select
                value={addForm.phase}
                onChange={(e) => setAddForm((prev) => ({ ...prev, phase: e.target.value as ChecklistPhaseId }))}
                className="px-2.5 py-1.5 text-xs font-semibold border border-slate-200 rounded-lg bg-slate-50 text-slate-900"
              >
                {CHECKLIST_PHASES.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label} ({p.windowLabel})
                  </option>
                ))}
              </select>
              <select
                value={addForm.domain}
                onChange={(e) => setAddForm((prev) => ({ ...prev, domain: e.target.value as ChecklistDomain }))}
                className="px-2.5 py-1.5 text-xs font-semibold border border-slate-200 rounded-lg bg-slate-50 text-slate-900"
              >
                {CHECKLIST_DOMAINS.filter((d) => d !== '전체').map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
              <select
                value={addForm.priority}
                onChange={(e) => setAddForm((prev) => ({ ...prev, priority: e.target.value as ChecklistPriority }))}
                className="px-2.5 py-1.5 text-xs font-semibold border border-slate-200 rounded-lg bg-slate-50 text-slate-900"
              >
                <option value="must">필수</option>
                <option value="high">중요</option>
                <option value="normal">일반</option>
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <input
                type="text"
                value={addForm.timingLabel}
                onChange={(e) => setAddForm((prev) => ({ ...prev, timingLabel: e.target.value }))}
                placeholder="시점 (D-45 · 9월 중순)"
                className="px-2.5 py-1.5 text-xs font-medium border border-slate-200 rounded-lg bg-white text-slate-900"
              />
              <input
                type="text"
                required
                value={addForm.title}
                onChange={(e) => setAddForm((prev) => ({ ...prev, title: e.target.value }))}
                placeholder="체크리스트 항목명"
                className="sm:col-span-2 px-2.5 py-1.5 text-xs font-semibold border border-slate-200 rounded-lg bg-white text-slate-900"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <input
                type="text"
                value={addForm.actualDate2026}
                onChange={(e) => setAddForm((prev) => ({ ...prev, actualDate2026: e.target.value }))}
                placeholder="2026 이행일 (26.9.15.)"
                className="px-2.5 py-1.5 text-xs font-medium border border-slate-200 rounded-lg bg-white text-slate-900"
              />
              <input
                type="text"
                value={addForm.cooperationDeptsText}
                onChange={(e) => setAddForm((prev) => ({ ...prev, cooperationDeptsText: e.target.value }))}
                placeholder="협조부서 (쉼표 구분)"
                className="px-2.5 py-1.5 text-xs font-medium border border-slate-200 rounded-lg bg-white text-slate-900"
              />
              <input
                type="text"
                value={addForm.docRef}
                onChange={(e) => setAddForm((prev) => ({ ...prev, docRef: e.target.value }))}
                placeholder="공문번호 · 근거"
                className="px-2.5 py-1.5 text-xs font-medium border border-slate-200 rounded-lg bg-white text-slate-900"
              />
            </div>

            <textarea
              rows={2}
              value={addForm.history2026}
              onChange={(e) => setAddForm((prev) => ({ ...prev, history2026: e.target.value }))}
              placeholder="2026 추진 실적 · 결과 내용"
              className="w-full px-2.5 py-1.5 text-xs font-medium border border-slate-200 rounded-lg bg-white text-slate-900"
            />
            <input
              type="text"
              value={addForm.lessonWarning}
              onChange={(e) => setAddForm((prev) => ({ ...prev, lessonWarning: e.target.value }))}
              placeholder="2026 시행착오 · 차년도 주의사항 (선택)"
              className="w-full px-2.5 py-1.5 text-xs font-medium border border-amber-200 rounded-lg bg-amber-50/40 text-slate-900"
            />

            <div className="flex justify-end gap-1.5 pt-1">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="px-3 py-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg cursor-pointer"
              >
                취소
              </button>
              <button
                type="submit"
                disabled={isPendingSave}
                className="px-3.5 py-1.5 text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white rounded-lg inline-flex items-center gap-1 cursor-pointer"
              >
                {isPendingSave ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                <span>저장</span>
              </button>
            </div>
          </form>
        )}

        {/* Grouped Checklist Rows */}
        {groupedByPhase.length === 0 ? (
          <div className="bg-white border border-slate-200/85 rounded-xl p-10 text-center text-xs font-semibold text-slate-500 shadow-2xs">
            일치 항목 없음
          </div>
        ) : (
          <div className="space-y-4">
            {groupedByPhase.map(({ phase, items }) => {
              const stat = phaseStats[phase.id];
              return (
                <section
                  key={phase.id}
                  className="bg-white border border-slate-200/85 rounded-xl shadow-2xs overflow-hidden"
                >
                  {/* Phase Header */}
                  <div className="px-4 py-2.5 bg-slate-50/90 border-b border-slate-200/75 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={`text-[11px] font-mono tabular-nums font-bold px-2 py-0.5 rounded-md border ${phase.accentBg} ${phase.accentText} ${phase.accentBorder}`}
                      >
                        {phase.windowLabel}
                      </span>
                      <h4 className={`${isLargeFont ? 'text-base' : 'text-sm'} font-extrabold text-slate-900 truncate`}>
                        {phase.label}
                      </h4>
                      <span className="text-xs font-medium text-slate-400 hidden sm:inline">
                        {phase.monthLabel}
                      </span>
                    </div>
                    <span className="text-xs font-mono tabular-nums font-bold text-slate-600">
                      {stat.done} / {stat.total} 완료
                    </span>
                  </div>

                  {/* Checklist Items */}
                  <div className="divide-y divide-slate-100">
                    {items.map((item) => {
                      const isEditing = editingId === item.id;
                      const prio = PRIORITY_STYLE[item.priority || 'normal'];

                      if (isEditing) {
                        return (
                          <div key={item.id} className="p-4 bg-slate-50/70 space-y-2.5">
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                              <select
                                value={editForm.phase}
                                onChange={(e) =>
                                  setEditForm((prev) => ({ ...prev, phase: e.target.value as ChecklistPhaseId }))
                                }
                                className="px-2 py-1.5 text-xs font-semibold border border-slate-200 rounded-lg bg-white text-slate-900"
                              >
                                {CHECKLIST_PHASES.map((p) => (
                                  <option key={p.id} value={p.id}>
                                    {p.label}
                                  </option>
                                ))}
                              </select>
                              <select
                                value={editForm.domain}
                                onChange={(e) =>
                                  setEditForm((prev) => ({ ...prev, domain: e.target.value as ChecklistDomain }))
                                }
                                className="px-2 py-1.5 text-xs font-semibold border border-slate-200 rounded-lg bg-white text-slate-900"
                              >
                                {CHECKLIST_DOMAINS.filter((d) => d !== '전체').map((d) => (
                                  <option key={d} value={d}>
                                    {d}
                                  </option>
                                ))}
                              </select>
                              <select
                                value={editForm.priority}
                                onChange={(e) =>
                                  setEditForm((prev) => ({ ...prev, priority: e.target.value as ChecklistPriority }))
                                }
                                className="px-2 py-1.5 text-xs font-semibold border border-slate-200 rounded-lg bg-white text-slate-900"
                              >
                                <option value="must">필수</option>
                                <option value="high">중요</option>
                                <option value="normal">일반</option>
                              </select>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                              <input
                                type="text"
                                value={editForm.timingLabel}
                                onChange={(e) => setEditForm((prev) => ({ ...prev, timingLabel: e.target.value }))}
                                placeholder="시점"
                                className="px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white text-slate-900"
                              />
                              <input
                                type="text"
                                value={editForm.title}
                                onChange={(e) => setEditForm((prev) => ({ ...prev, title: e.target.value }))}
                                placeholder="항목명"
                                className="sm:col-span-2 px-2.5 py-1.5 text-xs font-bold border border-slate-200 rounded-lg bg-white text-slate-900"
                              />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                              <input
                                type="text"
                                value={editForm.actualDate2026}
                                onChange={(e) => setEditForm((prev) => ({ ...prev, actualDate2026: e.target.value }))}
                                placeholder="2026 이행일"
                                className="px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white text-slate-900"
                              />
                              <input
                                type="text"
                                value={editForm.cooperationDeptsText}
                                onChange={(e) =>
                                  setEditForm((prev) => ({ ...prev, cooperationDeptsText: e.target.value }))
                                }
                                placeholder="협조부서 (쉼표 구분)"
                                className="px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white text-slate-900"
                              />
                              <input
                                type="text"
                                value={editForm.docRef}
                                onChange={(e) => setEditForm((prev) => ({ ...prev, docRef: e.target.value }))}
                                placeholder="공문번호"
                                className="px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white text-slate-900"
                              />
                            </div>

                            <textarea
                              rows={2}
                              value={editForm.history2026}
                              onChange={(e) => setEditForm((prev) => ({ ...prev, history2026: e.target.value }))}
                              placeholder="2026 추진 이력"
                              className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white text-slate-900"
                            />
                            <input
                              type="text"
                              value={editForm.lessonWarning}
                              onChange={(e) => setEditForm((prev) => ({ ...prev, lessonWarning: e.target.value }))}
                              placeholder="2026 교훈 · 차년도 주의사항"
                              className="w-full px-2.5 py-1.5 text-xs border border-amber-200 rounded-lg bg-amber-50/40 text-slate-900"
                            />
                            <input
                              type="text"
                              value={editForm.memo}
                              onChange={(e) => setEditForm((prev) => ({ ...prev, memo: e.target.value }))}
                              placeholder="차년도 실무 메모"
                              className="w-full px-2.5 py-1.5 text-xs border border-blue-200 rounded-lg bg-blue-50/30 text-slate-900"
                            />

                            <div className="flex justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => setEditingId(null)}
                                className="px-2.5 py-1 text-xs font-semibold bg-white border border-slate-200 text-slate-700 rounded-lg cursor-pointer"
                              >
                                취소
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSaveEdit(item.id)}
                                disabled={isPendingSave}
                                className="px-3 py-1 text-xs font-bold bg-slate-900 text-white rounded-lg inline-flex items-center gap-1 cursor-pointer"
                              >
                                <Save className="w-3 h-3" />
                                <span>저장</span>
                              </button>
                            </div>
                          </div>
                        );
                      }

                      return (
                        <div
                          key={item.id}
                          className={`vlds-cv-row p-3.5 sm:px-4 sm:py-3.5 transition-colors ${
                            item.checked ? 'bg-slate-50/60' : 'bg-white hover:bg-slate-50/40'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            {/* Interactive Checkbox */}
                            <button
                              type="button"
                              role="checkbox"
                              aria-checked={item.checked}
                              aria-label={`${item.title} 체크`}
                              onClick={() => onToggleItem(item.id)}
                              disabled={isPendingSave}
                              className={`mt-0.5 w-5 h-5 rounded-md border flex items-center justify-center shrink-0 cursor-pointer transition-colors ${
                                item.checked
                                  ? 'bg-emerald-600 border-emerald-600 text-white'
                                  : 'bg-white border-slate-300 hover:border-slate-500 text-transparent'
                              }`}
                            >
                              <Check className="w-3.5 h-3.5 stroke-[3]" />
                            </button>

                            {/* Main Body */}
                            <div className="flex-1 min-w-0 space-y-1.5">
                              {/* Top Metadata + Title */}
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                                  <span className="text-[11px] font-mono tabular-nums font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200/80 whitespace-nowrap">
                                    {item.timingLabel}
                                  </span>
                                  <span
                                    className={`text-[10.5px] font-bold px-1.5 py-0.5 rounded border whitespace-nowrap ${prio.cls}`}
                                  >
                                    {prio.label}
                                  </span>
                                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-white text-slate-600 border border-slate-200/80 whitespace-nowrap">
                                    {item.domain}
                                  </span>
                                </div>

                                {isLocalAdmin && (
                                  <div className="flex items-center gap-1 shrink-0">
                                    <button
                                      type="button"
                                      onClick={() => handleStartEdit(item)}
                                      className="p-1 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-md cursor-pointer"
                                      title="항목 수정"
                                    >
                                      <Edit3 className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => onDeleteItem(item.id)}
                                      className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md cursor-pointer"
                                      title="항목 삭제"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                )}
                              </div>

                              {/* Checklist Title */}
                              <div
                                className={`${isLargeFont ? 'text-base' : 'text-[13.5px] sm:text-sm'} font-extrabold leading-snug break-keep ${
                                  item.checked ? 'line-through text-slate-400' : 'text-slate-900'
                                }`}
                              >
                                {item.title}
                              </div>

                              {/* 2026 Execution History Box */}
                              {(item.actualDate2026 || item.history2026) && (
                                <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-2 text-xs text-slate-600 bg-slate-50/90 border border-slate-200/60 rounded-lg px-2.5 py-1.5">
                                  <span className="inline-flex items-center gap-1 font-mono tabular-nums font-bold text-slate-700 shrink-0 whitespace-nowrap">
                                    <Calendar className="w-3 h-3 text-slate-400" />
                                    <span>2026</span>
                                    {item.actualDate2026 && <span>· {item.actualDate2026}</span>}
                                  </span>
                                  {item.history2026 && (
                                    <span className="font-medium text-slate-700 leading-relaxed break-keep">
                                      {item.history2026}
                                    </span>
                                  )}
                                </div>
                              )}

                              {/* 2026 Lesson / Warning Callout */}
                              {item.lessonWarning && (
                                <div className="flex items-start gap-1.5 text-xs bg-amber-50/85 border border-amber-200/90 text-amber-950 rounded-lg px-2.5 py-1.5">
                                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                                  <div className="leading-relaxed break-keep">
                                    <span className="font-extrabold text-amber-800 mr-1.5">2026 교훈</span>
                                    <span className="font-semibold">{item.lessonWarning}</span>
                                  </div>
                                </div>
                              )}

                              {/* Memo Callout */}
                              {item.memo && (
                                <div className="flex items-start gap-1.5 text-xs bg-blue-50/60 border border-blue-200/70 text-blue-900 rounded-lg px-2.5 py-1.5">
                                  <StickyNote className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.5" />
                                  <span className="font-medium break-keep">{item.memo}</span>
                                </div>
                              )}

                              {/* Cooperation Depts & Doc Ref */}
                              {((item.cooperationDepts && item.cooperationDepts.length > 0) || item.docRef) && (
                                <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                                  {item.cooperationDepts?.map((dept) => (
                                    <span
                                      key={dept}
                                      className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md bg-slate-100/80 text-slate-600 border border-slate-200/60"
                                    >
                                      <Building2 className="w-2.5 h-2.5 text-slate-400" />
                                      <span>{dept}</span>
                                    </span>
                                  ))}
                                  {item.docRef && (
                                    <span className="inline-flex items-center gap-1 text-[11px] font-mono tabular-nums font-bold px-2 py-0.5 rounded-md bg-indigo-50/80 text-indigo-700 border border-indigo-200/70">
                                      <FileText className="w-2.5 h-2.5" />
                                      <span>{item.docRef}</span>
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>

      {/* RIGHT STICKY SIDEBAR (4/12): 2026 Lessons + Editable Overview + Key Docs */}
      <div className="xl:col-span-4 space-y-4 min-w-0 xl:sticky xl:top-4">
        {/* Card A: 2026 Lessons Learned */}
        {historySummary && historySummary.lessonsLearned.length > 0 && (
          <div className="bg-white border border-slate-200/85 rounded-xl p-4 shadow-2xs space-y-3">
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
                <h3 className={`${isLargeFont ? 'text-base' : 'text-sm'} font-extrabold text-slate-900 tracking-tight`}>
                  2026 핵심 교훈
                </h3>
              </div>
              <span className="text-[11px] font-mono tabular-nums font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200/80">
                {historySummary.lessonsLearned.length}건
              </span>
            </div>

            <div className="space-y-2.5">
              {historySummary.lessonsLearned.map((lesson) => {
                const isCritical = lesson.severity === 'critical';
                const isTip = lesson.severity === 'tip';
                return (
                  <div
                    key={lesson.id}
                    className={`rounded-lg border p-3 space-y-1.5 ${
                      isCritical
                        ? 'bg-rose-50/55 border-rose-200/90'
                        : isTip
                          ? 'bg-emerald-50/45 border-emerald-200/80'
                          : 'bg-amber-50/45 border-amber-200/80'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`text-[10.5px] font-extrabold px-1.5 py-0.5 rounded ${
                          isCritical
                            ? 'bg-rose-100 text-rose-800'
                            : isTip
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-900'
                        }`}
                      >
                        {lesson.category}
                      </span>
                      {isTip ? (
                        <Lightbulb className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      ) : (
                        <AlertTriangle
                          className={`w-3.5 h-3.5 shrink-0 ${isCritical ? 'text-rose-600' : 'text-amber-600'}`}
                        />
                      )}
                    </div>
                    <div className={`${isLargeFont ? 'text-sm' : 'text-xs'} font-extrabold text-slate-900 leading-snug break-keep`}>
                      {lesson.title}
                    </div>
                    <div className="text-[11.5px] text-slate-600 leading-relaxed break-keep">
                      <span className="font-bold text-slate-700">2026: </span>
                      {lesson.incident2026}
                    </div>
                    <div className="text-[11.5px] text-slate-900 font-semibold leading-relaxed break-keep pt-1 border-t border-slate-200/60">
                      <span className="font-extrabold text-slate-700">차년도: </span>
                      {lesson.actionForNextYear}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Card B: Official Event Overview (Preserves full inline edit contract) */}
        <div className="bg-white border border-slate-200/85 rounded-xl p-4 shadow-2xs">
          <div className="flex items-center justify-between pb-2.5 mb-3 border-b border-slate-100 gap-2">
            <div className="flex items-center gap-2">
              <span
                className={`inline-block ${isLargeFont ? 'w-4 h-4 border-2' : 'w-3.5 h-3.5 border-[1.5px]'} border-slate-900 rounded-[2px] shrink-0`}
              />
              <h3 className={`${isLargeFont ? 'text-base' : 'text-sm'} font-extrabold text-slate-900 tracking-tight`}>
                행사 개요
              </h3>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {editingOverview ? (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={onSaveOverview}
                    disabled={isPendingSave}
                    className="px-2 py-0.5 text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white rounded-md flex items-center gap-1 cursor-pointer"
                    title="행사 개요 저장"
                  >
                    {isPendingSave ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                    <span>저장</span>
                  </button>
                  <button
                    type="button"
                    onClick={onCancelEditOverview}
                    className="px-2 py-0.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200/80 rounded-md flex items-center gap-0.5 cursor-pointer"
                    title="취소"
                  >
                    <X className="w-3 h-3" />
                    <span>취소</span>
                  </button>
                </div>
              ) : isLocalAdmin ? (
                <button
                  type="button"
                  onClick={onStartEditOverview}
                  className="p-1 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-md cursor-pointer transition-colors"
                  title="행사 개요 수정"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                </button>
              ) : null}
              <span className="font-mono tabular-nums font-bold text-xs px-2 py-0.5 bg-slate-900 text-white rounded-md border border-slate-800 shrink-0">
                {daysLeft > 0 ? `D-${daysLeft}` : '개최 완료'}
              </span>
            </div>
          </div>

          <div className="space-y-2">
            {/* 행사명 */}
            <div className={`grid ${isLargeFont ? 'grid-cols-[minmax(76px,max-content)_12px_1fr] text-sm gap-1.5' : 'grid-cols-[minmax(62px,max-content)_10px_1fr] text-xs gap-1'} items-baseline`}>
              <span className="font-semibold text-slate-500 whitespace-nowrap shrink-0">• 행사명</span>
              <span className="font-medium text-slate-300 text-center shrink-0">:</span>
              {editingOverview ? (
                <input
                  type="text"
                  value={editOverviewData?.title || ''}
                  onChange={(e) => onChangeOverviewField((prev) => ({ ...prev, title: e.target.value }))}
                  className="w-full px-2 py-1 border border-slate-300 rounded-md bg-slate-50/70 font-bold text-slate-900"
                />
              ) : (
                <span className="font-bold text-slate-900 leading-snug break-keep min-w-0">
                  {meta?.title || '2026 양재천 걷자! 건강 페스티벌'}
                </span>
              )}
            </div>

            {/* 일시 */}
            <div className={`grid ${isLargeFont ? 'grid-cols-[minmax(76px,max-content)_12px_1fr] text-sm gap-1.5' : 'grid-cols-[minmax(62px,max-content)_10px_1fr] text-xs gap-1'} items-baseline`}>
              <span className="font-semibold text-slate-500 whitespace-nowrap shrink-0">• 일&nbsp;&nbsp;&nbsp;&nbsp;시</span>
              <span className="font-medium text-slate-300 text-center shrink-0">:</span>
              {editingOverview ? (
                <div className="flex gap-1">
                  <input
                    type="text"
                    value={editOverviewData?.eventDate || ''}
                    onChange={(e) => onChangeOverviewField((prev) => ({ ...prev, eventDate: e.target.value }))}
                    className="w-1/2 px-2 py-1 border border-slate-300 rounded-md bg-slate-50/70 font-semibold text-slate-900"
                  />
                  <input
                    type="text"
                    value={editOverviewData?.eventTime || ''}
                    onChange={(e) => onChangeOverviewField((prev) => ({ ...prev, eventTime: e.target.value }))}
                    className="w-1/2 px-2 py-1 border border-slate-300 rounded-md bg-slate-50/70 font-semibold text-slate-900"
                  />
                </div>
              ) : (
                <span className="font-mono tabular-nums font-semibold text-slate-800 break-keep min-w-0">
                  {meta?.eventDate || ''} ({meta?.eventTime || ''})
                </span>
              )}
            </div>

            {/* 장소 */}
            <div className={`grid ${isLargeFont ? 'grid-cols-[minmax(76px,max-content)_12px_1fr] text-sm gap-1.5' : 'grid-cols-[minmax(62px,max-content)_10px_1fr] text-xs gap-1'} items-baseline`}>
              <span className="font-semibold text-slate-500 whitespace-nowrap shrink-0">• 장&nbsp;&nbsp;&nbsp;&nbsp;소</span>
              <span className="font-medium text-slate-300 text-center shrink-0">:</span>
              {editingOverview ? (
                <input
                  type="text"
                  value={editOverviewData?.location || ''}
                  onChange={(e) => onChangeOverviewField((prev) => ({ ...prev, location: e.target.value }))}
                  className="w-full px-2 py-1 border border-slate-300 rounded-md bg-slate-50/70 font-semibold text-slate-900"
                />
              ) : (
                <span className="font-semibold text-slate-800 leading-snug break-keep min-w-0">
                  {meta?.location || ''}
                </span>
              )}
            </div>

            {/* 코스 */}
            <div className={`grid ${isLargeFont ? 'grid-cols-[minmax(76px,max-content)_12px_1fr] text-sm gap-1.5' : 'grid-cols-[minmax(62px,max-content)_10px_1fr] text-xs gap-1'} items-baseline`}>
              <span className="font-semibold text-slate-500 whitespace-nowrap shrink-0">• 코&nbsp;&nbsp;&nbsp;&nbsp;스</span>
              <span className="font-medium text-slate-300 text-center shrink-0">:</span>
              {editingOverview ? (
                <input
                  type="text"
                  value={editOverviewData?.course || ''}
                  onChange={(e) => onChangeOverviewField((prev) => ({ ...prev, course: e.target.value }))}
                  className="w-full px-2 py-1 border border-slate-300 rounded-md bg-slate-50/70 font-semibold text-slate-900"
                />
              ) : (
                <span className="font-semibold text-slate-800 break-keep min-w-0">{meta?.course || ''}</span>
              )}
            </div>

            {/* 참여 */}
            <div className={`grid ${isLargeFont ? 'grid-cols-[minmax(76px,max-content)_12px_1fr] text-sm gap-1.5' : 'grid-cols-[minmax(62px,max-content)_10px_1fr] text-xs gap-1'} items-baseline`}>
              <span className="font-semibold text-slate-500 whitespace-nowrap shrink-0">• 참&nbsp;&nbsp;&nbsp;&nbsp;여</span>
              <span className="font-medium text-slate-300 text-center shrink-0">:</span>
              {editingOverview ? (
                <input
                  type="text"
                  value={editOverviewData?.targetAudience || ''}
                  onChange={(e) => onChangeOverviewField((prev) => ({ ...prev, targetAudience: e.target.value }))}
                  className="w-full px-2 py-1 border border-slate-300 rounded-md bg-slate-50/70 font-semibold text-slate-900"
                />
              ) : (
                <span className="font-semibold text-slate-800 break-keep min-w-0">{meta?.targetAudience || ''}</span>
              )}
            </div>

            {/* 구성 */}
            <div className={`grid ${isLargeFont ? 'grid-cols-[minmax(76px,max-content)_12px_1fr] text-sm gap-1.5' : 'grid-cols-[minmax(62px,max-content)_10px_1fr] text-xs gap-1'} items-baseline`}>
              <span className="font-semibold text-slate-500 whitespace-nowrap shrink-0">• 구&nbsp;&nbsp;&nbsp;&nbsp;성</span>
              <span className="font-medium text-slate-300 text-center shrink-0">:</span>
              <div className="space-y-1 min-w-0">
                {(editingOverview ? editOverviewData?.programStructure || [] : meta?.programStructure || []).map(
                  (item: string, pIdx: number) => (
                    <div key={`prog-${pIdx}-${item.slice(0, 15)}`} className="flex items-start">
                      {editingOverview ? (
                        <div className="flex items-center gap-1 flex-1">
                          <input
                            type="text"
                            value={item}
                            onChange={(e) => {
                              const nextProg = [...(editOverviewData?.programStructure || [])];
                              nextProg[pIdx] = e.target.value;
                              onChangeOverviewField((prev) => ({ ...prev, programStructure: nextProg }));
                            }}
                            className="w-full px-2 py-0.5 border border-slate-300 rounded-md bg-white text-xs font-semibold text-slate-800"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const nextProg = (editOverviewData?.programStructure || []).filter(
                                (_: string, idx: number) => idx !== pIdx
                              );
                              onChangeOverviewField((prev) => ({ ...prev, programStructure: nextProg }));
                            }}
                            className="p-0.5 text-rose-500 hover:bg-rose-50 rounded cursor-pointer shrink-0"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <span className={`font-semibold text-slate-800 leading-snug break-keep ${isLargeFont ? 'text-sm' : 'text-xs'}`}>
                          {item}
                        </span>
                      )}
                    </div>
                  )
                )}
                {editingOverview && (
                  <button
                    type="button"
                    onClick={() => {
                      const nextProg = [...(editOverviewData?.programStructure || []), '신규 체험·홍보 프로그램'];
                      onChangeOverviewField((prev) => ({ ...prev, programStructure: nextProg }));
                    }}
                    className="mt-1 px-2 py-0.5 text-[11px] font-semibold bg-slate-100 text-slate-800 rounded-md border border-slate-200/80 hover:bg-slate-200 flex items-center gap-1 cursor-pointer w-fit"
                  >
                    <Plus className="w-3 h-3" />
                    <span>구성 추가</span>
                  </button>
                )}
              </div>
            </div>

            {/* 비고 (직원 복무) */}
            <div className={`grid ${isLargeFont ? 'grid-cols-[minmax(76px,max-content)_12px_1fr] text-sm gap-1.5' : 'grid-cols-[minmax(62px,max-content)_10px_1fr] text-xs gap-1'} items-baseline pt-0.5`}>
              <span className="font-extrabold text-blue-600 whitespace-nowrap shrink-0">• 비&nbsp;&nbsp;&nbsp;&nbsp;고</span>
              <span className="font-bold text-blue-400 text-center shrink-0">:</span>
              {editingOverview ? (
                <input
                  type="text"
                  value={editOverviewData?.staffNote ?? meta?.staffNote ?? ''}
                  onChange={(e) => onChangeOverviewField((prev) => ({ ...prev, staffNote: e.target.value }))}
                  className="w-full px-2 py-1 border border-blue-400 rounded-md bg-blue-50/50 font-bold text-blue-900"
                />
              ) : (
                <span className="font-bold text-blue-600 leading-snug break-keep">
                  {meta?.staffNote || '행사 참여 직원 대체휴무 시행 예정'}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Card C: 2026 Key Official Documents Reference */}
        {historySummary && historySummary.keyDocs.length > 0 && (
          <div className="bg-white border border-slate-200/85 rounded-xl p-4 shadow-2xs space-y-3">
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-slate-600 shrink-0" />
                <h3 className={`${isLargeFont ? 'text-base' : 'text-sm'} font-extrabold text-slate-900 tracking-tight`}>
                  2026 주요 공문
                </h3>
              </div>
              <span className="text-[11px] font-mono tabular-nums font-bold text-slate-500">
                {historySummary.keyDocs.length}건
              </span>
            </div>

            <div className="space-y-2">
              {historySummary.keyDocs.map((doc) => (
                <div
                  key={doc.id}
                  className="p-2.5 rounded-lg border border-slate-200/75 bg-slate-50/60 space-y-1"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10.5px] font-bold px-1.5 py-0.5 rounded bg-white text-slate-700 border border-slate-200/80">
                      {doc.docType}
                    </span>
                    <span className="text-[11px] font-mono tabular-nums text-slate-500">
                      {doc.date}
                    </span>
                  </div>
                  <div className="text-xs font-bold text-slate-900 leading-snug break-keep">
                    {doc.title}
                  </div>
                  <div className="text-[11px] font-mono tabular-nums font-semibold text-indigo-700">
                    {doc.docNo}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

ChecklistPlaybookTab.displayName = 'ChecklistPlaybookTab';
