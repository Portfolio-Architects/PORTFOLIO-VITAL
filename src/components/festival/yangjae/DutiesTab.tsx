import React, { useMemo } from 'react';
import {
  FileSpreadsheet,
  Smartphone,
  Loader2,
  Download,
  Plus,
  Save,
  X,
  Edit3,
  Search,
  ArrowRightLeft,
  Layers,
  ChevronLeft,
  ChevronRight,
  ArrowUp,
  ArrowDown,
  Trash2,
  Users,
  User,
  Phone,
} from 'lucide-react';
import type { DutyStaffMember } from '@/hooks/useYangjaeFestival';
import type { DutiesTabProps } from './types';
import { DUTY_CATEGORIES } from './types';
import {
  formatAutoHyphen,
  maskPersonName,
} from './festivalUtils';

export const DutiesTab: React.FC<DutiesTabProps> = React.memo(({
  duties,
  editingDuties,
  editDutiesData,
  dutySearchQuery,
  selectedDutyCategory,
  isDutyPillsWrapped,
  showPrivateMobile,
  isLocalAdmin,
  isLargeFont,
  isSyncingExcel,
  isPendingSave,
  dutyPillsRef,
  onDutySearchChange,
  onSelectDutyCategory,
  onTogglePillsWrap,
  onScrollPillsLeft,
  onScrollPillsRight,
  onPillsWheel,
  onSwitchToggle,
  onSyncDesktopExcel,
  onExportCsv,
  onStartEditDuties,
  onCancelEditDuties,
  onSaveDuties,
  onAddDutyRow,
  onDeleteDutyRow,
  onMoveDutyUp,
  onMoveDutyDown,
  onUpdateDutyField,
  onAddDutyStaff,
  onDeleteDutyStaff,
  onUpdateDutyStaff,
}) => {
  const activeDuties = editingDuties ? editDutiesData : duties;

  const filteredDuties = useMemo(() => {
    let list = activeDuties;
    if (selectedDutyCategory !== '전체') {
      list = list.filter((d) => d.category === selectedDutyCategory);
    }
    if (dutySearchQuery.trim()) {
      const q = dutySearchQuery.trim().toLowerCase();
      list = list.filter((d) => {
        const matchesBasic =
          (d.deptOrOrg && d.deptOrOrg.toLowerCase().includes(q)) ||
          (d.category && d.category.toLowerCase().includes(q)) ||
          (d.role && d.role.toLowerCase().includes(q)) ||
          (d.manager && d.manager.toLowerCase().includes(q)) ||
          (d.adminPhone && d.adminPhone.includes(q)) ||
          (d.mobilePhone && d.mobilePhone.includes(q)) ||
          (d.phone && d.phone.includes(q)) ||
          (Array.isArray(d.tasks)
            ? d.tasks.some((t) => t.toLowerCase().includes(q))
            : String(d.tasks || '').toLowerCase().includes(q));

        const matchesStaff =
          d.staffMembers &&
          d.staffMembers.some(
            (s) =>
              (s.name && s.name.toLowerCase().includes(q)) ||
              (s.role && s.role.toLowerCase().includes(q)) ||
              (s.adminPhone && s.adminPhone.includes(q)) ||
              (s.mobilePhone && s.mobilePhone.includes(q))
          );

        return matchesBasic || matchesStaff;
      });
    }
    return list;
  }, [activeDuties, selectedDutyCategory, dutySearchQuery]);

  return (
    <>
      {/* Header Stats Bar */}
      <div className="bg-white border border-slate-200/80 rounded-xl p-3 sm:p-4 shadow-2xs space-y-2.5">
        {/* Header Bar: Clean 1-Row Layout */}
        <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2.5 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className={`${isLargeFont ? 'text-base font-black' : 'text-sm font-extrabold'} text-slate-900 tracking-tight whitespace-nowrap flex items-center gap-1.5`}>
              <FileSpreadsheet className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>업무분장 및 비상연락망</span>
            </h3>
            <span className="text-[11px] font-mono tabular-nums font-bold px-2 py-0.5 rounded-full bg-slate-100/90 text-slate-700 border border-slate-200/80">
              총 {editingDuties ? editDutiesData.length : activeDuties.length}개 항목
            </span>
            {editingDuties && (
              <span className="text-[10.5px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200/90 flex items-center gap-1 animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                엑셀 편집 중
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap justify-end">
            {/* Emergency Contact Switch Toggle */}
            <button
              type="button"
              onClick={onSwitchToggle}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-slate-200/80 bg-slate-100/80 hover:bg-slate-200/70 transition-colors duration-150 cursor-pointer shadow-3xs select-none shrink-0"
              title={showPrivateMobile ? "비상연락망 켜짐 (클릭 시 끄기)" : "비상연락망 꺼짐 (클릭 시 비밀번호 인증 후 켜기)"}
            >
              <span className="text-[11px] font-extrabold text-slate-700 flex items-center gap-1 whitespace-nowrap">
                <Smartphone className="w-3.5 h-3.5 text-slate-600" />
                <span className="hidden xs:inline">비상연락망</span>
              </span>
              {/* Toggle Track */}
              <span className={`w-8 h-4.5 rounded-full p-0.5 transition-colors duration-200 ease-in-out inline-flex items-center ${showPrivateMobile ? 'bg-emerald-500' : 'bg-slate-300'}`}>
                {/* Toggle Knob */}
                <span className={`w-3.5 h-3.5 rounded-full bg-white shadow-xs transform transition-transform duration-200 ease-in-out ${showPrivateMobile ? 'translate-x-3.5' : 'translate-x-0'}`} />
              </span>
              <span className={`text-[10px] font-black px-1.5 py-0.2 rounded border whitespace-nowrap ${showPrivateMobile ? 'bg-emerald-50 text-emerald-800 border-emerald-200/80' : 'bg-slate-200/80 text-slate-600 border-slate-300/80'}`}>
                {showPrivateMobile ? 'ON' : 'OFF'}
              </span>
            </button>

            {/* Desktop Excel Sync Button */}
            <button
              type="button"
              onClick={onSyncDesktopExcel}
              disabled={isSyncingExcel}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-emerald-200/90 bg-emerald-50/80 hover:bg-emerald-100/80 text-emerald-900 text-xs font-black transition-colors duration-150 shadow-3xs cursor-pointer active:scale-95 disabled:opacity-50 shrink-0"
              title="바탕화면 단일 마스터 엑셀(SSOT) 덮어쓰기 동기화"
            >
              {isSyncingExcel ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-700" />
              ) : (
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
              )}
              <span>엑셀 동기화</span>
            </button>

            {/* CSV Export Button */}
            <button
              type="button"
              onClick={onExportCsv}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200/80 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-colors duration-150 shadow-3xs cursor-pointer active:scale-95 shrink-0"
              title="업무분장 엑셀(CSV) 다운로드"
            >
              <Download className="w-3.5 h-3.5 text-slate-600" />
              <span className="hidden sm:inline">CSV</span>
            </button>

            {/* Edit Mode Buttons */}
            {editingDuties ? (
              <>
                <button
                  type="button"
                  onClick={onAddDutyRow}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-emerald-200/90 bg-emerald-50 hover:bg-emerald-100/80 text-emerald-800 text-xs font-bold transition-colors duration-150 shadow-3xs cursor-pointer active:scale-95 shrink-0"
                  title="새 업무분장 행 추가"
                >
                  <Plus className="w-3.5 h-3.5 text-emerald-700" />
                  <span>행 추가</span>
                </button>

                <button
                  type="button"
                  onClick={onSaveDuties}
                  disabled={isPendingSave}
                  className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors duration-150 shadow-2xs cursor-pointer active:scale-95 disabled:opacity-50 shrink-0"
                  title="업무분장 저장"
                >
                  {isPendingSave ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Save className="w-3.5 h-3.5" />
                  )}
                  <span>저장</span>
                </button>

                <button
                  type="button"
                  onClick={onCancelEditDuties}
                  disabled={isPendingSave}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200/80 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-colors duration-150 shadow-3xs cursor-pointer active:scale-95 shrink-0"
                  title="편집 취소"
                >
                  <X className="w-3.5 h-3.5 text-slate-500" />
                  <span>취소</span>
                </button>
              </>
            ) : (
              isLocalAdmin && (
                <>
                  <button
                    type="button"
                    onClick={onAddDutyRow}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200/80 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-colors duration-150 shadow-3xs cursor-pointer active:scale-95 shrink-0"
                    title="새 업무분장 행 추가 및 편집"
                  >
                    <Plus className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="hidden sm:inline">행 추가</span>
                  </button>

                  <button
                    type="button"
                    onClick={onStartEditDuties}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-colors duration-150 shadow-2xs cursor-pointer active:scale-95 shrink-0"
                    title="스프레드시트 엑셀 편집 모드 시작"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>엑셀 편집</span>
                  </button>
                </>
              )
            )}
          </div>
        </div>

        {/* Search Bar (View Mode) vs Excel Mode Banner (Edit Mode) */}
        {editingDuties ? (
          <div className="bg-emerald-50/70 border border-emerald-200/90 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-2xs">
            <div className="flex items-start gap-2">
              <FileSpreadsheet className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
              <div className="text-xs text-emerald-950 font-medium leading-relaxed">
                <span className="font-extrabold text-emerald-900">📊 엑셀 편집 모드: </span>
                스프레드시트처럼 각 셀을 클릭하여 구분, 부서, 역할, 담당자, 연락처, 세부과업을 직접 입력·수정할 수 있습니다.
                <span className="text-emerald-800 font-bold ml-1">(과업 입력란에서 엔터 줄바꿈 시 개조식 목록으로 자동 분할 저장됩니다.)</span>
              </div>
            </div>
            <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
              <span className="text-[11px] font-bold text-emerald-800 bg-white/90 px-2 py-0.5 rounded border border-emerald-200/80">
                전화번호 자동 하이픈 연동
              </span>
            </div>
          </div>
        ) : (
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={dutySearchQuery}
              onChange={(e) => onDutySearchChange(e.target.value)}
              placeholder="부서명, 담당자, 전화번호, 과업 내용 검색 (예: 오창선, 체육회, 구급차, 제이민...)"
              className="w-full pl-9 pr-8 py-1.5 text-xs font-medium border border-slate-200/80 rounded-lg bg-slate-50/80 focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-900/15 focus:border-slate-300 text-slate-900 transition-colors"
            />
            {dutySearchQuery && (
              <button
                type="button"
                onClick={() => onDutySearchChange('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}

        {/* 6대 업무 구획 퀵 필터 탭 바 */}
        {!editingDuties && (
          <div className="space-y-1.5 pt-0.5">
            <div className="flex items-center justify-between gap-1 text-[11px] font-bold text-slate-500 px-0.5">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-slate-700 font-extrabold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  <span>업무 구획 필터</span>
                </span>
                <span className="text-[10.5px] text-slate-400 font-medium truncate">
                  ({selectedDutyCategory})
                </span>
              </div>

              <button
                type="button"
                onClick={onTogglePillsWrap}
                className="inline-flex items-center gap-1 text-[10.5px] font-bold text-slate-700 bg-slate-100/80 hover:bg-slate-200/80 border border-slate-200/80 px-2 py-0.5 rounded-md cursor-pointer transition-colors duration-150 active:scale-95 shadow-3xs shrink-0"
                title={isDutyPillsWrapped ? '1줄 가로 스크롤 모드로 변경' : '2줄 전체 펼침 모드로 변경 (스크롤 불필요)'}
              >
                {isDutyPillsWrapped ? (
                  <>
                    <ArrowRightLeft className="w-3 h-3 text-slate-500" />
                    <span>1줄 스크롤</span>
                  </>
                ) : (
                  <>
                    <Layers className="w-3 h-3 text-emerald-600" />
                    <span className="text-emerald-700 font-black">2줄 전체펼침 (추천)</span>
                  </>
                )}
              </button>
            </div>

            <div className="relative flex items-center">
              {!isDutyPillsWrapped && (
                <button
                  type="button"
                  onClick={onScrollPillsLeft}
                  className="absolute -left-1.5 z-10 p-1 rounded-full bg-white/95 border border-slate-200/90 shadow-sm text-slate-700 hover:bg-slate-100 hover:text-slate-900 cursor-pointer active:scale-90 transition-colors duration-150 shrink-0"
                  title="왼쪽으로 스크롤"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
              )}

              <div
                ref={dutyPillsRef}
                onWheel={onPillsWheel}
                className={`flex items-center gap-1.5 text-xs font-bold transition-colors duration-150 ${
                  isDutyPillsWrapped
                    ? 'flex-wrap py-0.5'
                    : 'overflow-x-auto scroll-smooth py-1 px-4 no-scrollbar touch-pan-x w-full'
                }`}
              >
                {DUTY_CATEGORIES.map((cat, cIdx) => {
                  const isSelected = selectedDutyCategory === cat;
                  const count = cat === '전체'
                    ? activeDuties.length
                    : activeDuties.filter((d) => d.category === cat).length;
                  return (
                    <button
                      key={`duty-cat-${cat}`}
                      type="button"
                      onClick={() => onSelectDutyCategory(cat)}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-extrabold whitespace-nowrap transition-colors duration-150 cursor-pointer shadow-3xs active:scale-95 ${
                        isSelected
                          ? 'bg-slate-900 text-white shadow-2xs'
                          : 'bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 border border-slate-200/80'
                      }`}
                    >
                      {cat !== '전체' && <span className="opacity-60 text-[10px] font-mono">{cIdx}.</span>}
                      <span>{cat}</span>
                      <span className={`text-[10px] font-mono tabular-nums px-1.5 py-0.2 rounded-full ${
                        isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>

              {!isDutyPillsWrapped && (
                <button
                  type="button"
                  onClick={onScrollPillsRight}
                  className="absolute -right-1.5 z-10 p-1 rounded-full bg-white/95 border border-slate-200/90 shadow-sm text-slate-700 hover:bg-slate-100 hover:text-slate-900 cursor-pointer active:scale-90 transition-colors duration-150 shrink-0"
                  title="오른쪽으로 스크롤"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      <datalist id="yangjae-duty-category-options">
        <option value="운영" />
        <option value="코스" />
        <option value="부스" />
        <option value="VIP의전" />
        <option value="직원식사" />
        <option value="쓰레기처리" />
      </datalist>

      {/* Main Duties Area */}
      {editingDuties ? (
        /* EXCEL SPREADSHEET EDITING MODE */
        <div className="space-y-3">
          {editDutiesData.map((duty, idx) => {
            const isFirst = idx === 0;
            const isLast = idx === editDutiesData.length - 1;
            const rawTasksText = Array.isArray(duty.tasks)
              ? duty.tasks.join('\n')
              : (duty.tasks || '');

            return (
              <div
                key={`edit-duty-card-${duty.id}`}
                className="bg-white border border-emerald-300/90 rounded-xl p-3 sm:p-3.5 space-y-2.5 shadow-2xs"
              >
                <div className="flex items-center justify-between gap-2 pb-2 border-b border-emerald-100">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="font-mono tabular-nums font-black text-xs text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/90 shrink-0">
                      #{idx + 1}
                    </span>
                    <div className="flex-1 max-w-[130px]">
                      <input
                        list="yangjae-duty-category-options"
                        type="text"
                        value={duty.category || ''}
                        onChange={(e) => onUpdateDutyField(duty.id, 'category', e.target.value)}
                        placeholder="구분"
                        className="w-full text-xs font-bold px-2 py-1 border border-slate-200/80 rounded-md bg-white focus:bg-emerald-50/20 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => onMoveDutyUp(duty.id)}
                      disabled={isFirst}
                      className="p-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 disabled:opacity-30 disabled:hover:bg-slate-100 cursor-pointer transition-colors duration-150 active:scale-95"
                      title="위로 이동"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onMoveDutyDown(duty.id)}
                      disabled={isLast}
                      className="p-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 disabled:opacity-30 disabled:hover:bg-slate-100 cursor-pointer transition-colors duration-150 active:scale-95"
                      title="아래로 이동"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteDutyRow(duty.id)}
                      className="p-1 rounded-md bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 cursor-pointer transition-colors duration-150 active:scale-95 ml-0.5"
                      title="행 삭제"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-0.5">부서·기관명</label>
                    <input
                      type="text"
                      value={duty.deptOrOrg || ''}
                      onChange={(e) => onUpdateDutyField(duty.id, 'deptOrOrg', e.target.value)}
                      placeholder="예: 보건행정과"
                      className="w-full text-xs font-semibold px-2 py-1.5 border border-slate-200/80 rounded-md bg-white focus:bg-emerald-50/20 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-0.5">담당 역할</label>
                    <input
                      type="text"
                      value={duty.role || ''}
                      onChange={(e) => onUpdateDutyField(duty.id, 'role', e.target.value)}
                      placeholder="예: 총괄 기획 및 예산"
                      className="w-full text-xs font-medium px-2 py-1.5 border border-slate-200/80 rounded-md bg-white focus:bg-emerald-50/20 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                {(() => {
                  const staffList: DutyStaffMember[] = (duty.staffMembers && duty.staffMembers.length > 0)
                    ? duty.staffMembers
                    : [{
                        name: duty.manager || '',
                        adminPhone: duty.adminPhone || '',
                        mobilePhone: duty.mobilePhone || '',
                        role: '',
                      }];

                  return (
                    <div className="bg-slate-50/70 border border-slate-200/80 rounded-lg p-2.5 space-y-2">
                      <div className="flex items-center justify-between pb-1.5 border-b border-slate-200/80">
                        <span className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5 text-emerald-600" />
                          <span>배정 인력 구성</span>
                          <span className="text-[10px] font-mono tabular-nums px-1.5 py-0.2 rounded-full bg-emerald-50 text-emerald-800 font-extrabold border border-emerald-200/80">
                            {staffList.length}명
                          </span>
                        </span>
                        <button
                          type="button"
                          onClick={() => onAddDutyStaff(duty.id)}
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-white hover:bg-emerald-50 border border-emerald-200/90 px-2 py-0.5 rounded-md shadow-3xs cursor-pointer active:scale-95 transition-colors duration-150"
                          title="이 업무에 담당자 추가"
                        >
                          <Plus className="w-3 h-3 text-emerald-600" />
                          <span>+ 담당자 추가</span>
                        </button>
                      </div>

                      <div className="space-y-2">
                        {staffList.map((stf, sIdx) => {
                          const isOnlyOne = staffList.length <= 1;
                          return (
                            <div
                              key={`duty-${duty.id}-staff-${sIdx}`}
                              className="bg-white border border-slate-200/80 rounded-md p-2 shadow-3xs space-y-1.5"
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-[10.5px] font-black text-slate-700 flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                  <span>{sIdx === 0 ? '대표 담당자' : `담당자 #${sIdx + 1}`}</span>
                                </span>
                                {!isOnlyOne && (
                                  <button
                                    type="button"
                                    onClick={() => onDeleteDutyStaff(duty.id, sIdx)}
                                    className="text-red-500 hover:text-red-700 p-0.5 rounded hover:bg-red-50 cursor-pointer transition-colors duration-150"
                                    title="이 담당자 삭제"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                                <div>
                                  <label className="block text-[10px] font-bold text-slate-600 mb-0.5">성명 / 직책</label>
                                  <input
                                    type="text"
                                    value={stf.name || ''}
                                    onChange={(e) => onUpdateDutyStaff(duty.id, sIdx, 'name', e.target.value)}
                                    placeholder="예: 오창선"
                                    className="w-full text-xs font-semibold px-2 py-1.5 border border-slate-200/80 rounded-md bg-white focus:bg-emerald-50/20 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                  />
                                </div>
                                <div>
                                  <label className="block text-[10px] font-bold text-slate-600 mb-0.5">세부 역할(선택)</label>
                                  <input
                                    type="text"
                                    value={stf.role || ''}
                                    onChange={(e) => onUpdateDutyStaff(duty.id, sIdx, 'role', e.target.value)}
                                    placeholder="예: 총괄, 주무관"
                                    className="w-full text-xs font-medium px-2 py-1.5 border border-slate-200/80 rounded-md bg-white focus:bg-emerald-50/20 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                  />
                                </div>
                                <div>
                                  <label className="block text-[10px] font-bold text-slate-600 mb-0.5">행정전화(유선)</label>
                                  <input
                                    type="text"
                                    value={stf.adminPhone || ''}
                                    onChange={(e) => onUpdateDutyStaff(duty.id, sIdx, 'adminPhone', e.target.value)}
                                    placeholder="02-3423-7116"
                                    className="w-full text-xs font-mono tabular-nums px-2 py-1.5 border border-slate-200/80 rounded-md bg-white focus:bg-emerald-50/20 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                  />
                                </div>
                                <div>
                                  <label className="block text-[10px] font-bold text-slate-600 mb-0.5">휴대전화(비상망)</label>
                                  <input
                                    type="text"
                                    value={stf.mobilePhone || ''}
                                    onChange={(e) => onUpdateDutyStaff(duty.id, sIdx, 'mobilePhone', e.target.value)}
                                    placeholder="010-XXXX-XXXX"
                                    className="w-full text-xs font-mono tabular-nums px-2 py-1.5 border border-slate-200/80 rounded-md bg-white focus:bg-emerald-50/20 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                  />
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-0.5">배정 과업 (줄바꿈 시 개조식 목록으로 자동 분할)</label>
                  <textarea
                    rows={Math.min(5, Math.max(2, (rawTasksText.split('\n').length || 1)))}
                    value={rawTasksText}
                    onChange={(e) => onUpdateDutyField(duty.id, 'tasks', e.target.value)}
                    placeholder="과업 내용을 입력하세요 (줄바꿈 시 각 줄이 개조식 목록으로 저장됩니다)"
                    className="w-full text-xs leading-relaxed px-2 py-1.5 border border-slate-200/80 rounded-md bg-white focus:bg-emerald-50/20 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 resize-y"
                  />
                </div>
              </div>
            );
          })}

          <div className="bg-slate-50/70 border border-slate-200/80 rounded-xl p-2.5 flex items-center justify-between gap-2 flex-wrap">
            <button
              type="button"
              onClick={onAddDutyRow}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed border-emerald-300 hover:border-emerald-400 bg-emerald-50/50 hover:bg-emerald-100/60 text-emerald-800 text-xs font-bold transition-colors duration-150 shadow-3xs cursor-pointer active:scale-98"
            >
              <Plus className="w-4 h-4 text-emerald-600" />
              <span>+ 새 업무분장 행 추가</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onCancelEditDuties}
                disabled={isPendingSave}
                className="px-3 py-1.5 text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200/80 rounded-lg shadow-3xs cursor-pointer transition-colors duration-150 active:scale-95"
              >
                취소
              </button>
              <button
                type="button"
                onClick={onSaveDuties}
                disabled={isPendingSave}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-2xs cursor-pointer transition-colors duration-150 active:scale-95 disabled:opacity-50"
              >
                {isPendingSave ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Save className="w-3.5 h-3.5" />
                )}
                <span>업무분장 전체 저장</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* VIEW MODE */
        <div className="space-y-2.5">
          {filteredDuties.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500 font-medium bg-white border border-slate-200/80 rounded-xl shadow-2xs">
              검색 조건과 일치하는 업무분장 항목이 없습니다.
            </div>
          ) : (
            filteredDuties.map((duty) => {
              const isOps = duty.category === '운영';
              const isCourse = duty.category === '코스';
              const isBooth = duty.category === '부스';
              const isVIP = duty.category === 'VIP의전';
              const isMeal = duty.category === '직원식사';
              const isWaste = duty.category === '쓰레기처리';

              const adminNo = formatAutoHyphen((duty.adminPhone || (!duty.phone?.startsWith('010') ? duty.phone : '') || '').trim());
              const mobileNo = formatAutoHyphen((duty.mobilePhone || (duty.phone?.startsWith('010') ? duty.phone : '') || '').trim());

              return (
                <div
                  key={`duty-card-${duty.id}`}
                  className="bg-white border border-slate-200/80 rounded-xl p-3.5 space-y-2.5 shadow-2xs transition-colors duration-150 hover:border-slate-300"
                >
                  <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                      <span className={`text-[11px] font-black px-2 py-0.5 rounded-md border shrink-0 ${
                        isOps
                          ? 'bg-blue-50 text-blue-900 border-blue-200/80'
                          : isCourse
                          ? 'bg-indigo-50 text-indigo-900 border-indigo-200/80'
                          : isBooth
                          ? 'bg-emerald-50 text-emerald-900 border-emerald-200/80'
                          : isVIP
                          ? 'bg-purple-50 text-purple-900 border-purple-200/80'
                          : isMeal
                          ? 'bg-amber-50 text-amber-900 border-amber-200/80'
                          : isWaste
                          ? 'bg-rose-50 text-rose-900 border-rose-200/80'
                          : 'bg-slate-100 text-slate-800 border-slate-200/80'
                      }`}>
                        {duty.category}
                      </span>
                      <div className="font-extrabold text-sm text-slate-900 leading-snug">
                        {duty.deptOrOrg || <span className="text-slate-400 italic font-normal text-xs">(부서·기관 미지정)</span>}
                      </div>
                    </div>

                    {isLocalAdmin && (
                      <button
                        type="button"
                        onClick={onStartEditDuties}
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200/80 px-2 py-1 rounded-md shadow-3xs cursor-pointer active:scale-95 shrink-0"
                        title="스프레드시트 엑셀 편집 모드로 열기"
                      >
                        <Edit3 className="w-3 h-3 text-slate-500" />
                        <span>수정</span>
                      </button>
                    )}
                  </div>

                  <div className="flex items-start gap-1.5">
                    <span className="text-xs font-bold text-slate-500 shrink-0">역할:</span>
                    <div className={`${isLargeFont ? 'text-sm' : 'text-xs'} font-bold text-slate-900 leading-snug break-keep`}>
                      {duty.role || <span className="text-slate-400 italic font-normal text-xs">(담당 역할 설정 대기)</span>}
                    </div>
                  </div>

                  {(() => {
                    const hasStaffList = Boolean(duty.staffMembers && duty.staffMembers.length > 0);

                    if (hasStaffList) {
                      return (
                        <div className="space-y-1.5 pt-0.5 pb-0.5">
                          {duty.staffMembers!.map((stf, sIdx) => {
                            const stfAdmin = formatAutoHyphen((stf.adminPhone || '').trim());
                            const stfMobile = formatAutoHyphen((stf.mobilePhone || '').trim());
                            const hasStfName = Boolean(stf.name);
                            const hasStfAdmin = Boolean(stfAdmin);
                            const hasStfMobile = Boolean(showPrivateMobile && stfMobile);

                            if (!hasStfName && !hasStfAdmin && !hasStfMobile) return null;

                            return (
                              <div key={`duty-stf-${duty.id}-${sIdx}`} className="flex items-center gap-1.5 flex-wrap">
                                {hasStfName && (
                                  <div className="inline-flex items-center gap-1 text-xs font-bold text-slate-800 bg-slate-100/90 px-2 py-0.5 rounded-md border border-slate-200/80 shrink-0">
                                    <User className="w-3 h-3 text-slate-500 shrink-0" />
                                    <span>{showPrivateMobile ? stf.name : maskPersonName(stf.name)}</span>
                                    {stf.role && (
                                      <span className="text-[10px] text-slate-500 font-semibold ml-0.5">({stf.role})</span>
                                    )}
                                  </div>
                                )}
                                {hasStfAdmin && (
                                  <a
                                    href={`tel:${stfAdmin.replace(/[^0-9]/g, '')}`}
                                    className="inline-flex items-center gap-1 text-xs font-bold text-blue-900 bg-blue-50/80 hover:bg-blue-100/80 px-2 py-0.5 rounded-md border border-blue-200/80 shadow-3xs transition-colors duration-150 active:scale-95 cursor-pointer shrink-0"
                                    title={`행정전화 걸기: ${stfAdmin}`}
                                  >
                                    <Phone className="w-3 h-3 text-blue-700 shrink-0" />
                                    <span className="text-[10.5px] font-extrabold text-blue-800">행정:</span>
                                    <span className="font-mono tabular-nums">{stfAdmin}</span>
                                  </a>
                                )}
                                {hasStfMobile && (
                                  <a
                                    href={`tel:${stfMobile.replace(/[^0-9]/g, '')}`}
                                    className="inline-flex items-center gap-1 text-xs font-bold text-emerald-900 bg-emerald-50/80 hover:bg-emerald-100/80 px-2 py-0.5 rounded-md border border-emerald-200/80 shadow-3xs transition-colors duration-150 active:scale-95 cursor-pointer shrink-0"
                                    title={`휴대전화 걸기: ${stfMobile}`}
                                  >
                                    <Smartphone className="w-3 h-3 text-emerald-700 shrink-0" />
                                    <span className="text-[10.5px] font-extrabold text-emerald-800">폰:</span>
                                    <span className="font-mono tabular-nums">{stfMobile}</span>
                                  </a>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      );
                    }

                    const hasManager = Boolean(duty.manager);
                    const hasAdmin = Boolean(adminNo);
                    const hasMobile = Boolean(showPrivateMobile && mobileNo);

                    if (!hasManager && !hasAdmin && !hasMobile) return null;

                    return (
                      <div className="flex items-center gap-1.5 flex-wrap pt-0.5 pb-0.5">
                        {hasManager && (
                          <div className="inline-flex items-center gap-1 text-xs font-bold text-slate-800 bg-slate-100/90 px-2 py-0.5 rounded-md border border-slate-200/80 shrink-0">
                            <User className="w-3 h-3 text-slate-500 shrink-0" />
                            <span>{showPrivateMobile ? duty.manager : maskPersonName(duty.manager)}</span>
                          </div>
                        )}
                        {hasAdmin && (
                          <a
                            href={`tel:${adminNo.replace(/[^0-9]/g, '')}`}
                            className="inline-flex items-center gap-1 text-xs font-bold text-blue-900 bg-blue-50/80 hover:bg-blue-100/80 px-2 py-0.5 rounded-md border border-blue-200/80 shadow-3xs transition-colors duration-150 active:scale-95 cursor-pointer shrink-0"
                            title={`행정전화 걸기: ${adminNo}`}
                          >
                            <Phone className="w-3 h-3 text-blue-700 shrink-0" />
                            <span className="text-[10.5px] font-extrabold text-blue-800">행정:</span>
                            <span className="font-mono tabular-nums">{adminNo}</span>
                          </a>
                        )}
                        {hasMobile && (
                          <a
                            href={`tel:${mobileNo.replace(/[^0-9]/g, '')}`}
                            className="inline-flex items-center gap-1 text-xs font-bold text-emerald-900 bg-emerald-50/80 hover:bg-emerald-100/80 px-2 py-0.5 rounded-md border border-emerald-200/80 shadow-3xs transition-colors duration-150 active:scale-95 cursor-pointer shrink-0"
                            title={`휴대전화 걸기: ${mobileNo}`}
                          >
                            <Smartphone className="w-3 h-3 text-emerald-700 shrink-0" />
                            <span className="text-[10.5px] font-extrabold text-emerald-800">폰:</span>
                            <span className="font-mono tabular-nums">{mobileNo}</span>
                          </a>
                        )}
                      </div>
                    );
                  })()}

                  <div className="bg-slate-50/70 rounded-lg p-2.5 border border-slate-200/80">
                    <div className="text-[11px] font-bold text-slate-500 mb-1 flex items-center gap-1">
                      <span>배정 과업:</span>
                    </div>
                    {duty.tasks && duty.tasks.length > 0 ? (
                      <ul className="space-y-1">
                        {duty.tasks.map((task, tIdx) => (
                          <li
                            key={`duty-${duty.id}-task-${tIdx}`}
                            className={`${isLargeFont ? 'text-sm' : 'text-xs'} text-slate-800 font-medium flex items-start gap-1.5 leading-snug break-keep`}
                          >
                            <span className="text-slate-400 font-bold select-none shrink-0">•</span>
                            <span>{task}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <span className="text-slate-400 italic font-normal text-xs">(과업 세부 내역 작성 대기)</span>
                    )}
                  </div>
                </div>
              );
            })
          )}

          {isLocalAdmin && (
            <div className="bg-slate-50/70 border border-slate-200/80 rounded-xl p-2.5 flex items-center justify-between gap-2 flex-wrap">
              <button
                type="button"
                onClick={onAddDutyRow}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed border-slate-300 hover:border-slate-400 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-colors duration-150 shadow-3xs cursor-pointer active:scale-98"
              >
                <Plus className="w-4 h-4 text-emerald-600" />
                <span>+ 새 업무분장 행 추가</span>
              </button>

              <button
                type="button"
                onClick={onStartEditDuties}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-colors duration-150 shadow-2xs cursor-pointer active:scale-95"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>스프레드시트 엑셀 편집</span>
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
});

DutiesTab.displayName = 'DutiesTab';
