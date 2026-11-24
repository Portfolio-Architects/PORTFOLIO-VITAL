'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { YANGJAE_FALLBACK_DATA } from '@/lib/constants/yangjaeFestivalFallback';

export interface MilestoneItem {
  id: number;
  number: string;
  title: string;
  status: 'done' | 'in-progress' | 'todo';
  period: string;
  cooperationDepts?: string[];
  details: string[];
}

export interface BoothItem {
  id: number;
  category: string;
  name: string;
  scale: string;
  program: string;
  status: string;
  staffCount?: number;
  tables?: number;
  chairs?: number;
  manager?: string;
  phone?: string;
  adminPhone?: string;
  mobilePhone?: string;
  zone?: string;
  electricity?: string;
  electricityDetail?: string;
  bannerText?: string;
  remarks?: string;
}

export interface WeeklyReportItem {
  weekTitle: string;
  period: string;
  items: string[];
}

export interface ScheduleItem {
  id: number;
  date?: string;
  phase: string;
  time: string;
  duration?: string;
  title: string;
  lead?: string;
  status: 'done' | 'in-progress' | 'todo' | string;
  note?: string;
}

export interface DutyStaffMember {
  name: string;
  adminPhone?: string;
  mobilePhone?: string;
  role?: string;
}

export interface DutyItem {
  id: number | string;
  category: string;
  deptOrOrg: string;
  role?: string;
  manager: string;
  phone?: string;
  adminPhone?: string;
  mobilePhone?: string;
  tasks: string[];
  remarks?: string;
  staffMembers?: DutyStaffMember[];
  headcount?: {
    bogun?: number;
    sports?: number;
    agency?: number;
  };
}

export type ChecklistPhaseId =
  | 'phase1_plan'
  | 'phase2_contract'
  | 'phase3_promo'
  | 'phase4_onsite'
  | 'phase5_close';

export type ChecklistDomain =
  | '기획·장소'
  | '인허가·협조'
  | '계약·예산'
  | '부스·프로그램'
  | '홍보·접수'
  | 'VIP·의전'
  | '안전·현장'
  | '정산·보고';

export type ChecklistPriority = 'must' | 'high' | 'normal';

export interface FestivalChecklistItem {
  id: string;
  phase: ChecklistPhaseId;
  timingLabel: string;
  domain: ChecklistDomain;
  title: string;
  checked: boolean;
  priority: ChecklistPriority;
  actualDate2026: string;
  history2026: string;
  cooperationDepts: string[];
  docRef?: string;
  lessonWarning?: string;
  memo?: string;
}

export interface FestivalLessonItem {
  id: string;
  severity: 'critical' | 'warning' | 'tip';
  category: string;
  title: string;
  incident2026: string;
  actionForNextYear: string;
}

export interface FestivalKeyDocItem {
  id: string;
  docNo: string;
  date: string;
  title: string;
  docType: string;
}

export interface FestivalHistorySummary2026 {
  eventDate: string;
  participantsTotal: number;
  preRegistered: number;
  onSite: number;
  targetParticipants: number;
  yoyGrowthPct: number;
  vipCount: number;
  boothsSummary: {
    entities: number;
    totalDongs: number;
    healthDongs: number;
    supportDongs: number;
    buses: number;
    cumulativeVisitors: number;
    staffCount: number;
  };
  safetySummary: {
    accidents: number;
    ambulances: number;
    safetyStaff: number;
    complaints: number;
    complaintSummary: string;
  };
  budgetExecution: {
    agencyBudget: number;
    agencyExecuted: number;
    bidSaving: number;
    suppliesBudget: number;
    totalBudget: number;
    totalExecuted: number;
    agencyCompany: string;
    sponsorship: string;
  };
  keyDocs: FestivalKeyDocItem[];
  lessonsLearned: FestivalLessonItem[];
}

export interface FestivalData {
  meta: {
    title: string;
    shortTitle: string;
    eventDate: string;
    eventTime: string;
    location: string;
    course: string;
    targetAudience: string;
    programStructure?: string[];
    staffNote?: string;
    organizer: string;
    overallProgress: number;
    lastUpdated: string;
  };
  budget: {
    total: number;
    allocated: {
      agencyService: number;
      suppliesAndRental: number;
      refreshments: number;
      volunteerSupport: number;
    };
    agencyQuotation: number;
    agencyCompany: string;
  };
  weeklyReport?: WeeklyReportItem;
  milestones: MilestoneItem[];
  booths: BoothItem[];
  schedule?: ScheduleItem[];
  duties?: DutyItem[];
  departmentsCooperation?: {
    dept: string;
    task: string;
    status: string;
  }[];
  historySummary2026?: FestivalHistorySummary2026;
  nextYearChecklist?: FestivalChecklistItem[];
  lastUpdated?: string;
}

export { YANGJAE_FALLBACK_DATA };
export const initialFallbackData = YANGJAE_FALLBACK_DATA;

export function useYangjaeFestival(isActive: boolean = true) {
  return useQuery<FestivalData>({
    queryKey: ['festival', 'yangjae'],
    queryFn: async () => {
      const res = await fetch('/api/festival/yangjae?t=' + Date.now(), {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });
      if (!res.ok) {
        throw new Error('Failed to fetch festival data');
      }
      return res.json();
    },
    placeholderData: initialFallbackData,
    staleTime: 1000,
    gcTime: 1000 * 60 * 30,
    refetchInterval: isActive ? 2500 : false,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: isActive,
  });
}

export function useSaveYangjaeFestival() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (updatedData: FestivalData) => {
      const res = await fetch('/api/festival/yangjae', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatedData),
      });
      if (!res.ok) {
        throw new Error('Failed to save festival data to disk');
      }
      const json = await res.json();
      return (json && json.data) ? (json.data as FestivalData) : updatedData;
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['festival', 'yangjae'] });
    },
    onSuccess: (savedData: FestivalData) => {
      queryClient.setQueryData(['festival', 'yangjae'], savedData);
      queryClient.invalidateQueries({ queryKey: ['festival', 'yangjae'] });
    },
  });
}

export function calculateFestivalBudgetSummary(budget?: FestivalData['budget']) {
  if (!budget) {
    return {
      total: 0,
      allocatedTotal: 0,
      balance: 0,
      executionRate: 0,
    };
  }

  const total = Number(budget.total);
  const safeTotal = Number.isFinite(total) && total >= 0 ? total : 0;

  const allocated = budget.allocated || ({} as Record<string, number>);
  const agencyService = Number(allocated.agencyService);
  const suppliesAndRental = Number(allocated.suppliesAndRental);
  const refreshments = Number(allocated.refreshments);
  const volunteerSupport = Number(allocated.volunteerSupport);

  const safeAgencyService = Number.isFinite(agencyService) && agencyService >= 0 ? agencyService : 0;
  const safeSuppliesAndRental = Number.isFinite(suppliesAndRental) && suppliesAndRental >= 0 ? suppliesAndRental : 0;
  const safeRefreshments = Number.isFinite(refreshments) && refreshments >= 0 ? refreshments : 0;
  const safeVolunteerSupport = Number.isFinite(volunteerSupport) && volunteerSupport >= 0 ? volunteerSupport : 0;

  const allocatedTotal = safeAgencyService + safeSuppliesAndRental + safeRefreshments + safeVolunteerSupport;
  const balance = safeTotal - allocatedTotal;
  const executionRate = safeTotal > 0 ? Math.round((allocatedTotal / safeTotal) * 100) : 0;

  return {
    total: safeTotal,
    allocatedTotal,
    balance,
    executionRate,
  };
}
