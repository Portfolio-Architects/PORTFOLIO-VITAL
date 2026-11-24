'use client';

import React, { useState, useCallback } from 'react';
import { Modal } from '@/components/ui/modal';
import { SimulationInputForm } from './SimulationInputForm';
import { SimulationEntry, StatItemSimulationSummary } from '@/types';
import { Sparkles, RotateCcw, ChevronDown, ChevronUp } from 'lucide-react';

export interface SimulationInputModalProps {
  isOpen: boolean;
  onClose: () => void;
  detailedProjects: string[];
  getStatItemsForProject: (dp: string) => string[];
  statItemSummaries?: StatItemSimulationSummary[];
  editingEntry?: SimulationEntry | null;
  onAddEntry: (entry: Omit<SimulationEntry, 'id' | 'createdAt' | 'amount'> & { amount?: number }) => void;
  onUpdateEntry: (id: string, partial: Partial<SimulationEntry>) => void;
  onResetAll?: () => void;
  onLoadTestPreset?: () => void;
}

export const SimulationInputModal: React.FC<SimulationInputModalProps> = React.memo(({
  isOpen,
  onClose,
  detailedProjects,
  getStatItemsForProject,
  statItemSummaries,
  editingEntry,
  onAddEntry,
  onUpdateEntry,
  onResetAll,
  onLoadTestPreset,
}) => {
  const [showAdvancedTools, setShowAdvancedTools] = useState(false);

  const isEditMode = Boolean(editingEntry && editingEntry.id);

  const handleAddAndClose = useCallback(
    (entry: Omit<SimulationEntry, 'id' | 'createdAt' | 'amount'> & { amount?: number }) => {
      onAddEntry(entry);
      onClose();
    },
    [onAddEntry, onClose]
  );

  const handleUpdateAndClose = useCallback(
    (id: string, partial: Partial<SimulationEntry>) => {
      onUpdateEntry(id, partial);
      onClose();
    },
    [onUpdateEntry, onClose]
  );

  const handleSafeLoadPreset = useCallback(() => {
    if (!onLoadTestPreset) return;
    if (window.confirm('현재 지출 예정 목록을 표준 테스트 프리셋으로 교체할까요? (기존 예정 항목은 덮어쓰기됨)')) {
      onLoadTestPreset();
      onClose();
    }
  }, [onLoadTestPreset, onClose]);

  const handleSafeResetAll = useCallback(() => {
    if (!onResetAll) return;
    if (window.confirm('등록된 지출 예정 항목을 모두 초기화할까요? (실집행 원장은 보존됨)')) {
      onResetAll();
      onClose();
    }
  }, [onResetAll, onClose]);

  const hasSecondaryActions = Boolean(onLoadTestPreset || onResetAll);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditMode ? '지출 예정 항목 수정' : '지출 예정 내역 등록'}
      size="xl"
      footer={
        hasSecondaryActions ? (
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setShowAdvancedTools((prev) => !prev)}
                className="text-xs font-semibold text-slate-500 hover:text-slate-800 flex items-center gap-1 transition-colors cursor-pointer"
              >
                {showAdvancedTools ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                보조 도구 (프리셋 · 초기화)
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-1.5 rounded-lg bg-white hover:bg-slate-100 border border-slate-200/90 text-slate-600 text-xs font-bold transition-colors cursor-pointer"
              >
                닫기
              </button>
            </div>
            {showAdvancedTools && (
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200/70">
                <span className="text-[11px] text-slate-500 font-medium">
                  실집행 원장 무영향 · 예정 목록 전용 도구
                </span>
                <div className="flex items-center gap-2">
                  {onLoadTestPreset && (
                    <button
                      type="button"
                      onClick={handleSafeLoadPreset}
                      className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 border border-slate-200/90 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                      프리셋 로드
                    </button>
                  )}
                  {onResetAll && (
                    <button
                      type="button"
                      onClick={handleSafeResetAll}
                      className="px-3 py-1.5 rounded-lg bg-white hover:bg-rose-50 border border-slate-200/90 hover:border-rose-200 text-slate-500 hover:text-rose-600 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      예정 전체 초기화
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : undefined
      }
    >
      <SimulationInputForm
        detailedProjects={detailedProjects}
        getStatItemsForProject={getStatItemsForProject}
        statItemSummaries={statItemSummaries}
        editingEntry={editingEntry}
        onAddEntry={handleAddAndClose}
        onUpdateEntry={handleUpdateAndClose}
        onCancelEdit={onClose}
        embedded
      />
    </Modal>
  );
});

SimulationInputModal.displayName = 'SimulationInputModal';
