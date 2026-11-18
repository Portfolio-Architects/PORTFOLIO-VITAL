import type { MilestoneItem, BoothItem, ScheduleItem, DutyItem, DutyStaffMember } from '@/hooks/useYangjaeFestival';

export type YangjaeReportTab = 'milestones' | 'booths' | 'duties' | 'schedule';

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
