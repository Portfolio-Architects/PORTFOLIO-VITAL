import React from 'react';
import { FolderInput, X, ArrowRightLeft, Loader2 } from 'lucide-react';
import { parseDetail } from './festivalUtils';
import type { SubTaskTransferModalProps } from './types';

export const SubTaskTransferModal: React.FC<SubTaskTransferModalProps> = React.memo(({
  isOpen,
  transferTarget,
  currentMilestones,
  selectedTargetMilestoneId,
  isTransferring,
  onSelectTarget,
  onExecute,
  onClose,
}) => {
  if (!isOpen || !transferTarget) return null;

  const sourceMilestone = currentMilestones.find((m) => m.id === transferTarget.sourceMilestoneId);
  const parsedPreview = parseDetail(transferTarget.detailRaw);
  const isTimeRange = parsedPreview.date.includes('~');
  const isShortDate = parsedPreview.date.length <= 5 && !isTimeRange;
  const displayDate = parsedPreview.date ? parsedPreview.date.replace(/\.$/, '') : '상시';
  const otherMilestones = currentMilestones.filter((m) => m.id !== transferTarget.sourceMilestoneId);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
      <div 
        className="bg-white rounded-xl shadow-2xl border border-slate-200/90 w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
        aria-labelledby="transfer-modal-title"
      >
        {/* Modal Header */}
        <div className="bg-slate-900 text-white px-4 py-3 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-amber-500/20 border border-amber-400/30 flex items-center justify-center text-amber-400">
              <FolderInput className="w-4 h-4" />
            </div>
            <div>
              <h3 id="transfer-modal-title" className="text-sm font-black tracking-tight text-white flex items-center gap-1.5">
                세부 과업 카테고리 이동
              </h3>
              <p className="text-[11px] text-slate-400 font-medium">과업을 다른 추진과제 카테고리로 재분류합니다.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isTransferring}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="닫기"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 overflow-y-auto space-y-4 text-slate-800">
          {/* Section 1: 이동 대상 과업 미리보기 */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs font-bold text-slate-600">
              <span>이동할 세부 과업</span>
              <span className="text-[11px] font-semibold text-slate-500">
                현재 소속: <strong className="text-amber-800 font-black">{sourceMilestone ? `${sourceMilestone.number || '추진과제'}. ${sourceMilestone.title}` : '미확인'}</strong>
              </span>
            </div>
            <div className="p-3 bg-slate-50/70 rounded-xl border border-slate-200/80 flex items-start gap-3 shadow-2xs">
              <div className={`shrink-0 flex flex-col items-center justify-center rounded-lg border overflow-hidden shadow-2xs font-mono tabular-nums min-w-[64px] text-center bg-white ${
                parsedPreview.status === 'done'
                  ? 'border-emerald-300'
                  : parsedPreview.status === 'in-progress'
                  ? 'border-amber-300'
                  : 'border-slate-300'
              }`}>
                <span className={`w-full bg-slate-50 text-slate-900 font-black px-1 py-1 text-xs border-b border-slate-200/80 ${
                  isTimeRange ? 'text-[10px]' : isShortDate ? 'text-xs' : 'text-[11px]'
                }`}>
                  {displayDate}
                </span>
                <span className={`w-full px-1 py-0.5 text-[10px] font-black ${
                  parsedPreview.status === 'done'
                    ? 'bg-emerald-600 text-white'
                    : parsedPreview.status === 'in-progress'
                    ? 'bg-amber-500 text-white'
                    : 'bg-slate-600 text-white'
                }`}>
                  {parsedPreview.status === 'done' ? '✓ 완료' : parsedPreview.status === 'in-progress' ? '▶ 진행' : '○ 예정'}
                </span>
              </div>
              <div className="flex-1 min-w-0 pt-0.5 space-y-1">
                <div className="text-xs font-bold text-slate-900 leading-snug">
                  {parsedPreview.text}
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: 이동할 목표 추진과제 선택 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-slate-700">
              <span className="flex items-center gap-1">
                <ArrowRightLeft className="w-3.5 h-3.5 text-amber-600" />
                <span>이동할 대상 추진과제 선택</span>
              </span>
              <span className="text-[10.5px] font-normal text-slate-500">
                선택한 과제의 맨 아래로 배치됩니다.
              </span>
            </div>

            {otherMilestones.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-500 bg-slate-50 rounded-xl border border-dashed border-slate-300">
                이동할 수 있는 다른 추진과제가 없습니다.
              </div>
            ) : (
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {currentMilestones.map((m) => {
                  const isCurrent = m.id === transferTarget.sourceMilestoneId;
                  const isSelected = selectedTargetMilestoneId === m.id;

                  if (isCurrent) {
                    return (
                      <div
                        key={`transfer-dest-${m.id}`}
                        className="p-2.5 rounded-xl border border-slate-200/80 bg-slate-100/70 opacity-60 flex items-center justify-between text-xs cursor-not-allowed"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-bold text-slate-400 font-mono tabular-nums text-[11px] shrink-0">{m.number || `과제 ${m.id}`}</span>
                          <span className="font-medium text-slate-500 truncate">{m.title}</span>
                        </div>
                        <span className="text-[10.5px] font-bold text-slate-400 bg-slate-200 px-2 py-0.5 rounded-full shrink-0">
                          현재 위치
                        </span>
                      </div>
                    );
                  }

                  return (
                    <button
                      key={`transfer-dest-${m.id}`}
                      type="button"
                      disabled={isTransferring}
                      onClick={() => onSelectTarget(m.id)}
                      className={`w-full p-2.5 rounded-xl border transition-colors duration-150 flex items-center justify-between text-left cursor-pointer active:scale-[0.99] ${
                        isSelected
                          ? 'border-amber-400 bg-amber-50/70 shadow-2xs ring-1 ring-amber-300/50'
                          : 'border-slate-200/80 bg-white hover:border-slate-300 hover:bg-slate-50/60'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                          isSelected ? 'border-amber-600 bg-amber-500 text-white' : 'border-slate-300 bg-white'
                        }`}>
                          {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                        </div>
                        <span className={`font-mono tabular-nums text-xs font-black shrink-0 ${isSelected ? 'text-amber-900' : 'text-slate-700'}`}>
                          {m.number || `과제 ${m.id}`}
                        </span>
                        <span className={`text-xs font-bold truncate ${isSelected ? 'text-amber-950 font-black' : 'text-slate-900'}`}>
                          {m.title}
                        </span>
                      </div>
                      <span className="text-[11px] font-mono tabular-nums font-medium text-slate-500 shrink-0 ml-2">
                        {m.details?.length || 0}개 과업
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-50/80 px-4 py-3 border-t border-slate-200/80 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isTransferring}
            className="px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-200/70 rounded-lg border border-slate-200/80 transition-colors cursor-pointer"
          >
            취소
          </button>
          <button
            type="button"
            onClick={onExecute}
            disabled={isTransferring || !selectedTargetMilestoneId || selectedTargetMilestoneId === transferTarget.sourceMilestoneId}
            className={`px-4 py-1.5 text-xs font-black text-white rounded-lg flex items-center gap-1.5 shadow-2xs transition-colors duration-150 ${
              isTransferring || !selectedTargetMilestoneId || selectedTargetMilestoneId === transferTarget.sourceMilestoneId
                ? 'bg-slate-400 cursor-not-allowed opacity-60'
                : 'bg-slate-900 hover:bg-slate-800 active:scale-95 cursor-pointer'
            }`}
          >
            {isTransferring ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>이동 저장 중...</span>
              </>
            ) : (
              <>
                <ArrowRightLeft className="w-3.5 h-3.5" />
                <span>과업 이동 실행</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
});

SubTaskTransferModal.displayName = 'SubTaskTransferModal';
