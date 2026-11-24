import React, { useMemo } from 'react';
import {
  Plus,
  Save,
  X,
  Smartphone,
  ArrowUpDown,
  Building2,
  Tent,
  Users,
  Table,
  Armchair,
  ChevronUp,
  ChevronDown,
  Trash2,
  Edit3,
  User,
  Phone,
  Loader2,
} from 'lucide-react';
import type { BoothItem } from '@/hooks/useYangjaeFestival';
import type { BoothsTabProps } from './types';
import {
  FESTIVAL_CATEGORIES,
  formatAutoHyphen,
  maskPersonName,
} from './festivalUtils';

export const BoothsTab: React.FC<BoothsTabProps> = React.memo(({
  booths,
  editingBooths,
  editBoothsData,
  editingBoothId,
  editSingleBoothData,
  selectedCategory,
  showPrivateMobile,
  isLocalAdmin,
  isLargeFont,
  isPendingSave,
  boothMetrics,
  onSelectCategory,
  onSwitchToggle,
  onStartEditBooths,
  onCancelEditBooths,
  onSaveBooths,
  onStartEditSingleBooth,
  onCancelEditSingleBooth,
  onSaveSingleBooth,
  onUpdateBoothField,
  onUpdateSingleBoothField,
  onMoveBoothUp,
  onMoveBoothDown,
  onAddBooth,
  onDeleteBooth,
}) => {
  const activeBooths = editingBooths ? editBoothsData : booths;

  const filteredBooths = useMemo(() => {
    if (selectedCategory === '전체') return activeBooths;
    if (selectedCategory === '운영본부') {
      return activeBooths.filter(
        (b) => b.category === '운영본부' || b.category === '운영주체' || (typeof b.name === 'string' && b.name.includes('보건행정팀'))
      );
    }
    return activeBooths.filter((b) => b.category === selectedCategory);
  }, [activeBooths, selectedCategory]);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-y-2 gap-x-2 px-1">
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <h3 className={`${isLargeFont ? 'text-base' : 'text-sm'} font-extrabold text-slate-900 flex items-center gap-1.5 whitespace-nowrap shrink-0`}>
            <span className={`inline-block ${isLargeFont ? 'w-3.5 h-3.5 border-2' : 'w-3 h-3 border-[1.5px]'} border-slate-900 rounded-[2px] shrink-0`} />
            <span>부스 배치 계획</span>
          </h3>
          <span className={`inline-flex items-center gap-1 ${isLargeFont ? 'text-xs' : 'text-[11px] sm:text-xs'} font-bold text-slate-700 bg-slate-100/90 border border-slate-200/80 px-2.5 py-1 rounded-full whitespace-nowrap shadow-3xs shrink-0 font-mono tabular-nums`}>
            <span>확정 <strong className="font-black text-slate-900">{boothMetrics.confirmedEntities}</strong> / 총 <strong className="font-black text-slate-900">{boothMetrics.totalEntities}개</strong></span>
            <span className="text-slate-400 mx-0.5">·</span>
            <span className="font-black text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded text-[10px] sm:text-[11px] border border-emerald-200/80">
              필요 {boothMetrics.totalDong}동
            </span>
          </span>
        </div>

        {editingBooths ? (
          <div className="flex items-center gap-1 shrink-0 ml-auto">
            <button
              type="button"
              onClick={onAddBooth}
              className="px-2 py-0.5 text-xs font-bold bg-amber-50 text-amber-900 rounded-md border border-amber-200/90 hover:bg-amber-100/80 flex items-center gap-0.5 cursor-pointer whitespace-nowrap"
              title="부스 추가"
            >
              <Plus className="w-3 h-3" />
              <span>추가</span>
            </button>
            <button
              type="button"
              onClick={onSaveBooths}
              disabled={isPendingSave}
              className="px-2 py-0.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-md flex items-center gap-0.5 cursor-pointer whitespace-nowrap"
              title="부스 저장"
            >
              {isPendingSave ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
              <span>저장</span>
            </button>
            <button
              type="button"
              onClick={onCancelEditBooths}
              className="px-2 py-0.5 text-xs font-bold bg-slate-600 hover:bg-slate-500 text-white rounded-md flex items-center gap-0.5 cursor-pointer whitespace-nowrap"
              title="취소"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 ml-auto shrink-0">
            <button
              type="button"
              onClick={onSwitchToggle}
              className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full border border-slate-200/80 bg-slate-100/80 hover:bg-slate-200/70 transition-colors duration-150 cursor-pointer shadow-3xs select-none"
              title={showPrivateMobile ? "비상연락망 켜짐 (클릭 시 끄기)" : "비상연락망 꺼짐 (클릭 시 비밀번호 인증 후 켜기)"}
            >
              <span className="text-[11px] font-extrabold text-slate-700 flex items-center gap-1">
                <Smartphone className="w-3.5 h-3.5 text-slate-600" />
                <span>비상연락망</span>
              </span>
              {/* Toggle Track */}
              <span className={`w-8 h-4.5 rounded-full p-0.5 transition-colors duration-200 ease-in-out inline-flex items-center ${showPrivateMobile ? 'bg-emerald-500' : 'bg-slate-300'}`}>
                {/* Toggle Knob */}
                <span className={`w-3.5 h-3.5 rounded-full bg-white shadow-xs transform transition-transform duration-200 ease-in-out ${showPrivateMobile ? 'translate-x-3.5' : 'translate-x-0'}`} />
              </span>
              <span className={`text-[10px] font-black px-1.5 py-0.2 rounded border ${showPrivateMobile ? 'bg-emerald-50 text-emerald-800 border-emerald-200/80' : 'bg-slate-200/80 text-slate-600 border-slate-300/80'}`}>
                {showPrivateMobile ? 'ON (보임)' : 'OFF (숨김)'}
              </span>
            </button>
            {isLocalAdmin && (
              <button
                type="button"
                onClick={onStartEditBooths}
                className="px-2.5 py-1 text-xs font-extrabold bg-amber-50 hover:bg-amber-100/80 text-amber-950 rounded-lg border border-amber-200/90 flex items-center gap-1 cursor-pointer transition-colors shadow-3xs whitespace-nowrap shrink-0"
                title="부스 순서 변경 및 현황 수정"
              >
                <ArrowUpDown className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                <span>순서 변경 / 편집</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Booth Summary Metrics Card */}
      <div className="bg-slate-900 text-white rounded-xl shadow-2xs border border-slate-800 p-3 sm:p-3.5 space-y-3">
        <div className="grid grid-cols-2 divide-x divide-slate-800 gap-x-3 sm:gap-x-4">
          {/* Col 1: 총 부스 참여 주체 */}
          <div className="flex flex-col justify-between pr-1">
            <div className="flex items-center gap-1.5 sm:gap-2 mb-1.5">
              <div className="w-6 h-6 rounded-md bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0">
                <Building2 className="w-3.5 h-3.5 text-slate-300" />
              </div>
              <span className="text-[11px] sm:text-xs font-bold text-slate-300 whitespace-nowrap">
                총 부스 참여 주체
              </span>
            </div>

            <div className="py-0.5">
              <div className={`${isLargeFont ? 'text-2xl' : 'text-xl sm:text-2xl'} font-mono tabular-nums font-black text-white tracking-tight whitespace-nowrap`}>
                총 {boothMetrics.totalEntities}개 기관
              </div>
            </div>

            <div className="mt-2 pt-2 border-t border-slate-800/90 flex items-center gap-1 sm:gap-1.5 flex-wrap font-mono tabular-nums">
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] sm:text-[11px] font-extrabold bg-slate-800 text-slate-200 border border-slate-700 whitespace-nowrap">
                확정 {boothMetrics.confirmedEntities}
              </span>
              {boothMetrics.pendingEntities > 0 && (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] sm:text-[11px] font-bold bg-slate-800/80 text-slate-300 border border-slate-700 whitespace-nowrap">
                  협의 {boothMetrics.pendingEntities}
                </span>
              )}
              {boothMetrics.hqEntities > 0 && (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] sm:text-[11px] font-extrabold bg-amber-950/70 text-amber-300 border border-amber-800/60 whitespace-nowrap" title="보건행정팀 운영본부 1개소">
                  본부 {boothMetrics.hqEntities}
                </span>
              )}
            </div>
          </div>

          {/* Col 2: 총 필요 부스 규모 */}
          <div className="flex flex-col justify-between pl-3 sm:pl-4">
            <div className="flex items-center gap-1.5 sm:gap-2 mb-1.5">
              <div className="w-6 h-6 rounded-md bg-emerald-950/60 border border-emerald-800/60 flex items-center justify-center shrink-0">
                <Tent className="w-3.5 h-3.5 text-emerald-400" />
              </div>
              <span className="text-[11px] sm:text-xs font-bold text-slate-300 whitespace-nowrap">
                총 필요 부스 규모
              </span>
            </div>

            <div className="py-0.5">
              <div className={`${isLargeFont ? 'text-2xl' : 'text-xl sm:text-2xl'} font-mono tabular-nums font-black text-emerald-400 tracking-tight whitespace-nowrap`}>
                총 {boothMetrics.totalDong}동
              </div>
            </div>

            <div className="mt-2 pt-2 border-t border-slate-800/90 flex items-center gap-1 sm:gap-1.5 flex-wrap font-mono tabular-nums">
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] sm:text-[11px] font-extrabold bg-emerald-950/70 text-emerald-300 border border-emerald-800/60 whitespace-nowrap">
                확정 {boothMetrics.confirmedDong}동
              </span>
              {boothMetrics.pendingDong > 0 && (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] sm:text-[11px] font-bold bg-amber-950/60 text-amber-300 border border-amber-800/60 whitespace-nowrap">
                  협의 {boothMetrics.pendingDong}동
                </span>
              )}
              {boothMetrics.totalBus > 0 && (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] sm:text-[11px] font-bold bg-sky-950/70 text-sky-300 border border-sky-800/60 whitespace-nowrap">
                  버스 {boothMetrics.totalBus}대
                </span>
              )}
            </div>
          </div>

          {/* Row 4: 물품 소요 (필요 집기 및 인원 총계) */}
          <div className="col-span-2 mt-2.5 pt-2 border-t border-slate-800/90 flex items-center justify-between gap-2 flex-wrap">
            <span className="text-[11px] sm:text-xs font-bold text-slate-400">필요 집기 및 인원 총계</span>
            <div className="flex items-center gap-1.5 sm:gap-2 font-mono tabular-nums">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10.5px] sm:text-[11.5px] font-extrabold bg-slate-800 text-slate-300 border border-slate-700 shadow-3xs">
                <Users className="w-3 h-3 text-slate-400 shrink-0" />
                <span>인원</span>
                <strong className="text-white font-black">{boothMetrics.totalStaff}명</strong>
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10.5px] sm:text-[11.5px] font-extrabold bg-slate-800 text-slate-300 border border-slate-700 shadow-3xs">
                <span>테이블</span>
                <strong className="text-white font-black">{boothMetrics.totalTables}개</strong>
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10.5px] sm:text-[11.5px] font-extrabold bg-slate-800 text-slate-300 border border-slate-700 shadow-3xs">
                <span>의자</span>
                <strong className="text-white font-black">{boothMetrics.totalChairs}개</strong>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Category Filter Pills */}
      <div className="flex flex-wrap gap-1.5 pb-1">
        {FESTIVAL_CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => onSelectCategory(cat)}
            className={`${isLargeFont ? 'px-3 py-1.5 text-sm' : 'px-2.5 py-1 text-xs'} rounded-lg font-bold whitespace-nowrap border cursor-pointer transition-colors ${
              selectedCategory === cat
                ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                : 'bg-white text-slate-600 border-slate-200/80 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Editing Guidance Banner */}
      {editingBooths && (
        <div className="bg-amber-50/80 border border-amber-200/90 rounded-lg p-2.5 text-xs text-amber-950 flex items-center justify-between shadow-3xs">
          <div className="flex items-center gap-1.5">
            <span className="font-extrabold bg-amber-200/80 text-amber-900 px-1.5 py-0.5 rounded text-[10.5px]">순서 변경</span>
            <span><strong>▲ / ▼</strong> 순서 조정 → 상단 <strong>[저장]</strong> 클릭</span>
          </div>
        </div>
      )}

      {/* Booths Cards List */}
      <div className={editingBooths ? 'space-y-2.5' : 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5 items-start'}>
        {filteredBooths.map((booth, fIdx) => {
          const isHQ = booth.category === '운영본부' || booth.category === '운영주체' || (typeof booth.name === 'string' && booth.name.includes('보건행정팀'));
          const operatingBooths = activeBooths.filter(
            (b) => b.category !== '운영본부' && b.category !== '운영주체' && !(typeof b.name === 'string' && b.name.includes('보건행정팀'))
          );
          const opIdx = operatingBooths.findIndex((b) => b.id === booth.id);
          const displayNo = opIdx !== -1 ? opIdx + 1 : booth.id;
          const canMoveUp = fIdx > 0;
          const canMoveDown = fIdx < filteredBooths.length - 1;

          const isEditingSingle = editingBoothId === booth.id;
          const isEditingThis = editingBooths || isEditingSingle;
          const targetBooth = (isEditingSingle ? editSingleBoothData : (editingBooths ? editBoothsData.find((b) => b.id === booth.id) : booth)) || booth;

          const handleFieldChange = (field: keyof BoothItem, value: any) => {
            if (isEditingSingle) {
              onUpdateSingleBoothField(field, value);
            } else if (editingBooths) {
              onUpdateBoothField(booth.id, field, value);
            }
          };

          return (
            <div 
              key={`booth-card-${booth.id}`}
              className={`vlds-cv-card p-3.5 bg-white border rounded-xl transition-colors duration-150 ${
                isHQ
                  ? 'border-amber-300/90 bg-amber-50/15 shadow-2xs'
                  : isEditingSingle
                  ? 'border-emerald-500 ring-1 ring-emerald-200 bg-emerald-50/10 shadow-sm'
                  : editingBooths
                  ? 'border-amber-300 ring-1 ring-amber-200/80 shadow-2xs'
                  : 'border-slate-200/80 hover:border-slate-300 shadow-2xs'
              }`}
            >
              <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-slate-100">
                <div className="flex items-center gap-1.5">
                  {isHQ ? (
                    <span className={`${isLargeFont ? 'text-xs' : 'text-[11px]'} font-extrabold text-amber-900 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200/90 shadow-3xs`}>
                      운영본부
                    </span>
                  ) : (
                    <span className={`${isLargeFont ? 'text-xs' : 'text-[11px]'} font-mono tabular-nums font-black text-slate-700`}>
                      No.{displayNo}
                    </span>
                  )}
                  {isEditingThis && (
                    <input
                      type="text"
                      value={targetBooth.category}
                      onChange={(e) => handleFieldChange('category', e.target.value)}
                      className="px-1.5 py-0.5 border border-amber-400 rounded-md bg-white text-xs font-bold w-24"
                      placeholder="카테고리"
                    />
                  )}
                </div>

                <div className="flex items-center gap-1.5">
                  {isEditingSingle ? (
                    <div className="flex items-center gap-1">
                      <select
                        value={targetBooth.status}
                        onChange={(e) => handleFieldChange('status', e.target.value)}
                        className="px-1.5 py-0.5 text-xs font-bold border border-emerald-400 rounded-md bg-white cursor-pointer"
                      >
                        <option value="확정">확정</option>
                        <option value="협의중">협의중</option>
                        <option value="신청완료">신청완료</option>
                      </select>
                      <button
                        type="button"
                        onClick={onSaveSingleBooth}
                        disabled={isPendingSave}
                        className="px-2 py-0.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-md flex items-center gap-0.5 cursor-pointer shadow-3xs transition-colors duration-150 active:scale-95"
                        title="부스 저장"
                      >
                        {isPendingSave ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                        <span>저장</span>
                      </button>
                      <button
                        type="button"
                        onClick={onCancelEditSingleBooth}
                        className="px-1.5 py-0.5 text-xs font-bold bg-slate-600 hover:bg-slate-500 text-white rounded-md flex items-center gap-0.5 cursor-pointer shadow-3xs transition-colors duration-150 active:scale-95"
                        title="취소"
                      >
                        <X className="w-3 h-3" />
                        <span>취소</span>
                      </button>
                    </div>
                  ) : editingBooths ? (
                    <div className="flex items-center gap-1">
                      {/* 순서 변경 버튼 그룹 (▲ 위로 / ▼ 아래로) */}
                      <div className="flex items-center gap-0.5 bg-slate-100 p-0.5 rounded-md border border-slate-200/80">
                        <button
                          type="button"
                          disabled={!canMoveUp}
                          onClick={() => onMoveBoothUp(booth.id)}
                          className={`p-1 rounded cursor-pointer transition-colors ${
                            canMoveUp
                              ? 'text-slate-700 hover:bg-slate-200 hover:text-slate-900 active:scale-95'
                              : 'text-slate-300 cursor-not-allowed opacity-40'
                          }`}
                          title="위로 이동"
                          aria-label={`${booth.name} 위로 이동`}
                        >
                          <ChevronUp className="w-3.5 h-3.5 stroke-[2.5]" />
                        </button>
                        <button
                          type="button"
                          disabled={!canMoveDown}
                          onClick={() => onMoveBoothDown(booth.id)}
                          className={`p-1 rounded cursor-pointer transition-colors ${
                            canMoveDown
                              ? 'text-slate-700 hover:bg-slate-200 hover:text-slate-900 active:scale-95'
                              : 'text-slate-300 cursor-not-allowed opacity-40'
                          }`}
                          title="아래로 이동"
                          aria-label={`${booth.name} 아래로 이동`}
                        >
                          <ChevronDown className="w-3.5 h-3.5 stroke-[2.5]" />
                        </button>
                      </div>

                      <select
                        value={targetBooth.status}
                        onChange={(e) => handleFieldChange('status', e.target.value)}
                        className="px-1.5 py-0.5 text-xs font-bold border border-amber-400 rounded-md bg-white cursor-pointer"
                      >
                        <option value="확정">확정</option>
                        <option value="협의중">협의중</option>
                        <option value="신청완료">신청완료</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => onDeleteBooth(booth.id)}
                        className="p-1 text-red-500 hover:bg-red-50 rounded-md cursor-pointer"
                        title="부스 삭제"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <span className={`${isLargeFont ? 'text-xs px-2.5 py-1' : 'text-[11px] px-2 py-0.5'} font-bold rounded-md border ${
                        booth.status === '확정'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200/90'
                          : 'bg-amber-50 text-amber-800 border-amber-200/90'
                      }`}>
                        {booth.status}
                      </span>
                      {isLocalAdmin && !editingBooths && (
                        <button
                          type="button"
                          onClick={() => onStartEditSingleBooth(booth)}
                          className="px-2 py-0.5 text-xs font-bold bg-slate-50 hover:bg-amber-50 text-slate-600 hover:text-amber-900 border border-slate-200/80 hover:border-amber-300 rounded-md flex items-center gap-1 cursor-pointer transition-colors shadow-3xs"
                          title="부스 정보 수정"
                        >
                          <Edit3 className="w-3 h-3 text-slate-500" />
                          <span>수정</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {isEditingThis ? (
                <>
                  <input
                    type="text"
                    value={targetBooth.name}
                    onChange={(e) => handleFieldChange('name', e.target.value)}
                    className="w-full px-2 py-1 border border-amber-400 rounded-md bg-white text-sm font-extrabold mb-1.5"
                    placeholder="부스 이름"
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 bg-amber-50/50 p-2 rounded-lg border border-amber-200/80 mb-2">
                    {/* 1. 담당자 */}
                    <div className="flex items-center gap-1.5 min-w-0">
                      <User className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                      <span className="text-xs font-bold text-slate-700 whitespace-nowrap shrink-0">담당자:</span>
                      <input
                        type="text"
                        value={targetBooth.manager ?? ''}
                        onChange={(e) => handleFieldChange('manager', e.target.value)}
                        className="px-2 py-0.5 border border-amber-400 rounded-md bg-white text-xs flex-1 font-bold text-slate-900 min-w-0"
                        placeholder="예: 오창선 주무관"
                      />
                    </div>

                    {/* 2. 행정번호 (유선) */}
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Phone className="w-3.5 h-3.5 text-blue-700 shrink-0" />
                      <span className="text-xs font-bold text-blue-900 whitespace-nowrap shrink-0">행정번호:</span>
                      <input
                        type="text"
                        value={targetBooth.adminPhone ?? (!targetBooth.phone?.startsWith('010') ? targetBooth.phone : '') ?? ''}
                        onChange={(e) => handleFieldChange('adminPhone', e.target.value)}
                        className="px-2 py-0.5 border border-amber-400 rounded-md bg-white text-xs flex-1 font-mono font-bold text-slate-900 min-w-0"
                        placeholder="예: 02-3423-7116"
                      />
                    </div>

                    {/* 3. 폰번호 (휴대전화) */}
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Smartphone className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                      <span className="text-xs font-bold text-emerald-900 whitespace-nowrap shrink-0">폰번호:</span>
                      <input
                        type="text"
                        value={targetBooth.mobilePhone ?? (targetBooth.phone?.startsWith('010') ? targetBooth.phone : '') ?? ''}
                        onChange={(e) => handleFieldChange('mobilePhone', e.target.value)}
                        className="px-2 py-0.5 border border-amber-400 rounded-md bg-white text-xs flex-1 font-mono font-bold text-slate-900 min-w-0"
                        placeholder="예: 010-8494-0544"
                      />
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className={`${isLargeFont ? 'text-base' : 'text-sm'} font-extrabold text-slate-900 mb-1`}>
                    {booth.name}
                  </div>
                  {(() => {
                    const adminNo = formatAutoHyphen((booth.adminPhone || (!booth.phone?.startsWith('010') ? booth.phone : '') || '').trim());
                    const mobileNo = formatAutoHyphen((booth.mobilePhone || (booth.phone?.startsWith('010') ? booth.phone : '') || '').trim());

                    const isMobileVisible = showPrivateMobile && !!mobileNo;
                    if (!booth.manager && !adminNo && !isMobileVisible) return null;

                    return (
                      <div className="flex items-center gap-1 sm:gap-1.5 flex-nowrap overflow-x-auto no-scrollbar mb-2 whitespace-nowrap py-0.5">
                        {/* 담당자 뱃지 */}
                        {booth.manager && (
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100/90 text-slate-800 border border-slate-200/80 ${isLargeFont ? 'text-xs' : 'text-[10.5px] sm:text-[11px]'} font-bold shrink-0 shadow-3xs`}>
                            <User className="w-3 h-3 text-slate-500 shrink-0" />
                            <span>담당: {showPrivateMobile ? booth.manager : maskPersonName(booth.manager)}</span>
                          </span>
                        )}

                        {/* 행정번호 뱃지 (유선) */}
                        {adminNo && (
                          <a
                            href={`tel:${adminNo.replace(/[^0-9]/g, '')}`}
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full ${isLargeFont ? 'text-xs' : 'text-[10.5px] sm:text-[11px]'} font-bold bg-blue-50/80 hover:bg-blue-100/80 text-blue-950 border border-blue-200/80 shadow-3xs transition-colors duration-150 cursor-pointer active:scale-95 shrink-0`}
                            title={`행정전화 걸기: ${adminNo}`}
                          >
                            <Phone className="w-2.5 h-2.5 text-blue-700 shrink-0" />
                            <span className="font-extrabold text-blue-900">행정:</span>
                            <span className="font-mono tabular-nums font-bold tracking-tight text-blue-950">
                              {adminNo}
                            </span>
                          </a>
                        )}

                        {/* 폰번호 뱃지 (휴대전화) */}
                        {isMobileVisible && (
                          <a
                            href={`tel:${mobileNo.replace(/[^0-9]/g, '')}`}
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full ${isLargeFont ? 'text-xs' : 'text-[10.5px] sm:text-[11px]'} font-bold bg-emerald-50/80 hover:bg-emerald-100/80 text-emerald-950 border border-emerald-200/80 shadow-3xs transition-colors duration-150 cursor-pointer active:scale-95 shrink-0`}
                            title={`휴대전화 걸기: ${mobileNo}`}
                          >
                            <Smartphone className="w-2.5 h-2.5 text-emerald-700 shrink-0" />
                            <span className="font-extrabold text-emerald-900">폰:</span>
                            <span className="font-mono tabular-nums font-bold tracking-tight text-emerald-950">
                              {mobileNo}
                            </span>
                          </a>
                        )}
                      </div>
                    );
                  })()}
                </>
              )}

              {isEditingThis ? (
                <div className="space-y-1 bg-slate-50/80 p-2.5 rounded-lg border border-slate-200/80 mb-1.5">
                  <span className="font-bold text-xs text-slate-600">내용:</span>
                  <textarea
                    value={targetBooth.program}
                    onChange={(e) => handleFieldChange('program', e.target.value)}
                    className="w-full px-2 py-1 border border-amber-400 rounded-md bg-white text-xs leading-relaxed"
                    rows={2}
                  />
                </div>
              ) : (
                <div className={`${isLargeFont ? 'text-sm' : 'text-xs'} text-slate-700 bg-slate-50/70 p-2.5 rounded-lg border border-slate-200/80 leading-relaxed mb-1.5`}>
                  <span className="font-bold text-slate-600">내용: </span>{booth.program}
                </div>
              )}

              {isEditingThis ? (
                <div className="space-y-2 pt-1.5 border-t border-dashed border-amber-200">
                  <div className="flex items-center gap-1.5 w-full">
                    <span className="text-xs font-bold text-slate-700 whitespace-nowrap shrink-0">부스규모:</span>
                    <input
                      type="text"
                      value={targetBooth.scale}
                      onChange={(e) => handleFieldChange('scale', e.target.value)}
                      className="px-2 py-0.5 border border-amber-400 rounded-md bg-white text-xs flex-1 font-bold"
                      placeholder="예: 2동, 1동 + 검진버스"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2 bg-amber-50/60 p-2 rounded-lg border border-amber-200/80 font-mono tabular-nums">
                    <div className="flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-indigo-800 shrink-0" />
                      <span className="text-xs font-bold text-slate-800 whitespace-nowrap shrink-0">인원:</span>
                      <input
                        type="number"
                        min="0"
                        max="99"
                        value={targetBooth.staffCount ?? 0}
                        onChange={(e) => handleFieldChange('staffCount', Math.max(0, parseInt(e.target.value, 10) || 0))}
                        className="w-12 sm:w-14 px-1.5 py-0.5 border border-amber-400 rounded-md bg-white text-xs font-black text-indigo-950 text-right"
                      />
                      <span className="text-xs font-bold text-slate-600">명</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Table className="w-3.5 h-3.5 text-amber-800 shrink-0" />
                      <span className="text-xs font-bold text-slate-800 whitespace-nowrap shrink-0">테이블:</span>
                      <input
                        type="number"
                        min="0"
                        max="99"
                        value={targetBooth.tables ?? 0}
                        onChange={(e) => handleFieldChange('tables', Math.max(0, parseInt(e.target.value, 10) || 0))}
                        className="w-12 sm:w-14 px-1.5 py-0.5 border border-amber-400 rounded-md bg-white text-xs font-black text-amber-950 text-right"
                      />
                      <span className="text-xs font-bold text-slate-600">개</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Armchair className="w-3.5 h-3.5 text-sky-800 shrink-0" />
                      <span className="text-xs font-bold text-slate-800 whitespace-nowrap shrink-0">의자:</span>
                      <input
                        type="number"
                        min="0"
                        max="99"
                        value={targetBooth.chairs ?? 0}
                        onChange={(e) => handleFieldChange('chairs', Math.max(0, parseInt(e.target.value, 10) || 0))}
                        className="w-12 sm:w-14 px-1.5 py-0.5 border border-amber-400 rounded-md bg-white text-xs font-black text-sky-950 text-right"
                      />
                      <span className="text-xs font-bold text-slate-600">개</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className={`${isLargeFont ? 'text-sm' : 'text-xs'} text-slate-600 font-medium flex flex-wrap items-center justify-between gap-y-1.5 gap-x-2 pt-1.5 border-t border-slate-100`}>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span>부스규모: <strong className="text-slate-900 font-mono tabular-nums">{booth.scale}</strong></span>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap font-mono tabular-nums">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] sm:text-xs font-bold bg-slate-100/80 text-slate-800 border border-slate-200/80 shadow-3xs">
                      <Users className="w-3 h-3 text-slate-600 shrink-0" />
                      <span>인원 <strong>{booth.staffCount ?? 0}</strong>명</span>
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] sm:text-xs font-bold bg-slate-100/80 text-slate-800 border border-slate-200/80 shadow-3xs">
                      <Table className="w-3 h-3 text-slate-600 shrink-0" />
                      <span>테이블 <strong>{booth.tables ?? 0}</strong>개</span>
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] sm:text-xs font-bold bg-slate-100/80 text-slate-800 border border-slate-200/80 shadow-3xs">
                      <Armchair className="w-3 h-3 text-slate-600 shrink-0" />
                      <span>의자 <strong>{booth.chairs ?? 0}</strong>개</span>
                    </span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
});

BoothsTab.displayName = 'BoothsTab';
