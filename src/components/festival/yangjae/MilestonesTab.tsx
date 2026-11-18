import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Plus,
  Edit3,
  Save,
  X,
  Trash2,
  FolderInput,
  Loader2,
} from 'lucide-react';
import type { DetailDraft, DetailEditRowProps, EditableDetailItemProps, MilestonesTabProps } from './types';
import {
  parseDetail,
  formatDetail,
  sortDetailsAscending,
  renderBulletedContent,
} from './festivalUtils';

export const DetailEditRow = React.memo(function DetailEditRow({
  initialDetail,
  onUpdate,
  onDelete,
  onMoveUp,
  onMoveDown,
  canMoveUp = false,
  canMoveDown = false,
  onTransfer,
}: DetailEditRowProps) {
  const parsed = useMemo(() => parseDetail(initialDetail), [initialDetail]);
  const [lastEmitted, setLastEmitted] = useState<string>(initialDetail);
  const [prevDetail, setPrevDetail] = useState<string>(initialDetail);
  const [date, setDate] = useState<string>(parsed.date);
  const [status, setStatus] = useState<'done' | 'in-progress' | 'todo'>(parsed.status);
  const [text, setText] = useState<string>(parsed.text);

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const latestValuesRef = useRef({ date, status, text, lastEmitted });

  useEffect(() => {
    latestValuesRef.current = { date, status, text, lastEmitted };
  }, [date, status, text, lastEmitted]);

  if (prevDetail !== initialDetail) {
    setPrevDetail(initialDetail);
    if (initialDetail !== lastEmitted) {
      setLastEmitted(initialDetail);
      setDate(parsed.date);
      setStatus(parsed.status);
      setText(parsed.text);
    }
  }

  const flushChange = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    const { date: d, status: s, text: t, lastEmitted: le } = latestValuesRef.current;
    const formatted = formatDetail({ date: d, status: s, attendees: '', text: t });
    if (formatted !== le) {
      setLastEmitted(formatted);
      latestValuesRef.current.lastEmitted = formatted;
      onUpdate(formatted);
    }
  }, [onUpdate]);

  const scheduleEmit = useCallback(
    (newDate: string, newStatus: 'done' | 'in-progress' | 'todo', newText: string) => {
      latestValuesRef.current = { date: newDate, status: newStatus, text: newText, lastEmitted: latestValuesRef.current.lastEmitted };
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      debounceTimerRef.current = setTimeout(() => {
        debounceTimerRef.current = null;
        const formatted = formatDetail({ date: newDate, status: newStatus, attendees: '', text: newText });
        setLastEmitted(formatted);
        latestValuesRef.current.lastEmitted = formatted;
        onUpdate(formatted);
      }, 200);
    },
    [onUpdate]
  );

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
        const { date: d, status: s, text: t, lastEmitted: le } = latestValuesRef.current;
        const formatted = formatDetail({ date: d, status: s, attendees: '', text: t });
        if (formatted !== le) {
          onUpdate(formatted);
        }
      }
    };
  }, [onUpdate]);

  const handleMoveUpWithFlush = useCallback(() => {
    flushChange();
    onMoveUp?.();
  }, [flushChange, onMoveUp]);

  const handleMoveDownWithFlush = useCallback(() => {
    flushChange();
    onMoveDown?.();
  }, [flushChange, onMoveDown]);

  const handleDeleteWithFlush = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    onDelete();
  }, [onDelete]);

  const handleTransferWithFlush = useCallback(() => {
    flushChange();
    onTransfer?.();
  }, [flushChange, onTransfer]);

  return (
    <div className="p-2 bg-white rounded-lg border border-slate-200 space-y-1.5 shadow-2xs">
      <div className="flex items-center justify-between gap-1.5 flex-wrap">
        <div className="flex items-center gap-1.5 shrink-0">
          {/* 날짜 입력 */}
          <input
            type="text"
            value={date}
            onChange={(e) => {
              setDate(e.target.value);
              scheduleEmit(e.target.value, status, text);
            }}
            onBlur={flushChange}
            placeholder="날짜 (7.29)"
            className="w-24 px-2 py-0.5 border border-amber-400 rounded bg-amber-50/40 text-xs font-bold font-mono shrink-0"
          />
          {/* 상태 선택 */}
          <select
            value={status}
            onChange={(e) => {
              const nextStatus = e.target.value as 'done' | 'in-progress' | 'todo';
              setStatus(nextStatus);
              scheduleEmit(date, nextStatus, text);
            }}
            onBlur={flushChange}
            className={`px-1.5 py-0.5 text-xs font-black rounded border cursor-pointer shrink-0 ${
              status === 'done'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                : status === 'in-progress'
                ? 'bg-amber-50 text-amber-900 border-amber-300'
                : 'bg-blue-50 text-blue-900 border-blue-300'
            }`}
          >
            <option value="done">✓ 완료</option>
            <option value="in-progress">▶ 진행</option>
            <option value="todo">○ 예정</option>
          </select>
        </div>

        {/* 위치(순서) 이동 및 삭제 버튼 그룹 */}
        <div className="flex items-center gap-0.5 shrink-0 bg-slate-100 p-0.5 rounded-md border border-slate-200 ml-auto">
          <button
            type="button"
            disabled={!canMoveUp}
            onClick={handleMoveUpWithFlush}
            className={`p-1 rounded cursor-pointer transition-colors ${
              canMoveUp
                ? 'text-slate-700 hover:bg-slate-200 hover:text-slate-900 active:scale-95'
                : 'text-slate-300 cursor-not-allowed opacity-40'
            }`}
            title="위로 이동"
          >
            <ChevronUp className="w-3.5 h-3.5 stroke-[2.5]" />
          </button>
          <button
            type="button"
            disabled={!canMoveDown}
            onClick={handleMoveDownWithFlush}
            className={`p-1 rounded cursor-pointer transition-colors ${
              canMoveDown
                ? 'text-slate-700 hover:bg-slate-200 hover:text-slate-900 active:scale-95'
                : 'text-slate-300 cursor-not-allowed opacity-40'
            }`}
            title="아래로 이동"
          >
            <ChevronDown className="w-3.5 h-3.5 stroke-[2.5]" />
          </button>
          {onTransfer && (
            <>
              <span className="w-[1px] h-3 bg-slate-300 mx-0.5" />
              <button
                type="button"
                onClick={handleTransferWithFlush}
                className="p-1 text-amber-700 hover:bg-amber-100 rounded cursor-pointer transition-colors active:scale-95"
                title="다른 추진과제 카테고리로 이동"
              >
                <FolderInput className="w-3.5 h-3.5 stroke-[2.2]" />
              </button>
            </>
          )}
          <span className="w-[1px] h-3 bg-slate-300 mx-0.5" />
          <button
            type="button"
            onClick={handleDeleteWithFlush}
            className="p-1 text-red-500 hover:bg-red-50 hover:text-red-700 rounded cursor-pointer transition-colors active:scale-95"
            title="과업 삭제"
          >
            <Trash2 className="w-3.5 h-3.5 stroke-[2.2]" />
          </button>
        </div>
      </div>
      {/* 내용 본문 입력 */}
      <textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          scheduleEmit(date, status, e.target.value);
        }}
        onBlur={flushChange}
        rows={2}
        placeholder="세부 과업 내용 입력 (엔터로 줄바꿈하여 한 줄씩 개조식 작성 가능)"
        className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs font-medium text-slate-900 bg-white leading-relaxed resize-y focus:outline-none focus:ring-1 focus:ring-amber-500"
      />
    </div>
  );
});

DetailEditRow.displayName = 'DetailEditRow';

export const EditableDetailItem = React.memo(function EditableDetailItem({
  draft,
  dIdx,
  totalCount,
  milestoneId,
  onUpdate,
  onMoveUp,
  onMoveDown,
  onTransfer,
  onDelete,
}: EditableDetailItemProps) {
  const handleMoveUp = useCallback(() => onMoveUp(dIdx), [onMoveUp, dIdx]);
  const handleMoveDown = useCallback(() => onMoveDown(dIdx), [onMoveDown, dIdx]);
  const handleTransfer = useCallback(() => onTransfer(milestoneId, dIdx, draft.raw), [onTransfer, milestoneId, dIdx, draft.raw]);
  const handleUpdate = useCallback((newRaw: string) => onUpdate(dIdx, newRaw), [onUpdate, dIdx]);
  const handleDelete = useCallback(() => onDelete(dIdx), [onDelete, dIdx]);

  return (
    <DetailEditRow
      initialDetail={draft.raw}
      canMoveUp={dIdx > 0}
      canMoveDown={dIdx < totalCount - 1}
      onMoveUp={handleMoveUp}
      onMoveDown={handleMoveDown}
      onTransfer={handleTransfer}
      onUpdate={handleUpdate}
      onDelete={handleDelete}
    />
  );
});

EditableDetailItem.displayName = 'EditableDetailItem';

export const MilestonesTab: React.FC<MilestonesTabProps> = React.memo(({
  milestones,
  detailDrafts,
  editingMilestoneId,
  editMilestoneData,
  expandedTaskIds,
  isLocalAdmin,
  isLargeFont,
  isPendingSave,
  allExpanded,
  onToggleExpand,
  onToggleAllExpand,
  onStartEditMilestone,
  onCancelEditMilestone,
  onSaveMilestone,
  onAddMilestone,
  onDeleteMilestone,
  onUpdateMilestoneField,
  onUpdateDetailRow,
  onMoveUpDetailRow,
  onMoveDownDetailRow,
  onDeleteDetailRow,
  onOpenTransferModal,
  onAddDetailRow,
}) => {
  return (
    <>
      {/* Top Controls: 전체 펼치기/접기 + 과제 추가 */}
      <div className="px-1 flex items-center justify-between">
        <button
          type="button"
          onClick={onToggleAllExpand}
          className="text-xs font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1 cursor-pointer py-1 transition-colors"
        >
          {allExpanded ? (
            <>
              <ChevronUp className="w-3.5 h-3.5" />
              <span>전체 접기</span>
            </>
          ) : (
            <>
              <ChevronDown className="w-3.5 h-3.5" />
              <span>전체 펼치기</span>
            </>
          )}
        </button>
        {isLocalAdmin && (
          <button
            type="button"
            onClick={onAddMilestone}
            disabled={isPendingSave}
            className="px-2.5 py-1 text-xs font-bold bg-amber-50 text-amber-900 rounded-lg border border-amber-200/90 hover:bg-amber-100/80 flex items-center gap-1 cursor-pointer shadow-2xs transition-colors"
            title="신규 추진과제 추가"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>과제 추가</span>
          </button>
        )}
      </div>

      {(milestones || []).map((item) => {
        if (!item) return null;
        const isEditingThis = editingMilestoneId === item.id && editMilestoneData !== null;
        const targetItem = (isEditingThis ? editMilestoneData : item) || item;
        if (!targetItem) return null;
        const isExpanded = expandedTaskIds.has(item.id) || isEditingThis;

        // 과제 2(행사 식순)는 상단 [4. 행사식순] 전용 탭으로 승격되었으므로 1번 탭(추진과제)에서는 노출하지 않음
        if (item.id === 2) return null;

        return (
          <div 
            key={`milestone-card-${item.id}`}
            className={`p-3.5 rounded-xl border transition-colors duration-150 shadow-2xs ${
              targetItem.status === 'in-progress'
                ? 'bg-amber-50/35 border-amber-300/90'
                : targetItem.status === 'done'
                ? 'bg-white border-emerald-200/90'
                : 'bg-white border-slate-200/80 text-slate-600'
            }`}
          >
            {/* Milestone Card Top: Number, Title, Status, Edit Buttons, Accordion Toggle */}
            <div className={`flex items-center justify-between pb-2.5 mb-2.5 border-b gap-1.5 ${
              targetItem.status === 'done' ? 'border-slate-100' : 'border-slate-100'
            }`}>
              <div className="flex items-center gap-2 flex-1 min-w-0">
                {isEditingThis ? (
                  <div className="flex items-center gap-1.5 flex-1 min-w-0">
                    <input
                      type="text"
                      value={targetItem?.number || ''}
                      onChange={(e) => onUpdateMilestoneField('number', e.target.value)}
                      className="w-20 px-1.5 py-0.5 border border-amber-400 rounded-md bg-white text-xs font-mono font-black shrink-0"
                    />
                    <input
                      type="text"
                      value={targetItem?.title || ''}
                      onChange={(e) => onUpdateMilestoneField('title', e.target.value)}
                      className="flex-1 px-1.5 py-0.5 border border-amber-400 rounded-md bg-white text-xs font-extrabold text-slate-900 min-w-0"
                      placeholder="추진과제 제목"
                    />
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => onToggleExpand(item.id)}
                    className="flex items-center text-left cursor-pointer flex-1 min-w-0 group"
                  >
                    <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg bg-slate-900 text-white shadow-2xs group-hover:bg-slate-800 transition-colors max-w-full">
                      <span className={`font-mono tabular-nums font-black text-[11px] shrink-0 ${
                        item.status === 'done' ? 'text-emerald-400' : 'text-amber-300'
                      }`}>
                        {item?.number || ''}
                      </span>
                      <span className="w-[1px] h-3 bg-slate-700 shrink-0" />
                      <span className={`${isLargeFont ? 'text-sm' : 'text-xs'} font-extrabold text-slate-50 tracking-tight truncate`}>
                        {item?.title || ''}
                      </span>
                    </div>
                  </button>
                )}
              </div>

              <div className="flex items-center gap-1 shrink-0">
                {isEditingThis ? (
                  <>
                    <select
                      value={targetItem?.status || 'todo'}
                      onChange={(e) => onUpdateMilestoneField('status', e.target.value as 'done' | 'in-progress' | 'todo')}
                      className="px-1.5 py-0.5 text-xs font-bold border border-amber-400 rounded-md bg-white"
                    >
                      <option value="done">✓ 완료</option>
                      <option value="in-progress">▶ 진행중</option>
                      <option value="todo">○ 예정</option>
                    </select>
                    <button
                      type="button"
                      onClick={onSaveMilestone}
                      disabled={isPendingSave}
                      className="px-2 py-0.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-md flex items-center gap-0.5 cursor-pointer"
                      title="과제 저장"
                    >
                      {isPendingSave ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                      <span>저장</span>
                    </button>
                    <button
                      type="button"
                      onClick={onCancelEditMilestone}
                      className="px-2 py-0.5 text-xs font-bold bg-slate-600 hover:bg-slate-500 text-white rounded-md flex items-center gap-0.5 cursor-pointer"
                      title="취소"
                    >
                      <X className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteMilestone(item.id)}
                      className="p-1 text-red-500 hover:bg-red-50 rounded-md cursor-pointer"
                      title="과제 삭제"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </>
                ) : (
                  <>
                    <span className={`${isLargeFont ? 'text-xs px-2.5 py-1' : 'text-[11px] px-2 py-0.5'} font-bold rounded-md border ${
                      item.status === 'done'
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200/90 font-extrabold'
                        : item.status === 'in-progress'
                        ? 'bg-amber-50 text-amber-800 border-amber-200/90 font-extrabold'
                        : 'bg-slate-50 text-slate-400 border-slate-200/80'
                    }`}>
                      {item.status === 'done' ? '✓ 완료' : item.status === 'in-progress' ? '▶ 진행중' : '○ 예정'}
                    </span>
                    {isLocalAdmin && (
                      <button
                        type="button"
                        onClick={() => onStartEditMilestone(item)}
                        className="p-1 text-slate-500 hover:text-amber-700 hover:bg-amber-50 rounded-md cursor-pointer transition-colors"
                        title="과제 수정"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onToggleExpand(item.id)}
                      className="p-1 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md cursor-pointer transition-colors"
                      aria-label={isExpanded ? "과제 접기" : "과제 펼치기"}
                      title={isExpanded ? "과제 접기" : "과제 펼치기"}
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Expandable Body: Cooperation Departments & Detailed Task List */}
            {isExpanded && (
              <div className="pt-0.5 space-y-2.5">
                {/* Cooperation Departments Tags (Integrated) */}
                <div className="flex items-center flex-wrap gap-1.5">
                  <span className={`${isLargeFont ? 'text-xs' : 'text-[11px]'} font-bold text-slate-500`}>협조부서:</span>
                  {isEditingThis ? (
                    <input
                      type="text"
                      key={`${targetItem?.id}-coop-input`}
                      defaultValue={targetItem?.cooperationDepts ? targetItem.cooperationDepts.join(', ') : ''}
                      onChange={(e) => {
                        const raw = e.target.value;
                        onUpdateMilestoneField('cooperationDepts', raw ? raw.split(',').map((s) => s.trim()).filter(Boolean) : []);
                      }}
                      placeholder="부서명 쉼표(,) 구분 (예: 치수과, 공원녹지과)"
                      className="flex-1 px-2 py-0.5 border border-amber-400 rounded-md bg-white text-xs"
                    />
                  ) : (
                    targetItem?.cooperationDepts && targetItem.cooperationDepts.length > 0 ? (
                      targetItem.cooperationDepts.map((dept: string, dIdx: number) => (
                        <span
                          key={`${targetItem?.id}-dept-${dept}-${dIdx}`}
                          className={`${isLargeFont ? 'text-xs px-2 py-0.5' : 'text-[10px] px-1.5 py-0.5'} font-bold bg-indigo-50/80 text-indigo-800 border border-indigo-200/80 rounded-md`}
                        >
                          {dept}
                        </span>
                      ))
                    ) : null
                  )}
                </div>

                {/* Detailed Task List */}
                <div className="space-y-1">
                  {isEditingThis ? (
                    <div className="space-y-2 p-2.5 bg-slate-50/80 rounded-xl border border-slate-200/80">
                      <div className="text-[11px] font-bold text-slate-600 mb-1 flex items-center justify-between">
                        <span className="flex items-center gap-1.5 text-amber-900 font-extrabold">
                          <span>세부 실행 과업</span>
                          <span className="text-[10px] font-bold text-amber-800 bg-amber-100/80 px-1.5 py-0.5 rounded border border-amber-200/80">
                            날짜 오름차순 자동 정렬
                          </span>
                        </span>
                        <span className="text-[10px] text-slate-500 font-normal">▲▼ 버튼으로 순서 이동 가능</span>
                      </div>
                      {(() => {
                        const activeDetailItems: DetailDraft[] = detailDrafts.length > 0
                          ? detailDrafts
                          : (targetItem?.details || []).map((detail, idx) => ({
                              uid: `m-${targetItem.id}-detail-fallback-${idx}`,
                              raw: detail,
                            }));

                        return (
                          <>
                            {activeDetailItems.map((draft, dIdx) => (
                              <EditableDetailItem
                                key={draft.uid}
                                draft={draft}
                                dIdx={dIdx}
                                totalCount={activeDetailItems.length}
                                milestoneId={targetItem.id}
                                onMoveUp={onMoveUpDetailRow}
                                onMoveDown={onMoveDownDetailRow}
                                onTransfer={onOpenTransferModal}
                                onUpdate={onUpdateDetailRow}
                                onDelete={onDeleteDetailRow}
                              />
                            ))}
                            <button
                              type="button"
                              onClick={onAddDetailRow}
                              className="mt-1 px-2.5 py-1 text-[11px] font-bold bg-amber-50 text-amber-900 rounded-lg border border-amber-200/90 hover:bg-amber-100/80 flex items-center gap-1 cursor-pointer"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>세부 과업 추가</span>
                            </button>
                          </>
                        );
                      })()}
                    </div>
                  ) : (
                    <div className="bg-slate-50/60 rounded-xl border border-slate-200/80 overflow-hidden divide-y divide-slate-200/70 shadow-2xs">
                      {sortDetailsAscending(item.details || []).map((detail: string, dIdx: number) => {
                        const parsed = parseDetail(detail);
                        const isCoopTask = parsed.text.includes('[협조') || detail.includes('[협조');
                        const displayDate = parsed.date ? parsed.date.replace(/\.$/, '') : '상시';
                        const isTimeRange = displayDate.includes('~');
                        const isShortDate = displayDate.length <= 5 && !isTimeRange;

                        return (
                          <div 
                            key={`${item.id}-detail-row-${dIdx}-${detail.slice(0, 20)}`} 
                            className={`p-3 flex items-start gap-3 transition-colors ${
                              isCoopTask 
                                ? 'bg-indigo-50/35 hover:bg-indigo-50/60' 
                                : 'hover:bg-white bg-white/80'
                            }`}
                          >
                            {/* 1. 세로 한 열(Column) 캘린더형 상태 타일 */}
                            <div className={`date-tile shrink-0 flex flex-col items-center justify-center rounded-lg border overflow-hidden shadow-2xs font-mono tabular-nums min-w-[70px] sm:min-w-[76px] text-center mt-0.5 bg-white transition-colors duration-150 ${
                              parsed.status === 'done'
                                ? 'border-emerald-300'
                                : parsed.status === 'in-progress'
                                ? 'border-amber-300'
                                : 'border-slate-300'
                            }`}>
                              <span className={`date-text w-full bg-slate-50 text-slate-900 font-black px-1 py-1.5 tracking-tight border-b border-slate-200/80 break-all leading-snug ${
                                isTimeRange ? 'text-[10.5px] sm:text-[11px]' : isShortDate ? 'text-[14.5px] sm:text-[15px]' : 'text-[13px] sm:text-[13.5px]'
                              }`}>
                                {displayDate}
                              </span>
                              <span className={`status-text w-full px-1 py-1 text-[11px] sm:text-[11.5px] font-black tracking-normal ${
                                parsed.status === 'done'
                                  ? 'bg-emerald-600 text-white'
                                  : parsed.status === 'in-progress'
                                  ? 'bg-amber-500 text-white'
                                  : 'bg-slate-600 text-white'
                              }`}>
                                {parsed.status === 'done' ? '✓ 완료' : parsed.status === 'in-progress' ? '▶ 진행' : '○ 예정'}
                              </span>
                            </div>

                            {/* 3. 본문 텍스트 (개조식 렌더링) 및 참석자 태그 */}
                            <div className="flex-1 min-w-0 pt-0.5 space-y-1.5">
                              <div className="flex items-start justify-between gap-2">
                                <div className={`flex-1 min-w-0 ${parsed.status === 'done' ? 'text-slate-800' : 'text-slate-950 font-medium'}`}>
                                  {renderBulletedContent(parsed.text, isLargeFont)}
                                </div>
                                {isLocalAdmin && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onOpenTransferModal(item.id, dIdx, detail);
                                    }}
                                    className="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 text-[10.5px] font-extrabold text-slate-500 hover:text-amber-950 bg-slate-100 hover:bg-amber-100/90 rounded-md border border-slate-200/80 hover:border-amber-300 transition-colors duration-150 cursor-pointer shadow-3xs active:scale-95"
                                    title="다른 추진과제로 이동"
                                  >
                                    <FolderInput className="w-3 h-3 text-slate-500" />
                                    <span>이동</span>
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </>
  );
});

MilestonesTab.displayName = 'MilestonesTab';
