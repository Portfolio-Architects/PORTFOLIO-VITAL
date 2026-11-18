import React, { useMemo } from 'react';
import {
  Plus,
  Save,
  X,
  Search,
  Clock,
  User,
  Edit3,
  Trash2,
  Shield,
  MapPin,
  Loader2,
} from 'lucide-react';
import type { ScheduleTabProps } from './types';

export const ScheduleTab: React.FC<ScheduleTabProps> = React.memo(({
  schedule,
  editingScheduleId,
  editScheduleData,
  scheduleSearchQuery,
  isLocalAdmin,
  isLargeFont,
  isPendingSave,
  onSearchChange,
  onStartEditSchedule,
  onCancelEditSchedule,
  onSaveSchedule,
  onAddSchedule,
  onDeleteSchedule,
  onUpdateScheduleField,
}) => {
  const filteredSchedule = useMemo(() => {
    if (!scheduleSearchQuery.trim()) return schedule;
    const q = scheduleSearchQuery.trim().toLowerCase();
    return schedule.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        (item.note && item.note.toLowerCase().includes(q)) ||
        (item.lead && item.lead.toLowerCase().includes(q)) ||
        item.time.toLowerCase().includes(q)
    );
  }, [schedule, scheduleSearchQuery]);

  return (
    <>
      {/* Header Bar */}
      <div className="bg-white border border-slate-200/80 rounded-xl p-3 shadow-2xs space-y-2.5">
        {/* Row 1: Title, Count Badge & Add Schedule Button */}
        <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
          <div className="flex items-center gap-2 min-w-0">
            <h3 className={`${isLargeFont ? 'text-base font-black' : 'text-sm font-extrabold'} text-slate-900 tracking-tight whitespace-nowrap`}>
              <span>행사 식순</span>
            </h3>
            <span className="text-[11px] font-mono tabular-nums font-bold px-2 py-0.5 rounded-full bg-slate-100/90 text-slate-700 border border-slate-200/80 whitespace-nowrap">
              {schedule.length}개 식순 · 10.17.(토)~10.31.(토)
            </span>
          </div>

          {isLocalAdmin && (
            <button
              type="button"
              onClick={onAddSchedule}
              disabled={isPendingSave}
              className="px-2.5 py-1 text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white rounded-lg flex items-center gap-1 cursor-pointer transition-colors duration-150 shadow-2xs active:scale-95 shrink-0 whitespace-nowrap"
              title="새 행사 식순 추가"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>식순 추가</span>
            </button>
          )}
        </div>

        {/* Row 2: Full-Width Search Bar */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={scheduleSearchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="식순명, 담당자, 내용 검색..."
            className="w-full pl-8 pr-7 py-1.5 text-xs font-medium border border-slate-200/80 rounded-lg bg-slate-50/80 focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-900/15 focus:border-slate-300 text-slate-900 transition-colors"
          />
          {scheduleSearchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Schedule Box Cards List */}
      {filteredSchedule.length === 0 ? (
        <div className="p-8 text-center text-xs text-slate-500 font-medium bg-white border border-slate-200/80 rounded-xl shadow-2xs space-y-3">
          <div>검색 조건과 일치하는 행사 식순이 없습니다.</div>
          {isLocalAdmin && (
            <div>
              <button
                type="button"
                onClick={onAddSchedule}
                disabled={isPendingSave}
                className="px-3 py-1.5 text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white rounded-lg inline-flex items-center gap-1 cursor-pointer transition-colors duration-150 shadow-2xs active:scale-95"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>새 행사 식순 추가</span>
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredSchedule.map((item) => {
            const isCeremony = item.id === 7 || item.title.includes('국민의례');
            const isWalkingStart = item.id === 14 || item.title.includes('걷기');
            const isEditingThis = editingScheduleId === item.id;

            return (
              <div
                key={`schedule-card-${item.id}`}
                className={`p-3.5 bg-white border rounded-xl transition-colors duration-150 ${
                  isEditingThis
                    ? 'border-blue-400 ring-1 ring-blue-200 bg-blue-50/10 shadow-sm'
                    : isCeremony
                    ? 'border-blue-200/90 bg-blue-50/15 shadow-2xs'
                    : isWalkingStart
                    ? 'border-emerald-200/90 bg-emerald-50/15 shadow-2xs'
                    : 'border-slate-200/80 hover:border-slate-300 shadow-2xs'
                }`}
              >
                {/* Card Header: 순번, 구분, 시간 / 관리 버튼 */}
                <div className="flex items-center justify-between pb-1.5 mb-2 border-b border-slate-100">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className={`${isLargeFont ? 'text-xs' : 'text-[11px]'} font-mono tabular-nums font-black text-slate-700`}>
                      No.{item.id}
                    </span>

                    {isEditingThis ? (
                      <>
                        <select
                          value={editScheduleData?.date || '10.31.(토)'}
                          onChange={(e) => onUpdateScheduleField('date', e.target.value)}
                          className="px-1.5 py-0.5 text-xs font-bold border border-blue-400 rounded-md bg-white text-slate-800 cursor-pointer"
                        >
                          <option value="10.17.(토)">10.17.(토)</option>
                          <option value="10.23.(금)">10.23.(금)</option>
                          <option value="10.24.(토)">10.24.(토)</option>
                          <option value="10.30.(금)">10.30.(금) 전일</option>
                          <option value="10.31.(토)">10.31.(토) 당일</option>
                        </select>
                        <select
                          value={editScheduleData?.phase || '식전'}
                          onChange={(e) => onUpdateScheduleField('phase', e.target.value)}
                          className="px-1.5 py-0.5 text-xs font-bold border border-blue-400 rounded-md bg-white text-slate-800 cursor-pointer"
                        >
                          <option value="사전준비">사전준비</option>
                          <option value="행사전날">행사전날</option>
                          <option value="식전">식전</option>
                          <option value="공연">공연</option>
                          <option value="부스운영">부스운영</option>
                          <option value="개회식">개회식</option>
                          <option value="공식행사">공식행사</option>
                          <option value="걷기대회">걷기대회</option>
                          <option value="마감">마감</option>
                        </select>
                      </>
                    ) : (
                      <>
                        {item.date && (
                          <span className={`${isLargeFont ? 'text-xs' : 'text-[10px]'} font-mono tabular-nums font-extrabold px-1.5 py-0.5 rounded-md border whitespace-nowrap ${
                            item.date.includes('31')
                              ? 'bg-sky-50 text-sky-900 border-sky-200/90'
                              : item.date.includes('30')
                              ? 'bg-amber-50 text-amber-900 border-amber-200/90'
                              : 'bg-indigo-50 text-indigo-900 border-indigo-200/90'
                          }`}>
                            {item.date}
                          </span>
                        )}
                        <span className={`${isLargeFont ? 'text-xs' : 'text-[11px]'} font-bold px-2 py-0.5 rounded-md border ${
                          item.phase === '공식행사' || item.phase === '개회식'
                            ? 'bg-blue-50 text-blue-800 border-blue-200/80'
                            : item.phase === '걷기대회'
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200/80'
                            : item.phase === '식전·준비' || item.phase === '식전' || item.phase === '행사전날'
                            ? 'bg-slate-100/80 text-slate-700 border-slate-200/80'
                            : 'bg-purple-50 text-purple-800 border-purple-200/80'
                        }`}>
                          {item.phase}
                        </span>
                      </>
                    )}

                    {!isEditingThis && (
                      <span className="inline-flex items-center gap-1 font-mono tabular-nums text-[11px] text-slate-700 font-bold bg-slate-100/80 px-2 py-0.5 rounded-md border border-slate-200/80">
                        <Clock className="w-3 h-3 text-slate-500 shrink-0" />
                        <span>{item.time}</span>
                        {item.duration && (
                          <span className="text-blue-700 font-extrabold">({item.duration})</span>
                        )}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {isEditingThis ? (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={onSaveSchedule}
                          disabled={isPendingSave}
                          className="px-2 py-0.5 text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white rounded-md flex items-center gap-0.5 cursor-pointer shadow-3xs transition-colors duration-150 active:scale-95"
                          title="저장 (Enter)"
                        >
                          {isPendingSave ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                          <span>저장</span>
                        </button>
                        <button
                          type="button"
                          onClick={onCancelEditSchedule}
                          className="px-1.5 py-0.5 text-xs font-bold bg-slate-500 hover:bg-slate-400 text-white rounded-md flex items-center gap-0.5 cursor-pointer shadow-3xs transition-colors duration-150 active:scale-95"
                          title="취소 (Esc)"
                        >
                          <X className="w-3 h-3" />
                          <span>취소</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteSchedule(item.id)}
                          disabled={isPendingSave}
                          className="px-1.5 py-0.5 text-xs font-bold bg-rose-50 hover:bg-rose-100 text-rose-700 hover:text-rose-900 border border-rose-200/90 rounded-md flex items-center gap-0.5 cursor-pointer shadow-3xs transition-colors duration-150 active:scale-95"
                          title="식순 항목 삭제"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>삭제</span>
                        </button>
                      </div>
                    ) : (
                      isLocalAdmin && (
                        <button
                          type="button"
                          onClick={() => onStartEditSchedule(item)}
                          className="px-2 py-0.5 text-xs font-bold bg-slate-50 hover:bg-blue-50 text-slate-600 hover:text-blue-900 border border-slate-200/80 hover:border-blue-300 rounded-md flex items-center gap-1 cursor-pointer transition-colors shadow-3xs"
                          title="식순명 및 세부내용 수정"
                        >
                          <Edit3 className="w-3 h-3 text-blue-600" />
                          <span>수정</span>
                        </button>
                      )
                    )}
                  </div>
                </div>

                {/* Card Body */}
                {isEditingThis ? (
                  <div className="space-y-2">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-0.5">식순명</label>
                      <input
                        type="text"
                        value={editScheduleData?.title || ''}
                        onChange={(e) => onUpdateScheduleField('title', e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') onSaveSchedule();
                          if (e.key === 'Escape') onCancelEditSchedule();
                        }}
                        placeholder="식순명 입력"
                        className="w-full text-sm font-extrabold border border-blue-400 rounded-lg p-1.5 bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-2xs"
                        autoFocus
                      />
                    </div>

                    {/* 시간 / 주관 2-컬럼 그리드 */}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10.5px] font-bold text-slate-600 mb-0.5">시간 (소요)</label>
                        <div className="relative">
                          <Clock className="w-3 h-3 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2" />
                          <input
                            type="text"
                            value={editScheduleData?.time || ''}
                            onChange={(e) => onUpdateScheduleField('time', e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') onSaveSchedule();
                              if (e.key === 'Escape') onCancelEditSchedule();
                            }}
                            placeholder="07:30 ~ 08:00"
                            className="w-full pl-6 pr-2 py-1 text-xs font-mono tabular-nums font-bold border border-blue-300 rounded-md bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-[10.5px] font-bold text-slate-600 mb-0.5">주관 / 담당</label>
                        <div className="relative">
                          <User className="w-3 h-3 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2" />
                          <input
                            type="text"
                            value={editScheduleData?.lead || ''}
                            onChange={(e) => onUpdateScheduleField('lead', e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') onSaveSchedule();
                              if (e.key === 'Escape') onCancelEditSchedule();
                            }}
                            placeholder="주관/담당"
                            className="w-full pl-6 pr-2 py-1 text-xs font-bold border border-blue-300 rounded-md bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-0.5">세부내용</label>
                      <input
                        type="text"
                        value={editScheduleData?.note || ''}
                        onChange={(e) => onUpdateScheduleField('note', e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') onSaveSchedule();
                          if (e.key === 'Escape') onCancelEditSchedule();
                        }}
                        placeholder="세부내용 입력 (예: 참가자 집결, 주요 내용)"
                        className="w-full text-xs font-medium border border-blue-300 rounded-lg p-1.5 bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-2xs"
                      />
                    </div>
                  </div>
                ) : (
                  <div>
                    {/* 식순명 + 특수 뱃지 (의전 약식1, 걷기대회 2km 코스) */}
                    <div className="flex items-center justify-between gap-1.5 mb-1.5 flex-wrap">
                      <span
                        className={`${isLargeFont ? 'text-base font-black' : 'text-sm font-extrabold'} text-slate-900 ${isLocalAdmin ? 'cursor-pointer hover:text-blue-700' : ''}`}
                        onClick={() => isLocalAdmin && onStartEditSchedule(item)}
                        title={isLocalAdmin ? "클릭하여 식순명 및 세부내용 수정" : undefined}
                      >
                        {item.title}
                      </span>

                      {/* 특수 뱃지 그룹 */}
                      <div className="flex items-center gap-1 shrink-0">
                        {isCeremony && (
                          <span
                            className="inline-flex items-center gap-1 text-[9.5px] font-bold text-blue-800 bg-blue-50 border border-blue-200/90 px-1.5 py-0.2 rounded cursor-help whitespace-nowrap"
                            title="대통령훈령 제438호 약식절차 1 준용: ① 국기에 대한 경례(전주 없는 애국가 1절 반주, 맹세문 미낭송) ② 묵념(묵념곡 10~15초) ※ '애국가 제창 등 이하 생략' 발언 규정상 엄격 금지"
                          >
                            <Shield className="w-2.5 h-2.5 text-blue-700 shrink-0" />
                            <span>의전 약식1 준용</span>
                          </span>
                        )}
                        {isWalkingStart && (
                          <span
                            className="inline-flex items-center gap-1 text-[9.5px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200/90 px-1.5 py-0.2 rounded cursor-help whitespace-nowrap"
                            title="수변문화쉼터 ↔ 영동4교 2km 코스 완주 (12:30 인센티브 배부 마감)"
                          >
                            <MapPin className="w-2.5 h-2.5 text-emerald-700 shrink-0" />
                            <span>2km 왕복 (마감 12:30)</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* 주관 / 담당 바 */}
                    {item.lead && (
                      <div className="text-xs text-slate-600 font-medium mb-1.5 flex items-center gap-1">
                        <User className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        <span>주관/담당: <strong className="text-slate-900">{item.lead}</strong></span>
                      </div>
                    )}

                    {/* 세부내용 박스 */}
                    {item.note && (
                      <div
                        className={`text-xs text-slate-700 bg-slate-50/70 p-2.5 rounded-lg border border-slate-200/80 leading-relaxed ${isLocalAdmin ? 'cursor-pointer hover:bg-slate-100/80 hover:border-blue-200' : ''}`}
                        onClick={() => isLocalAdmin && onStartEditSchedule(item)}
                        title={isLocalAdmin ? "클릭하여 세부내용 수정" : undefined}
                      >
                        <span className="font-bold text-slate-600">내용: </span>{item.note}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* Add New Schedule Box at bottom of list */}
          {isLocalAdmin && (
            <button
              type="button"
              onClick={onAddSchedule}
              disabled={isPendingSave}
              className="w-full py-2.5 text-xs font-bold text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-50 border border-dashed border-slate-300 hover:border-slate-400 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer transition-colors duration-150 shadow-2xs active:scale-[0.99]"
              title="새 행사 식순 박스 추가"
            >
              <Plus className="w-4 h-4 text-slate-500" />
              <span>새 행사 식순 박스 추가</span>
            </button>
          )}
        </div>
      )}
    </>
  );
});

ScheduleTab.displayName = 'ScheduleTab';
