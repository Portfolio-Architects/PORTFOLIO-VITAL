import type {
  MilestoneItem,
  BoothItem,
  ScheduleItem,
  DutyItem,
  DutyStaffMember,
  FestivalData,
  FestivalChecklistItem,
  FestivalHistorySummary2026,
  ChecklistPhaseId,
  ChecklistDomain,
  ChecklistPriority,
} from '@/hooks/useYangjaeFestival';

export type YangjaeReportTab = 'playbook' | 'milestones' | 'booths' | 'duties' | 'schedule';

export interface ChecklistPhaseMeta {
  id: ChecklistPhaseId;
  stepNo: number;
  label: string;
  shortLabel: string;
  windowLabel: string;
  monthLabel: string;
  accentBg: string;
  accentText: string;
  accentBorder: string;
  barClass: string;
}

export const CHECKLIST_PHASES: readonly ChecklistPhaseMeta[] = [
  {
    id: 'phase1_plan',
    stepNo: 1,
    label: '1단계 기획·장소',
    shortLabel: '기획·장소',
    windowLabel: 'D-90 ~ D-60',
    monthLabel: '7월 말 ~ 8월',
    accentBg: 'bg-slate-100',
    accentText: 'text-slate-800',
    accentBorder: 'border-slate-300/90',
    barClass: 'bg-slate-800',
  },
  {
    id: 'phase2_contract',
    stepNo: 2,
    label: '2단계 방침·계약·부스',
    shortLabel: '방침·계약·부스',
    windowLabel: 'D-60 ~ D-30',
    monthLabel: '8월 말 ~ 9월',
    accentBg: 'bg-indigo-50',
    accentText: 'text-indigo-700',
    accentBorder: 'border-indigo-200/90',
    barClass: 'bg-indigo-600',
  },
  {
    id: 'phase3_promo',
    stepNo: 3,
    label: '3단계 홍보·접수·의전',
    shortLabel: '홍보·접수·의전',
    windowLabel: 'D-30 ~ D-7',
    monthLabel: '9월 말 ~ 10월 중',
    accentBg: 'bg-sky-50',
    accentText: 'text-sky-700',
    accentBorder: 'border-sky-200/90',
    barClass: 'bg-sky-600',
  },
  {
    id: 'phase4_onsite',
    stepNo: 4,
    label: '4단계 현장설치·D-Day',
    shortLabel: '설치·D-Day',
    windowLabel: 'D-7 ~ D-Day',
    monthLabel: '10월 말',
    accentBg: 'bg-amber-50',
    accentText: 'text-amber-800',
    accentBorder: 'border-amber-200/90',
    barClass: 'bg-amber-500',
  },
  {
    id: 'phase5_close',
    stepNo: 5,
    label: '5단계 정산·결과보고',
    shortLabel: '정산·결과보고',
    windowLabel: 'D+1 ~ D+14',
    monthLabel: '11월 초',
    accentBg: 'bg-emerald-50',
    accentText: 'text-emerald-700',
    accentBorder: 'border-emerald-200/90',
    barClass: 'bg-emerald-600',
  },
] as const;

export const CHECKLIST_DOMAINS: readonly ('전체' | ChecklistDomain)[] = [
  '전체',
  '기획·장소',
  '인허가·협조',
  '계약·예산',
  '부스·프로그램',
  '홍보·접수',
  'VIP·의전',
  '안전·현장',
  '정산·보고',
] as const;

export interface ChecklistPlaybookTabProps {
  checklist: FestivalChecklistItem[];
  historySummary?: FestivalHistorySummary2026;
  meta: FestivalData['meta'];
  editingOverview: boolean;
  editOverviewData: FestivalData['meta'];
  daysLeft: number;
  isLocalAdmin: boolean;
  isLargeFont: boolean;
  isPendingSave: boolean;
  onToggleItem: (id: string) => void;
  onAddItem: (draft: {
    phase: ChecklistPhaseId;
    timingLabel: string;
    domain: ChecklistDomain;
    title: string;
    priority: ChecklistPriority;
    actualDate2026: string;
    history2026: string;
    cooperationDepts: string[];
    docRef?: string;
    lessonWarning?: string;
    memo?: string;
  }) => void;
  onUpdateItem: (id: string, updates: Partial<FestivalChecklistItem>) => void;
  onDeleteItem: (id: string) => void;
  onResetChecks: () => void;
  onExportChecklistCsv: () => void;
  onStartEditOverview: () => void;
  onCancelEditOverview: () => void;
  onSaveOverview: () => void;
  onChangeOverviewField: (updater: (prev: FestivalData['meta']) => FestivalData['meta']) => void;
}

export interface DetailDraft {
  uid: string;
  raw: string;
}

export interface ParsedDetail {
  date: string;
  status: 'done' | 'in-progress' | 'todo';
  attendees: string;
  text: string;
}

export interface BoothScaleParsed {
  dong: number;
  bus: number;
}

export const SCHEDULE_PHASES = ['전체', '식전·준비', '공식행사', '걷기대회', '공연·폐회'] as const;
export const DUTY_CATEGORIES = ['전체', '운영', '코스', '부스', 'VIP의전', '직원식사', '쓰레기처리'] as const;

export interface DetailEditRowProps {
  initialDetail: string;
  onUpdate: (newDetail: string) => void;
  onDelete: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  onTransfer?: () => void;
}

export interface EditableDetailItemProps {
  draft: DetailDraft;
  dIdx: number;
  totalCount: number;
  milestoneId: number;
  onUpdate: (index: number, newDetailStr: string) => void;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
  onTransfer: (milestoneId: number, index: number, raw: string) => void;
  onDelete: (index: number) => void;
}

export interface MilestonesTabProps {
  milestones: MilestoneItem[];
  detailDrafts: DetailDraft[];
  editingMilestoneId: number | null;
  editMilestoneData: MilestoneItem | null;
  expandedTaskIds: Set<number>;
  isLocalAdmin: boolean;
  isLargeFont: boolean;
  isPendingSave: boolean;
  allExpanded: boolean;
  onToggleExpand: (id: number) => void;
  onToggleAllExpand: () => void;
  onStartEditMilestone: (item: MilestoneItem) => void;
  onCancelEditMilestone: () => void;
  onSaveMilestone: () => void;
  onAddMilestone: () => void;
  onDeleteMilestone: (id: number) => void;
  onUpdateMilestoneField: (field: keyof MilestoneItem, val: any) => void;
  onUpdateDetailRow: (dIdx: number, newDetailStr: string) => void;
  onMoveUpDetailRow: (dIdx: number) => void;
  onMoveDownDetailRow: (dIdx: number) => void;
  onDeleteDetailRow: (dIdx: number) => void;
  onOpenTransferModal: (sourceMilestoneId: number, detailIndex: number, detailRaw: string) => void;
  onAddDetailRow: () => void;
}

export interface BoothsTabProps {
  booths: BoothItem[];
  editingBooths: boolean;
  editBoothsData: BoothItem[];
  editingBoothId: number | null;
  editSingleBoothData: BoothItem | null;
  selectedCategory: string;
  showPrivateMobile: boolean;
  isLocalAdmin: boolean;
  isLargeFont: boolean;
  isPendingSave: boolean;
  boothMetrics: {
    totalEntities: number;
    confirmedEntities: number;
    pendingEntities: number;
    hqEntities: number;
    totalDong: number;
    confirmedDong: number;
    pendingDong: number;
    totalBus: number;
    totalStaff: number;
    totalTables: number;
    totalChairs: number;
  };
  onSelectCategory: (cat: string) => void;
  onSwitchToggle: () => void;
  onStartEditBooths: () => void;
  onCancelEditBooths: () => void;
  onSaveBooths: () => void;
  onStartEditSingleBooth: (booth: BoothItem) => void;
  onCancelEditSingleBooth: () => void;
  onSaveSingleBooth: () => void;
  onUpdateBoothField: (id: number, field: keyof BoothItem, value: any) => void;
  onUpdateSingleBoothField: (field: keyof BoothItem, value: any) => void;
  onMoveBoothUp: (id: number) => void;
  onMoveBoothDown: (id: number) => void;
  onAddBooth: () => void;
  onDeleteBooth: (id: number) => void;
}

export interface DutiesTabProps {
  duties: DutyItem[];
  editingDuties: boolean;
  editDutiesData: DutyItem[];
  dutySearchQuery: string;
  selectedDutyCategory: string;
  isDutyPillsWrapped: boolean;
  showPrivateMobile: boolean;
  isLocalAdmin: boolean;
  isLargeFont: boolean;
  isSyncingExcel: boolean;
  isPendingSave: boolean;
  dutyPillsRef: React.RefObject<HTMLDivElement | null>;
  onDutySearchChange: (q: string) => void;
  onSelectDutyCategory: (cat: string) => void;
  onTogglePillsWrap: () => void;
  onScrollPillsLeft: () => void;
  onScrollPillsRight: () => void;
  onPillsWheel: (e: React.WheelEvent<HTMLDivElement>) => void;
  onSwitchToggle: () => void;
  onSyncDesktopExcel: () => void;
  onExportCsv: () => void;
  onStartEditDuties: () => void;
  onCancelEditDuties: () => void;
  onSaveDuties: () => void;
  onAddDutyRow: () => void;
  onDeleteDutyRow: (id: number | string) => void;
  onMoveDutyUp: (id: number | string) => void;
  onMoveDutyDown: (id: number | string) => void;
  onUpdateDutyField: (id: number | string, field: keyof DutyItem, val: any) => void;
  onAddDutyStaff: (dutyId: number | string) => void;
  onDeleteDutyStaff: (dutyId: number | string, idx: number) => void;
  onUpdateDutyStaff: (dutyId: number | string, idx: number, field: keyof DutyStaffMember, val: string) => void;
}

export interface ScheduleTabProps {
  schedule: ScheduleItem[];
  editingScheduleId: number | null;
  editScheduleData: ScheduleItem | null;
  scheduleSearchQuery: string;
  selectedPhase: string;
  isLocalAdmin: boolean;
  isLargeFont: boolean;
  isPendingSave: boolean;
  onSearchChange: (q: string) => void;
  onSelectPhase: (phase: string) => void;
  onStartEditSchedule: (item: ScheduleItem) => void;
  onCancelEditSchedule: () => void;
  onSaveSchedule: () => void;
  onAddSchedule: () => void;
  onDeleteSchedule: (id: number) => void;
  onUpdateScheduleField: (field: keyof ScheduleItem, val: any) => void;
}

export interface SecurityPinModalProps {
  isOpen: boolean;
  pinInput: string;
  pinError: string | null;
  onPinChange: (val: string) => void;
  onSubmit: () => void;
  onClose: () => void;
}

export interface SubTaskTransferModalProps {
  isOpen: boolean;
  transferTarget: { sourceMilestoneId: number; detailIndex: number; detailRaw: string } | null;
  currentMilestones: MilestoneItem[];
  selectedTargetMilestoneId: number | null;
  isTransferring: boolean;
  onSelectTarget: (id: number) => void;
  onExecute: () => void;
  onClose: () => void;
}
