"use client";

import React, { useState, useMemo, useSyncExternalStore, useCallback, useEffect } from 'react';
import {
  Check,
  Share2,
  Edit3,
  Save,
  X,
  Plus,
  Trash2,
  Loader2,
} from 'lucide-react';
import {
  useYangjaeFestival,
  useSaveYangjaeFestival,
  YANGJAE_FALLBACK_DATA,
  FestivalData,
  MilestoneItem,
  BoothItem,
  ScheduleItem,
  DutyItem,
  DutyStaffMember,
} from '@/hooks/useYangjaeFestival';

import {
  DetailDraft,
  YangjaeReportTab,
  ParsedDetail,
  BoothScaleParsed,
  SCHEDULE_PHASES,
  DUTY_CATEGORIES,
} from './yangjae/types';

import {
  copyToClipboardSafe,
  formatAutoHyphen,
  maskPersonName,
  parseBoothScale,
  parseDetail,
  formatDetail,
  getDetailSortKey,
  sortDetailsAscending,
  STAFF_PHONE_MAP,
  getStaffInfo,
  renderBulletedContent,
  FESTIVAL_TARGET_TIMESTAMP,
  LARGE_FONT_STYLES,
  safeClone,
  YANGJAE_REPORT_TABS,
} from './yangjae/festivalUtils';

import { MilestonesTab } from './yangjae/MilestonesTab';
import { BoothsTab } from './yangjae/BoothsTab';
import { DutiesTab } from './yangjae/DutiesTab';
import { ScheduleTab } from './yangjae/ScheduleTab';
import { SecurityPinModal } from './yangjae/SecurityPinModal';
import { SubTaskTransferModal } from './yangjae/SubTaskTransferModal';

// Re-export all 20 public symbols for backward compatibility
export type { DetailDraft, YangjaeReportTab, ParsedDetail, BoothScaleParsed };
export {
  formatAutoHyphen,
  maskPersonName,
  SCHEDULE_PHASES,
  DUTY_CATEGORIES,
  parseBoothScale,
  parseDetail,
  formatDetail,
  getDetailSortKey,
  sortDetailsAscending,
  STAFF_PHONE_MAP,
  getStaffInfo,
  renderBulletedContent,
};

const subscribeDays = () => () => {};
const getClientDaysLeft = () => {
  const diff = Math.ceil((FESTIVAL_TARGET_TIMESTAMP - Date.now()) / (1000 * 60 * 60 * 24));
  return typeof diff === 'number' && !isNaN(diff) && diff > 0 ? diff : 0;
};
const getServerDaysLeft = () => 0;

// 외부 링크 접속자 vs 로컬 PC 관리자 판별 (SSR 하이드레이션 무결성 보장)
const subscribeLocalAdmin = () => () => {};
const getClientIsLocalAdmin = () => {
  if (typeof window === 'undefined') return false;
  return (
    window.location.hostname.includes('localhost') ||
    window.location.hostname.includes('127.0.0.1') ||
    window.location.hostname.includes('trycloudflare.com') ||
    window.location.hostname.includes('loca.lt')
  );
};
const getServerIsLocalAdmin = () => false;

export interface YangjaeFestivalDashboardProps {
  isActive?: boolean;
}

function YangjaeFestivalDashboardComponent({ isActive = true }: YangjaeFestivalDashboardProps = {}) {
  const { data = YANGJAE_FALLBACK_DATA } = useYangjaeFestival(isActive);
  const saveMutation = useSaveYangjaeFestival();

  // 로컬 관리자 여부
  const isLocalAdmin = useSyncExternalStore(subscribeLocalAdmin, getClientIsLocalAdmin, getServerIsLocalAdmin);

  // 컴포넌트별 분리된 독립 편집 상태
  const [editingOverview, setEditingOverview] = useState<boolean>(false);
  const [editOverviewData, setEditOverviewData] = useState<FestivalData['meta']>(() => data?.meta || YANGJAE_FALLBACK_DATA.meta);

  const [editingMilestoneId, setEditingMilestoneId] = useState<number | null>(null);
  const [editMilestoneData, setEditMilestoneData] = useState<MilestoneItem | null>(null);
  const [detailDrafts, setDetailDrafts] = useState<DetailDraft[]>([]);

  const [editingBooths, setEditingBooths] = useState<boolean>(false);
  const [editBoothsData, setEditBoothsData] = useState<BoothItem[]>(() => data?.booths || YANGJAE_FALLBACK_DATA.booths || []);
  const [editingBoothId, setEditingBoothId] = useState<number | null>(null);
  const [editSingleBoothData, setEditSingleBoothData] = useState<BoothItem | null>(null);

  const [editingScheduleId, setEditingScheduleId] = useState<number | null>(null);
  const [editScheduleData, setEditScheduleData] = useState<ScheduleItem | null>(null);

  const [editingDuties, setEditingDuties] = useState<boolean>(false);
  const [editDutiesData, setEditDutiesData] = useState<DutyItem[]>(() => (data?.duties || YANGJAE_FALLBACK_DATA.duties || []) as DutyItem[]);

  const [saveToast, setSaveToast] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string>('수정 사항이 저장되었습니다!');
  const [showPrivateMobile, setShowPrivateMobile] = useState<boolean>(false);
  const [showPinModal, setShowPinModal] = useState<boolean>(false);
  const [pinInput, setPinInput] = useState<string>('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [isAuthed, setIsAuthed] = useState<boolean>(false);

  const VALID_PINS = useMemo(() => ['1031', '0000', '7116', '2026', 'gangnam'], []);

  // 프론트엔드 비상연락망 모드 로컬 스토리지 동기화
  useEffect(() => {
    try {
      const savedAuth = localStorage.getItem('yangjae_contact_authed') === 'true';
      const savedMobile = localStorage.getItem('yangjae_festival_show_mobile') === 'true';
      if (savedAuth) {
        setIsAuthed(true);
        if (savedMobile) setShowPrivateMobile(true);
      }
    } catch {}
  }, []);

  const handleSwitchToggle = useCallback(() => {
    if (showPrivateMobile) {
      setShowPrivateMobile(false);
      try {
        localStorage.setItem('yangjae_festival_show_mobile', 'false');
      } catch {}
    } else {
      let alreadyAuthed = isAuthed;
      if (!alreadyAuthed) {
        try {
          alreadyAuthed = localStorage.getItem('yangjae_contact_authed') === 'true';
        } catch {}
      }
      if (alreadyAuthed) {
        setShowPrivateMobile(true);
        try {
          localStorage.setItem('yangjae_festival_show_mobile', 'true');
        } catch {}
      } else {
        setPinInput('');
        setPinError(null);
        setShowPinModal(true);
      }
    }
  }, [showPrivateMobile, isAuthed]);

  const handlePinSubmit = useCallback(() => {
    const clean = pinInput.trim();
    if (VALID_PINS.includes(clean)) {
      setIsAuthed(true);
      setShowPrivateMobile(true);
      setShowPinModal(false);
      setPinError(null);
      setPinInput('');
      try {
        localStorage.setItem('yangjae_contact_authed', 'true');
        localStorage.setItem('yangjae_festival_show_mobile', 'true');
      } catch {}
    } else {
      setPinError('비밀번호가 올바르지 않습니다.');
    }
  }, [pinInput, VALID_PINS]);

  // 세부 과업 다른 추진과제 카테고리로 이동(Transfer) 상태
  const [transferTarget, setTransferTarget] = useState<{
    sourceMilestoneId: number;
    detailIndex: number;
    detailRaw: string;
  } | null>(null);
  const [selectedTargetMilestoneId, setSelectedTargetMilestoneId] = useState<number | null>(null);
  const [isTransferring, setIsTransferring] = useState<boolean>(false);

  const [selectedTab, setSelectedTab] = useState<YangjaeReportTab>('milestones');
  const [visitedFestivalTabs, setVisitedFestivalTabs] = useState<Record<YangjaeReportTab, boolean>>({
    milestones: true,
    booths: false,
    duties: false,
    schedule: false,
  });
  const [selectedCategory, setSelectedCategory] = useState<string>('전체');
  const [scheduleSearchQuery, setScheduleSearchQuery] = useState<string>('');
  const [dutySearchQuery, setDutySearchQuery] = useState<string>('');
  const [selectedDutyCategory, setSelectedDutyCategory] = useState<string>('전체');
  const [isDutyPillsWrapped, setIsDutyPillsWrapped] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('yangjae_duty_pills_wrap');
        if (saved !== null) return saved === 'true';
      } catch {}
    }
    return true;
  });
  const dutyPillsRef = React.useRef<HTMLDivElement>(null);

  const handleScrollDutyPillsLeft = useCallback(() => {
    if (dutyPillsRef.current) {
      dutyPillsRef.current.scrollBy({ left: -150, behavior: 'smooth' });
    }
  }, []);

  const handleScrollDutyPillsRight = useCallback(() => {
    if (dutyPillsRef.current) {
      dutyPillsRef.current.scrollBy({ left: 150, behavior: 'smooth' });
    }
  }, []);

  const handleDutyPillsWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    if (e.deltaY !== 0 && !isDutyPillsWrapped && dutyPillsRef.current) {
      dutyPillsRef.current.scrollLeft += e.deltaY;
    }
  }, [isDutyPillsWrapped]);

  const toggleDutyPillsWrap = useCallback(() => {
    setIsDutyPillsWrapped((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('yangjae_duty_pills_wrap', String(next));
      } catch {}
      return next;
    });
  }, []);

  const [isSyncingExcel, setIsSyncingExcel] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [isLargeFont, setIsLargeFont] = useState<boolean>(false);

  useEffect(() => {
    if (!editingDuties && data?.duties) {
      setEditDutiesData(safeClone(data.duties as DutyItem[]));
    }
  }, [data?.duties, editingDuties]);

  // DetailEditRow memoized stable handlers
  const handleUpdateDetailRow = useCallback((dIdx: number, newDetailStr: string) => {
    setDetailDrafts((prev) => {
      const next = [...prev];
      if (next[dIdx]) {
        next[dIdx] = { ...next[dIdx], raw: newDetailStr };
      }
      return next;
    });
    setEditMilestoneData((prev) => (prev ? { ...prev, details: (prev.details || []).map((d, i) => (i === dIdx ? newDetailStr : d)) } : null));
  }, []);

  const handleMoveUpDetailRow = useCallback((dIdx: number) => {
    if (dIdx <= 0) return;
    setDetailDrafts((prev) => {
      const next = [...prev];
      const [moved] = next.splice(dIdx, 1);
      next.splice(dIdx - 1, 0, moved);
      setEditMilestoneData((mPrev) => (mPrev ? { ...mPrev, details: next.map((d) => d.raw) } : null));
      return next;
    });
  }, []);

  const handleMoveDownDetailRow = useCallback((dIdx: number) => {
    setDetailDrafts((prev) => {
      if (dIdx >= prev.length - 1) return prev;
      const next = [...prev];
      const [moved] = next.splice(dIdx, 1);
      next.splice(dIdx + 1, 0, moved);
      setEditMilestoneData((mPrev) => (mPrev ? { ...mPrev, details: next.map((d) => d.raw) } : null));
      return next;
    });
  }, []);

  const handleDeleteDetailRow = useCallback((dIdx: number) => {
    setDetailDrafts((prev) => {
      const next = prev.filter((_, i) => i !== dIdx);
      setEditMilestoneData((mPrev) => (mPrev ? { ...mPrev, details: next.map((d) => d.raw) } : null));
      return next;
    });
  }, []);

  // 과제별 Collapse / Expand 상태
  const [expandedTaskIds, setExpandedTaskIds] = useState<Set<number>>(() => new Set());

  const toggleTaskExpand = useCallback((id: number) => {
    setExpandedTaskIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const allMilestoneIds = useMemo(() => {
    const list = data?.milestones || [];
    const ids = new Set<number>();
    for (let i = 0; i < list.length; i++) {
      if (list[i]?.id !== undefined && list[i].id !== 2) {
        ids.add(list[i].id);
      }
    }
    return ids;
  }, [data?.milestones]);

  const isAllExpanded = useMemo(() => {
    if (allMilestoneIds.size === 0) return false;
    for (const id of allMilestoneIds) {
      if (!expandedTaskIds.has(id)) return false;
    }
    return true;
  }, [allMilestoneIds, expandedTaskIds]);

  const toggleAllExpand = useCallback(() => {
    setExpandedTaskIds((prev) => {
      if (allMilestoneIds.size === 0) return new Set();
      let allExpanded = true;
      for (const id of allMilestoneIds) {
        if (!prev.has(id)) {
          allExpanded = false;
          break;
        }
      }
      return allExpanded ? new Set() : new Set(allMilestoneIds);
    });
  }, [allMilestoneIds]);

  // Derived D-Day calculation
  const daysLeft = useSyncExternalStore(subscribeDays, getClientDaysLeft, getServerDaysLeft);

  const activeBooths = useMemo(() => {
    return (editingBooths ? editBoothsData : (data?.booths || [])) || [];
  }, [editingBooths, editBoothsData, data?.booths]);

  const boothMetrics = useMemo(() => {
    const list = activeBooths || [];
    let operatingEntitiesCount = 0;
    let confirmedEntities = 0;
    let pendingEntities = 0;
    let hqEntities = 0;
    let totalDong = 0;
    let confirmedDong = 0;
    let pendingDong = 0;
    let totalBus = 0;
    let confirmedBus = 0;
    let totalTables = 0;
    let confirmedTables = 0;
    let totalChairs = 0;
    let confirmedChairs = 0;
    let totalStaff = 0;
    let confirmedStaff = 0;

    for (let i = 0; i < list.length; i++) {
      const b = list[i];
      if (!b) continue;

      const isHQ = b.category === '운영본부' || b.category === '운영주체' || (typeof b.name === 'string' && b.name.includes('보건행정팀'));
      const isConfirmed = b.status === '확정';

      if (isHQ) {
        hqEntities++;
      } else {
        operatingEntitiesCount++;
        if (isConfirmed) {
          confirmedEntities++;
        } else {
          pendingEntities++;
        }
      }

      const parsed = parseBoothScale(b.scale);
      totalDong += parsed.dong;
      totalBus += parsed.bus;
      if (isConfirmed) {
        confirmedDong += parsed.dong;
        confirmedBus += parsed.bus;
      } else {
        pendingDong += parsed.dong;
      }

      const tablesCount = typeof b.tables === 'number' ? b.tables : (Number(b.tables) || 0);
      const chairsCount = typeof b.chairs === 'number' ? b.chairs : (Number(b.chairs) || 0);
      const staffCount = typeof b.staffCount === 'number' ? b.staffCount : (Number(b.staffCount) || 0);

      totalTables += tablesCount;
      totalChairs += chairsCount;
      totalStaff += staffCount;
      if (isConfirmed) {
        confirmedTables += tablesCount;
        confirmedChairs += chairsCount;
        confirmedStaff += staffCount;
      }
    }

    return {
      totalEntities: operatingEntitiesCount,
      confirmedEntities,
      pendingEntities,
      hqEntities,
      totalDong,
      confirmedDong,
      pendingDong,
      totalBus,
      confirmedBus,
      totalTables,
      confirmedTables,
      totalChairs,
      confirmedChairs,
      totalStaff,
      confirmedStaff,
    };
  }, [activeBooths]);

  const handleSelectTab = useCallback((tabId: YangjaeReportTab) => {
    setVisitedFestivalTabs((prev) => (prev[tabId] ? prev : { ...prev, [tabId]: true }));
    setSelectedTab(tabId);
  }, []);

  const activeSchedule = useMemo(() => {
    const list = (data?.schedule || YANGJAE_FALLBACK_DATA.schedule || []) as ScheduleItem[];
    if (editingScheduleId !== null && editScheduleData && !list.some((s) => s.id === editingScheduleId)) {
      return [...list, editScheduleData];
    }
    return list;
  }, [data?.schedule, editingScheduleId, editScheduleData]);

  const activeDuties = useMemo(() => {
    return (data?.duties || YANGJAE_FALLBACK_DATA.duties || []) as DutyItem[];
  }, [data?.duties]);

  const handleSelectCategory = useCallback((cat: string) => {
    setSelectedCategory(cat);
  }, []);

  const PUBLIC_SHARE_URL = 'https://portfolio-hchps.pages.dev/festival/yangjae';

  // 1. 행사 개요 독립 편집 핸들러
  const handleStartEditOverview = () => {
    setEditOverviewData(safeClone(data.meta));
    setEditingOverview(true);
  };
  const handleCancelEditOverview = () => {
    setEditingOverview(false);
  };
  const handleSaveOverview = async () => {
    try {
      await saveMutation.mutateAsync({
        ...data,
        meta: editOverviewData,
      });
      setEditingOverview(false);
      setToastMessage('행사 개요가 저장되었습니다!');
      setSaveToast(true);
      setTimeout(() => setSaveToast(false), 3000);
    } catch {
      alert('행사 개요 저장에 실패했습니다.');
    }
  };

  // 2. 개별 추진과제 독립 편집 핸들러
  const handleStartEditMilestone = (m: MilestoneItem) => {
    const sortedDetails = sortDetailsAscending(m.details || []);
    const sortedMilestone = { ...safeClone(m), details: sortedDetails };
    setEditMilestoneData(sortedMilestone);
    setEditingMilestoneId(m.id);
    setExpandedTaskIds((prev) => new Set([...prev, m.id]));
    const drafts: DetailDraft[] = sortedDetails.map((detail, idx) => ({
      uid: `m-${m.id}-detail-${idx}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      raw: detail,
    }));
    setDetailDrafts(drafts);
  };
  const handleCancelEditMilestone = () => {
    setEditingMilestoneId(null);
    setEditMilestoneData(null);
    setDetailDrafts([]);
  };
  const handleSaveMilestone = async () => {
    if (!editMilestoneData || editingMilestoneId === null) return;
    try {
      const rawDetails = detailDrafts.length > 0
        ? detailDrafts.map((d) => d.raw)
        : (editMilestoneData.details || []);
      const finalDetails = sortDetailsAscending(rawDetails);
      const updatedMilestone: MilestoneItem = {
        ...editMilestoneData,
        details: finalDetails,
      };
      const nextMilestones = (data.milestones || []).map((m) =>
        m.id === editingMilestoneId ? updatedMilestone : m
      );
      await saveMutation.mutateAsync({
        ...data,
        milestones: nextMilestones,
      });
      setEditingMilestoneId(null);
      setEditMilestoneData(null);
      setDetailDrafts([]);
      setToastMessage('추진과제가 저장되었습니다!');
      setSaveToast(true);
      setTimeout(() => setSaveToast(false), 3000);
    } catch {
      alert('추진과제 저장에 실패했습니다.');
    }
  };
  const handleAddMilestone = async () => {
    const maxId = (data.milestones || []).reduce((max, m) => Math.max(max, Number(m?.id) || 0), 0);
    const nextId = (Number.isFinite(maxId) ? maxId : 0) + 1;
    const initialDetailStr = '세부 추진 계획을 입력하세요.';
    const newTask: MilestoneItem = {
      id: nextId,
      number: `추진과제 ${nextId}`,
      title: '신규 추진과제',
      status: 'todo',
      period: '',
      cooperationDepts: [],
      details: [initialDetailStr],
    };
    const nextMilestones = [...(data.milestones || []), newTask];
    try {
      await saveMutation.mutateAsync({
        ...data,
        milestones: nextMilestones,
      });
      setExpandedTaskIds((prev) => new Set([...prev, nextId]));
      setEditMilestoneData(newTask);
      setEditingMilestoneId(nextId);
      setDetailDrafts([
        {
          uid: `m-${nextId}-detail-0-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          raw: initialDetailStr,
        },
      ]);
    } catch {
      alert('과제 추가에 실패했습니다.');
    }
  };
  const handleDeleteMilestone = async (id: number) => {
    if (!confirm('해당 추진과제를 삭제하시겠습니까?')) return;
    const nextMilestones = (data.milestones || []).filter((m) => m.id !== id);
    try {
      await saveMutation.mutateAsync({
        ...data,
        milestones: nextMilestones,
      });
      setExpandedTaskIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      if (editingMilestoneId === id) {
        setEditingMilestoneId(null);
        setEditMilestoneData(null);
        setDetailDrafts([]);
      }
      setToastMessage('추진과제가 삭제되었습니다.');
      setSaveToast(true);
      setTimeout(() => setSaveToast(false), 3000);
    } catch {
      alert('과제 삭제에 실패했습니다.');
    }
  };

  // 2-1. 세부 과업 카테고리(추진과제) 이동 모달 및 실행 핸들러
  const handleOpenTransferModal = useCallback((sourceMilestoneId: number, detailIndex: number, detailRaw: string) => {
    setTransferTarget({ sourceMilestoneId, detailIndex, detailRaw });
    const otherMilestones = (data?.milestones || []).filter((m) => m.id !== sourceMilestoneId);
    setSelectedTargetMilestoneId(otherMilestones.length > 0 ? otherMilestones[0].id : null);
  }, [data?.milestones]);

  const handleCloseTransferModal = useCallback(() => {
    if (isTransferring) return;
    setTransferTarget(null);
    setSelectedTargetMilestoneId(null);
  }, [isTransferring]);

  const handleExecuteTransfer = async () => {
    if (!transferTarget || selectedTargetMilestoneId === null) return;
    if (selectedTargetMilestoneId === transferTarget.sourceMilestoneId) return;

    const { sourceMilestoneId, detailIndex, detailRaw } = transferTarget;
    setIsTransferring(true);

    try {
      const currentMilestones: MilestoneItem[] = safeClone(data?.milestones || []);
      const sourceMilestone = currentMilestones.find((m) => m.id === sourceMilestoneId);
      const targetMilestone = currentMilestones.find((m) => m.id === selectedTargetMilestoneId);

      if (!sourceMilestone || !targetMilestone) {
        alert('대상 추진과제를 찾을 수 없습니다.');
        setIsTransferring(false);
        return;
      }

      const nextMilestones = currentMilestones.map((m) => {
        if (m.id === sourceMilestoneId) {
          const nextDetails = [...(m.details || [])];
          if (detailIndex >= 0 && detailIndex < nextDetails.length) {
            nextDetails.splice(detailIndex, 1);
          } else {
            const matchIdx = nextDetails.findIndex((d) => d === detailRaw);
            if (matchIdx !== -1) nextDetails.splice(matchIdx, 1);
          }
          return {
            ...m,
            details: sortDetailsAscending(nextDetails),
          };
        }
        if (m.id === selectedTargetMilestoneId) {
          return {
            ...m,
            details: sortDetailsAscending([...(m.details || []), detailRaw]),
          };
        }
        return m;
      });

      await saveMutation.mutateAsync({
        ...data,
        milestones: nextMilestones,
      });

      if (editingMilestoneId === sourceMilestoneId) {
        setDetailDrafts((prev) => prev.filter((_, i) => i !== detailIndex));
        setEditMilestoneData((prev) => {
          if (!prev) return null;
          const nextDetails = [...(prev.details || [])];
          nextDetails.splice(detailIndex, 1);
          return { ...prev, details: sortDetailsAscending(nextDetails) };
        });
      }

      if (editingMilestoneId === selectedTargetMilestoneId) {
        const sortedTargetDetails = sortDetailsAscending([...(editMilestoneData?.details || []), detailRaw]);
        setDetailDrafts(sortedTargetDetails.map((detail, idx) => ({
          uid: `m-${selectedTargetMilestoneId}-detail-${idx}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          raw: detail,
        })));
        setEditMilestoneData((prev) => {
          if (!prev) return null;
          return { ...prev, details: sortedTargetDetails };
        });
      }

      setExpandedTaskIds((prev) => new Set([...prev, selectedTargetMilestoneId]));
      setTransferTarget(null);
      setSelectedTargetMilestoneId(null);
      setToastMessage(`과업이 '${targetMilestone.number || '추진과제'}. ${targetMilestone.title}'(으)로 이동되었습니다!`);
      setSaveToast(true);
      setTimeout(() => setSaveToast(false), 3000);
    } catch {
      alert('과업 이동에 실패했습니다. 다시 시도해 주세요.');
    } finally {
      setIsTransferring(false);
    }
  };

  // 3. 부스 현황 독립 편집 핸들러
  const handleStartEditBooths = () => {
    setEditingBoothId(null);
    setEditSingleBoothData(null);
    setEditBoothsData(safeClone(data.booths || []));
    setEditingBooths(true);
  };
  const handleCancelEditBooths = () => {
    setEditBoothsData(safeClone(data.booths || []));
    setEditingBooths(false);
  };

  const handleStartEditSingleBooth = (booth: BoothItem) => {
    if (editingBooths) {
      setEditingBooths(false);
    }
    setEditingBoothId(booth.id);
    setEditSingleBoothData(safeClone(booth));
  };

  const handleCancelEditSingleBooth = () => {
    setEditingBoothId(null);
    setEditSingleBoothData(null);
  };

  const handleSaveSingleBooth = async () => {
    if (!editSingleBoothData || editingBoothId === null) return;
    try {
      const adminFormatted = formatAutoHyphen((editSingleBoothData.adminPhone || '').trim());
      const mobileFormatted = formatAutoHyphen((editSingleBoothData.mobilePhone || '').trim());
      const phoneFormatted = formatAutoHyphen(adminFormatted || mobileFormatted || (editSingleBoothData.phone || '').trim());

      const updatedBooth: BoothItem = {
        ...editSingleBoothData,
        staffCount: Math.max(0, Number(editSingleBoothData.staffCount) || 0),
        tables: Math.max(0, Number(editSingleBoothData.tables) || 0),
        chairs: Math.max(0, Number(editSingleBoothData.chairs) || 0),
        manager: (editSingleBoothData.manager || '').trim(),
        adminPhone: adminFormatted,
        mobilePhone: mobileFormatted,
        phone: phoneFormatted,
      };
      const currentBooths = data?.booths || YANGJAE_FALLBACK_DATA.booths || [];
      const nextBooths = currentBooths.map((b) => (b.id === editingBoothId ? updatedBooth : b));
      await saveMutation.mutateAsync({
        ...data,
        booths: nextBooths,
      });
      setEditingBoothId(null);
      setEditSingleBoothData(null);
      setToastMessage(`[${updatedBooth.name}] 부스 정보가 저장되었습니다!`);
      setSaveToast(true);
      setTimeout(() => setSaveToast(false), 3000);
    } catch {
      alert('부스 정보 저장에 실패했습니다.');
    }
  };

  const handleMoveBoothUp = useCallback((boothId: number) => {
    setEditBoothsData((prev) => {
      const list = [...prev];
      if (selectedCategory === '전체') {
        const idx = list.findIndex((b) => b.id === boothId);
        if (idx <= 0) return prev;
        const temp = list[idx];
        list[idx] = list[idx - 1];
        list[idx - 1] = temp;
        return list;
      } else {
        const filtered = list.filter((b) => {
          if (selectedCategory === '보건소 부서' || selectedCategory === '보건소 사업' || selectedCategory === '보건소 특화') {
            return b.category === '보건소 부서' || b.category === '보건소 사업' || b.category === '보건소 특화';
          }
          if (selectedCategory === '민간' || selectedCategory === '민간 헬스케어' || selectedCategory === '전문 의료·검진' || selectedCategory === '의료·검진' || selectedCategory === '의료 검진') {
            return b.category === '민간' || b.category === '민간 헬스케어' || b.category === '전문 의료·검진' || b.category === '의료·검진' || b.category === '의료 검진';
          }
          return b.category === selectedCategory || (typeof b.category === 'string' && b.category.includes(selectedCategory));
        });
        const filteredIdx = filtered.findIndex((b) => b.id === boothId);
        if (filteredIdx <= 0) return prev;
        const prevBoothId = filtered[filteredIdx - 1].id;
        const idxA = list.findIndex((b) => b.id === boothId);
        const idxB = list.findIndex((b) => b.id === prevBoothId);
        if (idxA === -1 || idxB === -1) return prev;
        const temp = list[idxA];
        list[idxA] = list[idxB];
        list[idxB] = temp;
        return list;
      }
    });
  }, [selectedCategory]);

  const handleMoveBoothDown = useCallback((boothId: number) => {
    setEditBoothsData((prev) => {
      const list = [...prev];
      if (selectedCategory === '전체') {
        const idx = list.findIndex((b) => b.id === boothId);
        if (idx === -1 || idx >= list.length - 1) return prev;
        const temp = list[idx];
        list[idx] = list[idx + 1];
        list[idx + 1] = temp;
        return list;
      } else {
        const filtered = list.filter((b) => {
          if (selectedCategory === '보건소 부서' || selectedCategory === '보건소 사업' || selectedCategory === '보건소 특화') {
            return b.category === '보건소 부서' || b.category === '보건소 사업' || b.category === '보건소 특화';
          }
          if (selectedCategory === '민간' || selectedCategory === '민간 헬스케어' || selectedCategory === '전문 의료·검진' || selectedCategory === '의료·검진' || selectedCategory === '의료 검진') {
            return b.category === '민간' || b.category === '민간 헬스케어' || b.category === '전문 의료·검진' || b.category === '의료·검진' || b.category === '의료 검진';
          }
          return b.category === selectedCategory || (typeof b.category === 'string' && b.category.includes(selectedCategory));
        });
        const filteredIdx = filtered.findIndex((b) => b.id === boothId);
        if (filteredIdx === -1 || filteredIdx >= filtered.length - 1) return prev;
        const nextBoothId = filtered[filteredIdx + 1].id;
        const idxA = list.findIndex((b) => b.id === boothId);
        const idxB = list.findIndex((b) => b.id === nextBoothId);
        if (idxA === -1 || idxB === -1) return prev;
        const temp = list[idxA];
        list[idxA] = list[idxB];
        list[idxB] = temp;
        return list;
      }
    });
  }, [selectedCategory]);

  const handleSaveBooths = async () => {
    try {
      const normalizedBooths = editBoothsData.map((b, idx) => {
        const adminFormatted = formatAutoHyphen((b.adminPhone || '').trim());
        const mobileFormatted = formatAutoHyphen((b.mobilePhone || '').trim());
        const phoneFormatted = formatAutoHyphen(adminFormatted || mobileFormatted || (b.phone || '').trim());
        return {
          ...b,
          id: idx + 1,
          staffCount: Math.max(0, Number(b.staffCount) || 0),
          tables: Math.max(0, Number(b.tables) || 0),
          chairs: Math.max(0, Number(b.chairs) || 0),
          manager: (b.manager || '').trim(),
          adminPhone: adminFormatted,
          mobilePhone: mobileFormatted,
          phone: phoneFormatted,
        };
      });
      await saveMutation.mutateAsync({
        ...data,
        booths: normalizedBooths,
      });
      setEditingBooths(false);
      setToastMessage('부스 순서 및 현황이 저장되었습니다!');
      setSaveToast(true);
      setTimeout(() => setSaveToast(false), 3000);
    } catch {
      alert('부스 현황 저장에 실패했습니다.');
    }
  };

  // 4. 행사 식순 개별 편집 핸들러
  const handleStartEditSchedule = useCallback((item: ScheduleItem) => {
    setEditingScheduleId(item.id);
    setEditScheduleData(safeClone(item));
  }, []);

  const handleCancelEditSchedule = useCallback(() => {
    setEditingScheduleId(null);
    setEditScheduleData(null);
  }, []);

  const handleSaveSchedule = useCallback(async () => {
    if (!editScheduleData || editingScheduleId === null) return;
    try {
      const currentSchedule = (data?.schedule || YANGJAE_FALLBACK_DATA.schedule || []) as ScheduleItem[];
      let calculatedDuration = editScheduleData.duration;
      const timeMatch = (editScheduleData.time || '').match(/(\d{1,2}):(\d{2})\s*~\s*(\d{1,2}):(\d{2})/);
      if (timeMatch) {
        const startMin = parseInt(timeMatch[1], 10) * 60 + parseInt(timeMatch[2], 10);
        const endMin = parseInt(timeMatch[3], 10) * 60 + parseInt(timeMatch[4], 10);
        const diffMin = endMin - startMin;
        if (diffMin > 0) {
          calculatedDuration = `${diffMin}분`;
        }
      }

      const updatedItem: ScheduleItem = {
        ...editScheduleData,
        title: (editScheduleData.title || '').trim(),
        note: (editScheduleData.note || '').trim(),
        time: (editScheduleData.time || '').trim(),
        duration: calculatedDuration,
        lead: (editScheduleData.lead || '').trim(),
        status: editScheduleData.status || '예정',
      };
      const exists = currentSchedule.some((s) => s.id === editingScheduleId);
      const nextSchedule = exists
        ? currentSchedule.map((s) => (s.id === editingScheduleId ? updatedItem : s))
        : [...currentSchedule, updatedItem];
      await saveMutation.mutateAsync({
        ...data,
        schedule: nextSchedule,
      });
      setEditingScheduleId(null);
      setEditScheduleData(null);
      setToastMessage(`[${updatedItem.title}] 식순 정보가 저장되었습니다!`);
      setSaveToast(true);
      setTimeout(() => setSaveToast(false), 3000);
    } catch {
      alert('행사 식순 저장에 실패했습니다.');
    }
  }, [data, editScheduleData, editingScheduleId, saveMutation]);

  const handleAddSchedule = useCallback(async () => {
    const currentSchedule = (data?.schedule || YANGJAE_FALLBACK_DATA.schedule || []) as ScheduleItem[];
    const maxId = currentSchedule.reduce((max, s) => Math.max(max, Number(s?.id) || 0), 0);
    const nextId = (Number.isFinite(maxId) ? maxId : 0) + 1;
    const newScheduleItem: ScheduleItem = {
      id: nextId,
      date: '31일(토)',
      phase: '공식행사',
      time: '12:00 ~ 12:30',
      duration: '30분',
      title: '신규 행사 식순',
      lead: '보건행정과',
      status: '예정',
      note: '식순 세부 내용을 입력하세요.',
    };
    if (scheduleSearchQuery) {
      setScheduleSearchQuery('');
    }
    setEditingScheduleId(nextId);
    setEditScheduleData(newScheduleItem);
    const nextSchedule = [...currentSchedule, newScheduleItem];
    try {
      await saveMutation.mutateAsync({
        ...data,
        schedule: nextSchedule,
      });
      setToastMessage('새 행사 식순이 추가되었습니다! 내용을 수정해 주세요.');
      setSaveToast(true);
      setTimeout(() => setSaveToast(false), 3000);
    } catch {
      alert('식순 추가에 실패했습니다.');
    }
  }, [data, saveMutation, scheduleSearchQuery]);

  const handleDeleteSchedule = useCallback(async (id: number) => {
    if (!confirm('해당 행사 식순 항목을 삭제하시겠습니까?')) return;
    const currentSchedule = (data?.schedule || YANGJAE_FALLBACK_DATA.schedule || []) as ScheduleItem[];
    const nextSchedule = currentSchedule.filter((s) => s.id !== id);
    try {
      await saveMutation.mutateAsync({
        ...data,
        schedule: nextSchedule,
      });
      if (editingScheduleId === id) {
        setEditingScheduleId(null);
        setEditScheduleData(null);
      }
      setToastMessage('행사 식순이 삭제되었습니다.');
      setSaveToast(true);
      setTimeout(() => setSaveToast(false), 3000);
    } catch {
      alert('식순 삭제에 실패했습니다.');
    }
  }, [data, editingScheduleId, saveMutation]);

  // 5. 업무분장 (TAB 3) 엑셀 편집 및 관리 핸들러
  const handleStartEditDuties = useCallback(() => {
    setEditDutiesData(safeClone((data?.duties || YANGJAE_FALLBACK_DATA.duties || []) as DutyItem[]));
    setEditingDuties(true);
  }, [data?.duties]);

  const handleCancelEditDuties = useCallback(() => {
    setEditDutiesData(safeClone((data?.duties || YANGJAE_FALLBACK_DATA.duties || []) as DutyItem[]));
    setEditingDuties(false);
  }, [data?.duties]);

  const handleAddDutyStaff = useCallback((dutyId: number | string) => {
    setEditDutiesData((prev) => {
      return prev.map((d) => {
        if (d.id !== dutyId) return d;
        const currentStaff: DutyStaffMember[] = (d.staffMembers && d.staffMembers.length > 0)
          ? [...d.staffMembers]
          : [{
              name: d.manager || '',
              adminPhone: d.adminPhone || '',
              mobilePhone: d.mobilePhone || '',
              role: '',
            }];
        currentStaff.push({
          name: '',
          role: '',
          adminPhone: '',
          mobilePhone: '',
        });
        return {
          ...d,
          staffMembers: currentStaff,
        };
      });
    });
  }, []);

  const handleDeleteDutyStaff = useCallback((dutyId: number | string, staffIndex: number) => {
    setEditDutiesData((prev) => {
      return prev.map((d) => {
        if (d.id !== dutyId) return d;
        const currentStaff: DutyStaffMember[] = (d.staffMembers && d.staffMembers.length > 0)
          ? [...d.staffMembers]
          : [{
              name: d.manager || '',
              adminPhone: d.adminPhone || '',
              mobilePhone: d.mobilePhone || '',
              role: '',
            }];
        if (currentStaff.length <= 1) return d;
        currentStaff.splice(staffIndex, 1);
        const primary = currentStaff[0];
        const combinedManagers = currentStaff.map((s) => s.name).filter(Boolean).join(' / ');
        return {
          ...d,
          staffMembers: currentStaff,
          manager: combinedManagers || d.manager,
          adminPhone: primary?.adminPhone || d.adminPhone,
          mobilePhone: primary?.mobilePhone || d.mobilePhone,
          phone: primary?.adminPhone || primary?.mobilePhone || d.phone,
        };
      });
    });
  }, []);

  const handleUpdateDutyStaff = useCallback((dutyId: number | string, staffIndex: number, field: keyof DutyStaffMember, value: string) => {
    setEditDutiesData((prev) => {
      return prev.map((d) => {
        if (d.id !== dutyId) return d;
        const currentStaff: DutyStaffMember[] = (d.staffMembers && d.staffMembers.length > 0)
          ? d.staffMembers.map((s) => ({ ...s }))
          : [{
              name: d.manager || '',
              adminPhone: d.adminPhone || '',
              mobilePhone: d.mobilePhone || '',
              role: '',
            }];

        while (currentStaff.length <= staffIndex) {
          currentStaff.push({ name: '', adminPhone: '', mobilePhone: '', role: '' });
        }

        let formattedVal = value;
        if ((field === 'adminPhone' || field === 'mobilePhone') && typeof value === 'string') {
          formattedVal = formatAutoHyphen(value);
        }

        currentStaff[staffIndex] = {
          ...currentStaff[staffIndex],
          [field]: formattedVal,
        };

        const primary = currentStaff[0];
        const combinedManagers = currentStaff.map((s) => s.name).filter(Boolean).join(' / ');

        return {
          ...d,
          staffMembers: currentStaff,
          manager: combinedManagers || d.manager,
          adminPhone: primary?.adminPhone || d.adminPhone,
          mobilePhone: primary?.mobilePhone || d.mobilePhone,
          phone: primary?.adminPhone || primary?.mobilePhone || d.phone,
        };
      });
    });
  }, []);

  const handleSaveDuties = useCallback(async () => {
    try {
      const normalizedDuties: DutyItem[] = editDutiesData.map((d, idx) => {
        let cleanStaff: DutyStaffMember[] = [];
        if (Array.isArray(d.staffMembers) && d.staffMembers.length > 0) {
          cleanStaff = d.staffMembers
            .map((s) => ({
              name: (s.name || '').trim(),
              role: (s.role || '').trim(),
              adminPhone: formatAutoHyphen((s.adminPhone || '').trim()),
              mobilePhone: formatAutoHyphen((s.mobilePhone || '').trim()),
            }))
            .filter((s) => Boolean(s.name || s.adminPhone || s.mobilePhone || s.role));
        }

        if (cleanStaff.length === 0 && d.manager) {
          cleanStaff = [{
            name: d.manager.trim(),
            adminPhone: formatAutoHyphen((d.adminPhone || '').trim()),
            mobilePhone: formatAutoHyphen((d.mobilePhone || '').trim()),
            role: '',
          }];
        }

        const primaryStaff = cleanStaff[0] || { name: d.manager || '', adminPhone: d.adminPhone || '', mobilePhone: d.mobilePhone || '' };
        const combinedManagerNames = cleanStaff.map((s) => s.name).filter(Boolean).join(' / ') || (d.manager || '').trim();
        const adminFormatted = primaryStaff.adminPhone || formatAutoHyphen((d.adminPhone || '').trim());
        const mobileFormatted = primaryStaff.mobilePhone || formatAutoHyphen((d.mobilePhone || '').trim());
        const phoneFormatted = formatAutoHyphen(adminFormatted || mobileFormatted || (d.phone || '').trim());

        let cleanTasks: string[] = [];
        if (Array.isArray(d.tasks)) {
          cleanTasks = d.tasks.map((t) => (typeof t === 'string' ? t.trim() : '')).filter(Boolean);
        } else if (typeof d.tasks === 'string') {
          cleanTasks = (d.tasks as string)
            .split('\n')
            .map((t) => t.trim().replace(/^[-•*]\s*/, ''))
            .filter(Boolean);
        }

        return {
          ...d,
          id: idx + 1,
          category: (d.category || '운영').trim(),
          deptOrOrg: (d.deptOrOrg || '').trim(),
          role: (d.role || '').trim(),
          manager: combinedManagerNames,
          adminPhone: adminFormatted,
          mobilePhone: mobileFormatted,
          phone: phoneFormatted,
          tasks: cleanTasks,
          staffMembers: cleanStaff,
        };
      });

      await saveMutation.mutateAsync({
        ...data,
        duties: normalizedDuties,
      });
      setEditingDuties(false);
      setToastMessage('업무분장 데이터가 저장되었습니다!');
      setSaveToast(true);
      setTimeout(() => setSaveToast(false), 3000);
    } catch {
      alert('업무분장 저장에 실패했습니다.');
    }
  }, [data, editDutiesData, saveMutation]);

  const handleAddDutyRow = useCallback(() => {
    const list = editingDuties ? editDutiesData : ((data?.duties || YANGJAE_FALLBACK_DATA.duties || []) as DutyItem[]);
    const maxId = list.reduce((max, d) => Math.max(max, Number(d?.id) || 0), 0);
    const nextId = (Number.isFinite(maxId) ? maxId : 0) + 1;
    const newDuty: DutyItem = {
      id: nextId,
      category: '운영',
      deptOrOrg: '',
      role: '',
      manager: '',
      phone: '',
      adminPhone: '',
      mobilePhone: '',
      tasks: ['과업 세부 내용을 입력하세요.'],
      staffMembers: [{ name: '', role: '', adminPhone: '', mobilePhone: '' }],
    };
    setEditDutiesData([...list, newDuty]);
    setEditingDuties(true);
  }, [data?.duties, editDutiesData, editingDuties]);

  const handleDeleteDutyRow = useCallback((dutyId: number | string) => {
    if (!confirm('해당 업무분장 행을 삭제하시겠습니까?')) return;
    setEditDutiesData((prev) => prev.filter((d) => d.id !== dutyId));
  }, []);

  const handleMoveDutyUp = useCallback((dutyId: number | string) => {
    setEditDutiesData((prev) => {
      const list = [...prev];
      const idx = list.findIndex((d) => d.id === dutyId);
      if (idx <= 0) return prev;
      const temp = list[idx];
      list[idx] = list[idx - 1];
      list[idx - 1] = temp;
      return list;
    });
  }, []);

  const handleMoveDutyDown = useCallback((dutyId: number | string) => {
    setEditDutiesData((prev) => {
      const list = [...prev];
      const idx = list.findIndex((d) => d.id === dutyId);
      if (idx === -1 || idx >= list.length - 1) return prev;
      const temp = list[idx];
      list[idx] = list[idx + 1];
      list[idx + 1] = temp;
      return list;
    });
  }, []);

  const updateDutyField = useCallback((dutyId: number | string, field: keyof DutyItem, value: any) => {
    setEditDutiesData((prev) => {
      return prev.map((d) => {
        if (d.id !== dutyId) return d;
        let formattedVal = value;
        if ((field === 'adminPhone' || field === 'mobilePhone' || field === 'phone') && typeof value === 'string') {
          formattedVal = formatAutoHyphen(value);
        }
        const updated = { ...d, [field]: formattedVal };
        if (field === 'adminPhone' && !d.mobilePhone) {
          updated.phone = String(formattedVal);
        } else if (field === 'mobilePhone' && !d.adminPhone) {
          updated.phone = String(formattedVal);
        }
        return updated;
      });
    });
  }, []);

  const handleSyncDesktopExcel = useCallback(async () => {
    setIsSyncingExcel(true);
    try {
      const res = await fetch('/api/festival/yangjae/sync-excel', { method: 'POST' });
      const json = await res.json();
      if (json.success) {
        setToastMessage('바탕화면 단일 마스터 엑셀 동기화 완료!');
        setSaveToast(true);
        setTimeout(() => setSaveToast(false), 3500);
      } else {
        const errMsg = json.error || '오류 발생';
        setToastMessage(`동기화 실패: ${errMsg}`);
        setSaveToast(true);
        setTimeout(() => setSaveToast(false), 5000);
      }
    } catch (err: any) {
      const msg = err?.message || String(err);
      setToastMessage(`동기화 요청 오류: ${msg}`);
      setSaveToast(true);
      setTimeout(() => setSaveToast(false), 4000);
    } finally {
      setIsSyncingExcel(false);
    }
  }, []);

  const handleExportDutiesCsv = useCallback(() => {
    const list = ((data?.duties || YANGJAE_FALLBACK_DATA.duties || []) as DutyItem[]);
    let csvContent = '\uFEFF구분,부서·기관명,담당역할,담당자,행정전화,휴대전화,배정과업\n';
    list.forEach((d) => {
      const tasksStr = (d.tasks || []).join('; ');
      const row = [
        `"${(d.category || '').replace(/"/g, '""')}"`,
        `"${(d.deptOrOrg || '').replace(/"/g, '""')}"`,
        `"${(d.role || '').replace(/"/g, '""')}"`,
        `"${(d.manager || '').replace(/"/g, '""')}"`,
        `"${(d.adminPhone || d.phone || '').replace(/"/g, '""')}"`,
        `"${(d.mobilePhone || '').replace(/"/g, '""')}"`,
        `"${tasksStr.replace(/"/g, '""')}"`,
      ];
      csvContent += row.join(',') + '\n';
    });
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `2026_양재천페스티벌_업무분장_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [data?.duties]);

  const handleCopySummary = useCallback(async () => {
    const targetUrl = typeof window !== 'undefined' && !window.location.hostname.includes('localhost') && !window.location.hostname.includes('127.0.0.1')
      ? `${window.location.origin}/festival/yangjae`
      : PUBLIC_SHARE_URL;

    const title = data?.meta?.title || '제8회 강남구청장배 걷기 대회 연계 2026 양재천 걷자! 건강 페스티벌';

    const copiedSuccess = await copyToClipboardSafe(targetUrl);

    let sharedSuccess = false;
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        const shareData = {
          title: title,
          text: targetUrl,
        };
        if (!navigator.canShare || navigator.canShare(shareData)) {
          await navigator.share(shareData);
          sharedSuccess = true;
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') {
          sharedSuccess = true;
        }
      }
    }

    if (copiedSuccess) {
      setCopied(true);
      setTimeout(() => setCopied(false), 3500);
    } else if (!sharedSuccess && typeof window !== 'undefined' && typeof window.prompt === 'function') {
      window.prompt('아래 링크 주소를 복사(Ctrl+C 또는 길게 터치)하세요:', targetUrl);
    }
  }, [PUBLIC_SHARE_URL, data?.meta?.title]);

  return (
    <div className="w-full flex justify-center selection:bg-slate-800 selection:text-white pb-16 relative">
      
      {/* Floating Copy Success Toast Modal */}
      {copied && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-xl flex items-center gap-2.5 border border-slate-800">
          <Check className="w-4 h-4 text-emerald-400 stroke-[2.5] shrink-0" />
          <div>
            <div className="font-bold text-xs sm:text-sm">페스티벌 대시보드 링크가 복사되었습니다!</div>
            <div className="text-[11px] text-slate-300">원하는 곳(카카오톡·문자 등)에 바로 붙여넣기(Ctrl+V) 하세요.</div>
          </div>
        </div>
      )}

      {/* Floating Save Success Toast Modal */}
      {saveToast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-xl flex items-center gap-2.5 border border-slate-800">
          <Check className="w-4 h-4 text-emerald-400 stroke-[2.5] shrink-0" />
          <div>
            <div className="font-bold text-xs sm:text-sm">{toastMessage}</div>
            <div className="text-[11px] text-slate-300">로컬 DB에 성공적으로 반영되었습니다.</div>
          </div>
        </div>
      )}

      <div 
        className={`yangjae-dashboard-container w-full sm:max-w-md bg-white sm:rounded-xl sm:border sm:border-slate-200/80 sm:shadow-2xs overflow-hidden flex flex-col min-h-screen text-slate-900 font-sans transition-all duration-200 ${
          isLargeFont ? 'is-large-font text-[16px]' : ''
        }`}
      >
        <style>{LARGE_FONT_STYLES}</style>
        
        {/* Top Sticky Header */}
        <div className="sticky top-0 z-30 bg-slate-900 text-white px-3 sm:px-4 py-2.5 sm:py-3 flex items-center justify-between gap-1.5 sm:gap-2 border-b border-slate-800">
          <div className="min-w-0 flex-1">
            <div className={`${isLargeFont ? 'text-lg' : 'text-sm'} font-bold tracking-tight truncate`}>2026 양재천 건강 페스티벌</div>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
            {/* Large Font Toggle Button */}
            <button
              type="button"
              onClick={() => setIsLargeFont(!isLargeFont)}
              className={`px-2 sm:px-2.5 py-1 rounded-md text-[11px] sm:text-xs font-semibold border transition-colors cursor-pointer flex items-center gap-1 whitespace-nowrap ${
                isLargeFont 
                  ? 'bg-white text-slate-900 border-white shadow-2xs' 
                  : 'bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700'
              }`}
              title="글자 크기 확대/보통 전환"
            >
              <span className="font-bold text-[12px] sm:text-[13px]">{isLargeFont ? '가-' : '가+'}</span>
              <span>{isLargeFont ? '보통' : '큰글씨'}</span>
            </button>

            {/* Kakao Share / Copy Button */}
            <button
              type="button"
              onClick={handleCopySummary}
              className="px-2 sm:px-2.5 py-1 text-[11px] sm:text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-md flex items-center gap-1 sm:gap-1.5 shadow-2xs cursor-pointer transition-colors whitespace-nowrap"
              title="대시보드 링크 공유"
            >
              <Share2 className="w-3.5 h-3.5 shrink-0" />
              <span>공유</span>
            </button>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 p-3.5 space-y-4 bg-slate-50/60">
          
          {/* Section 1: Official Event Overview */}
          <div className="bg-white border border-slate-200/80 rounded-xl p-4 shadow-2xs">
            <div className="flex items-center justify-between pb-2.5 mb-3 border-b border-slate-100 gap-2">
              <div className="flex items-center gap-2">
                <span className={`inline-block ${isLargeFont ? 'w-4 h-4 border-2' : 'w-3.5 h-3.5 border-[1.5px]'} border-slate-900 rounded-[2px] shrink-0`} />
                <span className={`${isLargeFont ? 'text-lg' : 'text-sm sm:text-base'} font-bold text-slate-900 tracking-tight`}>
                  행사 개요
                </span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {editingOverview ? (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={handleSaveOverview}
                      disabled={saveMutation.isPending}
                      className="px-2 py-0.5 text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white rounded-md flex items-center gap-1 cursor-pointer"
                      title="행사 개요 저장"
                    >
                      {saveMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                      <span>저장</span>
                    </button>
                    <button
                      onClick={handleCancelEditOverview}
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
                    onClick={handleStartEditOverview}
                    className="p-1 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-md cursor-pointer transition-colors"
                    title="행사 개요 수정"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                ) : null}
                <span className={`font-mono tabular-nums font-bold ${isLargeFont ? 'text-sm px-2.5 py-0.5' : 'text-xs px-2 py-0.5'} bg-slate-900 text-white rounded-md border border-slate-800 shadow-2xs tracking-wide shrink-0`}>
                  D-{daysLeft}
                </span>
              </div>
            </div>

            {/* Key-Value Details Grid */}
            <div className="space-y-2">
              {/* 행사명 */}
              <div className={`grid ${isLargeFont ? 'grid-cols-[minmax(76px,max-content)_12px_1fr] text-sm gap-1.5' : 'grid-cols-[minmax(62px,max-content)_10px_1fr] text-xs gap-1'} items-baseline`}>
                <span className="font-semibold text-slate-500 tracking-wide whitespace-nowrap shrink-0">• 행사명</span>
                <span className="font-medium text-slate-300 text-center shrink-0">:</span>
                {editingOverview ? (
                  <input
                    type="text"
                    value={editOverviewData?.title || ''}
                    onChange={(e) => setEditOverviewData(prev => ({
                      ...(prev || data?.meta || YANGJAE_FALLBACK_DATA.meta),
                      title: e.target.value
                    }))}
                    className="w-full px-2 py-1 border border-slate-300 rounded-md bg-slate-50/70 font-bold text-slate-900"
                  />
                ) : (
                  <span className="font-bold text-slate-900 leading-snug break-keep min-w-0">{data?.meta?.title || '제8회 강남구청장배 걷기 대회 연계 2026 양재천 걷자! 건강 페스티벌'}</span>
                )}
              </div>

              {/* 일시 */}
              <div className={`grid ${isLargeFont ? 'grid-cols-[minmax(76px,max-content)_12px_1fr] text-sm gap-1.5' : 'grid-cols-[minmax(62px,max-content)_10px_1fr] text-xs gap-1'} items-baseline`}>
                <span className="font-semibold text-slate-500 tracking-wide whitespace-nowrap shrink-0">• 일&nbsp;&nbsp;&nbsp;&nbsp;시</span>
                <span className="font-medium text-slate-300 text-center shrink-0">:</span>
                {editingOverview ? (
                  <div className="flex gap-1">
                    <input
                      type="text"
                      value={editOverviewData?.eventDate || ''}
                      onChange={(e) => setEditOverviewData(prev => ({
                        ...(prev || data?.meta || YANGJAE_FALLBACK_DATA.meta),
                        eventDate: e.target.value
                      }))}
                      className="w-1/2 px-2 py-1 border border-slate-300 rounded-md bg-slate-50/70 font-semibold text-slate-900"
                      placeholder="2026-10-31(토)"
                    />
                    <input
                      type="text"
                      value={editOverviewData?.eventTime || ''}
                      onChange={(e) => setEditOverviewData(prev => ({
                        ...(prev || data?.meta || YANGJAE_FALLBACK_DATA.meta),
                        eventTime: e.target.value
                      }))}
                      className="w-1/2 px-2 py-1 border border-slate-300 rounded-md bg-slate-50/70 font-semibold text-slate-900"
                      placeholder="09:00 ~ 14:00"
                    />
                  </div>
                ) : (
                  <span className="font-mono tabular-nums font-semibold text-slate-800 break-keep min-w-0">{data?.meta?.eventDate || ''} ({data?.meta?.eventTime || ''})</span>
                )}
              </div>

              {/* 장소 */}
              <div className={`grid ${isLargeFont ? 'grid-cols-[minmax(76px,max-content)_12px_1fr] text-sm gap-1.5' : 'grid-cols-[minmax(62px,max-content)_10px_1fr] text-xs gap-1'} items-baseline`}>
                <span className="font-semibold text-slate-500 tracking-wide whitespace-nowrap shrink-0">• 장&nbsp;&nbsp;&nbsp;&nbsp;소</span>
                <span className="font-medium text-slate-300 text-center shrink-0">:</span>
                {editingOverview ? (
                  <input
                    type="text"
                    value={editOverviewData?.location || ''}
                    onChange={(e) => setEditOverviewData(prev => ({
                      ...(prev || data?.meta || YANGJAE_FALLBACK_DATA.meta),
                      location: e.target.value
                    }))}
                    className="w-full px-2 py-1 border border-slate-300 rounded-md bg-slate-50/70 font-semibold text-slate-900"
                  />
                ) : (
                  <span className="font-semibold text-slate-800 leading-snug break-keep min-w-0">{data?.meta?.location || ''}</span>
                )}
              </div>

              {/* 코스 */}
              <div className={`grid ${isLargeFont ? 'grid-cols-[minmax(76px,max-content)_12px_1fr] text-sm gap-1.5' : 'grid-cols-[minmax(62px,max-content)_10px_1fr] text-xs gap-1'} items-baseline`}>
                <span className="font-semibold text-slate-500 tracking-wide whitespace-nowrap shrink-0">• 코&nbsp;&nbsp;&nbsp;&nbsp;스</span>
                <span className="font-medium text-slate-300 text-center shrink-0">:</span>
                {editingOverview ? (
                  <input
                    type="text"
                    value={editOverviewData?.course || ''}
                    onChange={(e) => setEditOverviewData(prev => ({
                      ...(prev || data?.meta || YANGJAE_FALLBACK_DATA.meta),
                      course: e.target.value
                    }))}
                    className="w-full px-2 py-1 border border-slate-300 rounded-md bg-slate-50/70 font-semibold text-slate-900"
                  />
                ) : (
                  <span className="font-semibold text-slate-800 break-keep min-w-0">{data?.meta?.course || ''}</span>
                )}
              </div>

              {/* 참여 대상 */}
              <div className={`grid ${isLargeFont ? 'grid-cols-[minmax(76px,max-content)_12px_1fr] text-sm gap-1.5' : 'grid-cols-[minmax(62px,max-content)_10px_1fr] text-xs gap-1'} items-baseline`}>
                <span className="font-semibold text-slate-500 tracking-wide whitespace-nowrap shrink-0">• 참&nbsp;&nbsp;&nbsp;&nbsp;여</span>
                <span className="font-medium text-slate-300 text-center shrink-0">:</span>
                {editingOverview ? (
                  <input
                    type="text"
                    value={editOverviewData?.targetAudience || ''}
                    onChange={(e) => setEditOverviewData(prev => ({
                      ...(prev || data?.meta || YANGJAE_FALLBACK_DATA.meta),
                      targetAudience: e.target.value
                    }))}
                    className="w-full px-2 py-1 border border-slate-300 rounded-md bg-slate-50/70 font-semibold text-slate-900"
                  />
                ) : (
                  <span className="font-semibold text-slate-800 break-keep min-w-0">{data?.meta?.targetAudience || ''}</span>
                )}
              </div>

              {/* 프로그램 구성 */}
              <div className={`grid ${isLargeFont ? 'grid-cols-[minmax(76px,max-content)_12px_1fr] text-sm gap-1.5' : 'grid-cols-[minmax(62px,max-content)_10px_1fr] text-xs gap-1'} items-baseline`}>
                <span className="font-semibold text-slate-500 tracking-wide whitespace-nowrap shrink-0">• 구&nbsp;&nbsp;&nbsp;&nbsp;성</span>
                <span className="font-medium text-slate-300 text-center shrink-0">:</span>
                <div className="space-y-1 min-w-0">
                  {(editingOverview ? (editOverviewData?.programStructure || []) : (data?.meta?.programStructure || [])).map((item: string, pIdx: number) => (
                    <div key={`prog-${pIdx}-${item.slice(0, 15)}`} className="flex items-start">
                      {editingOverview ? (
                        <div className="flex items-center gap-1 flex-1">
                          <input
                            type="text"
                            value={item}
                            onChange={(e) => {
                              const nextProg = [...(editOverviewData?.programStructure || [])];
                              nextProg[pIdx] = e.target.value;
                              setEditOverviewData(prev => ({
                                ...(prev || data?.meta || YANGJAE_FALLBACK_DATA.meta),
                                programStructure: nextProg
                              }));
                            }}
                            className="w-full px-2 py-0.5 border border-slate-300 rounded-md bg-white text-xs font-semibold text-slate-800"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const nextProg = (editOverviewData?.programStructure || []).filter((_: string, idx: number) => idx !== pIdx);
                              setEditOverviewData(prev => ({
                                ...(prev || data?.meta || YANGJAE_FALLBACK_DATA.meta),
                                programStructure: nextProg
                              }));
                            }}
                            className="p-0.5 text-red-500 hover:bg-red-50 rounded cursor-pointer shrink-0"
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
                  ))}
                  {editingOverview && (
                    <button
                      type="button"
                      onClick={() => {
                        const nextProg = [...(editOverviewData?.programStructure || [])];
                        nextProg.push('신규 체험·홍보 프로그램');
                        setEditOverviewData(prev => ({
                          ...(prev || data?.meta || YANGJAE_FALLBACK_DATA.meta),
                          programStructure: nextProg
                        }));
                      }}
                      className="mt-1 px-2 py-0.5 text-[11px] font-semibold bg-slate-100 text-slate-800 rounded-md border border-slate-200/80 hover:bg-slate-200 flex items-center gap-1 cursor-pointer w-fit"
                    >
                      <Plus className="w-3 h-3" />
                      <span>구성 항목 추가</span>
                    </button>
                  )}
                </div>
              </div>

              {/* 비고 (직원 복무) */}
              <div className={`grid ${isLargeFont ? 'grid-cols-[minmax(76px,max-content)_12px_1fr] text-sm gap-1.5' : 'grid-cols-[minmax(62px,max-content)_10px_1fr] text-xs gap-1'} items-baseline pt-0.5`}>
                <span className="font-extrabold text-blue-600 tracking-wide whitespace-nowrap shrink-0">• 비&nbsp;&nbsp;&nbsp;&nbsp;고</span>
                <span className="font-bold text-blue-400 text-center shrink-0">:</span>
                {editingOverview ? (
                  <input
                    type="text"
                    value={editOverviewData?.staffNote ?? data?.meta?.staffNote ?? '행사 참여 직원 대체휴무 시행 예정'}
                    onChange={(e) => setEditOverviewData(prev => ({
                      ...(prev || data?.meta || YANGJAE_FALLBACK_DATA.meta),
                      staffNote: e.target.value
                    }))}
                    className="w-full px-2 py-1 border border-blue-400 rounded-md bg-blue-50/50 font-bold text-blue-900"
                    placeholder="행사 참여 직원 대체휴무 시행 예정"
                  />
                ) : (
                  <span className="font-bold text-blue-600 leading-snug break-keep">
                    {data?.meta?.staffNote || '행사 참여 직원 대체휴무 시행 예정'}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Section 2: Tab Navigation (Minimalist Segmented Control - 4 Cols) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 bg-slate-100/90 p-1 rounded-xl border border-slate-200/80">
            {YANGJAE_REPORT_TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleSelectTab(tab.id)}
                className={`${isLargeFont ? 'py-3 text-base font-black' : 'py-2.5 text-xs font-extrabold'} rounded-lg transition-all cursor-pointer text-center border ${
                  selectedTab === tab.id
                    ? 'bg-white text-slate-900 shadow-2xs border-slate-200/80 font-extrabold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/60 border-transparent font-bold'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* TAB 1: 추진과제별 현황 */}
          {visitedFestivalTabs.milestones && (
            <div className={selectedTab === 'milestones' ? 'block space-y-3.5' : 'hidden'}>
              <MilestonesTab
                milestones={data?.milestones || []}
                detailDrafts={detailDrafts}
                editingMilestoneId={editingMilestoneId}
                editMilestoneData={editMilestoneData}
                expandedTaskIds={expandedTaskIds}
                isLocalAdmin={isLocalAdmin}
                isLargeFont={isLargeFont}
                isPendingSave={saveMutation.isPending}
                allExpanded={isAllExpanded}
                onToggleExpand={toggleTaskExpand}
                onToggleAllExpand={toggleAllExpand}
                onStartEditMilestone={handleStartEditMilestone}
                onCancelEditMilestone={handleCancelEditMilestone}
                onSaveMilestone={handleSaveMilestone}
                onAddMilestone={handleAddMilestone}
                onDeleteMilestone={handleDeleteMilestone}
                onUpdateMilestoneField={(field, val) => {
                  setEditMilestoneData((prev) => (prev ? { ...prev, [field]: val } : null));
                }}
                onUpdateDetailRow={handleUpdateDetailRow}
                onMoveUpDetailRow={handleMoveUpDetailRow}
                onMoveDownDetailRow={handleMoveDownDetailRow}
                onDeleteDetailRow={handleDeleteDetailRow}
                onOpenTransferModal={handleOpenTransferModal}
                onAddDetailRow={() => {
                  if (!editMilestoneData) return;
                  const newDetailStr = formatDetail({ date: '', status: 'todo', attendees: '', text: '신규 세부 과업 내용' });
                  const newDraft: DetailDraft = {
                    uid: `m-${editMilestoneData.id}-detail-new-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                    raw: newDetailStr,
                  };
                  const next = [...detailDrafts, newDraft];
                  setDetailDrafts(next);
                  setEditMilestoneData((prev) => (prev ? { ...prev, details: next.map((d) => d.raw) } : null));
                }}
              />
            </div>
          )}

          {/* TAB 2: 부스 현황 */}
          {visitedFestivalTabs.booths && (
            <div className={selectedTab === 'booths' ? 'block space-y-3.5' : 'hidden'}>
              <BoothsTab
                booths={data?.booths || []}
                editingBooths={editingBooths}
                editBoothsData={editBoothsData}
                editingBoothId={editingBoothId}
                editSingleBoothData={editSingleBoothData}
                selectedCategory={selectedCategory}
                showPrivateMobile={showPrivateMobile}
                isLocalAdmin={isLocalAdmin}
                isLargeFont={isLargeFont}
                isPendingSave={saveMutation.isPending}
                boothMetrics={boothMetrics}
                onSelectCategory={handleSelectCategory}
                onSwitchToggle={handleSwitchToggle}
                onStartEditBooths={handleStartEditBooths}
                onCancelEditBooths={handleCancelEditBooths}
                onSaveBooths={handleSaveBooths}
                onStartEditSingleBooth={handleStartEditSingleBooth}
                onCancelEditSingleBooth={handleCancelEditSingleBooth}
                onSaveSingleBooth={handleSaveSingleBooth}
                onUpdateBoothField={(id, field, value) => {
                  const formattedVal = (field === 'adminPhone' || field === 'mobilePhone' || field === 'phone') && typeof value === 'string'
                    ? formatAutoHyphen(value)
                    : value;
                  setEditBoothsData((prev) => {
                    const next = [...prev];
                    const targetIdx = next.findIndex((b) => b.id === id);
                    if (targetIdx !== -1) {
                      const updated = { ...next[targetIdx], [field]: formattedVal };
                      if (field === 'adminPhone' && !next[targetIdx].mobilePhone) {
                        updated.phone = String(formattedVal);
                      } else if (field === 'mobilePhone' && !next[targetIdx].adminPhone) {
                        updated.phone = String(formattedVal);
                      }
                      next[targetIdx] = updated;
                    }
                    return next;
                  });
                }}
                onUpdateSingleBoothField={(field, value) => {
                  const formattedVal = (field === 'adminPhone' || field === 'mobilePhone' || field === 'phone') && typeof value === 'string'
                    ? formatAutoHyphen(value)
                    : value;
                  setEditSingleBoothData((prev) => {
                    if (!prev) return prev;
                    const updated = { ...prev, [field]: formattedVal };
                    if (field === 'adminPhone' && !prev.mobilePhone) {
                      updated.phone = String(formattedVal);
                    } else if (field === 'mobilePhone' && !prev.adminPhone) {
                      updated.phone = String(formattedVal);
                    }
                    return updated;
                  });
                }}
                onMoveBoothUp={handleMoveBoothUp}
                onMoveBoothDown={handleMoveBoothDown}
                onAddBooth={() => {
                  const maxId = (editBoothsData || []).reduce((max, b) => Math.max(max, Number(b?.id) || 0), 0);
                  const nextId = (Number.isFinite(maxId) ? maxId : 0) + 1;
                  setEditBoothsData([
                    ...editBoothsData,
                    {
                      id: nextId,
                      category: '보건소 부서',
                      name: '신규 부스명',
                      scale: '1동',
                      program: '체험 프로그램 내용',
                      status: '확정',
                      staffCount: 2,
                      tables: 2,
                      chairs: 4,
                      manager: '',
                      phone: '',
                    }
                  ]);
                }}
                onDeleteBooth={(id) => {
                  setEditBoothsData((prev) => prev.filter((b) => b.id !== id));
                }}
              />
            </div>
          )}

          {/* TAB 4: 행사식순 */}
          {visitedFestivalTabs.schedule && (
            <div className={selectedTab === 'schedule' ? 'block space-y-3' : 'hidden'}>
              <ScheduleTab
                schedule={activeSchedule}
                editingScheduleId={editingScheduleId}
                editScheduleData={editScheduleData}
                scheduleSearchQuery={scheduleSearchQuery}
                selectedPhase="전체"
                isLocalAdmin={isLocalAdmin}
                isLargeFont={isLargeFont}
                isPendingSave={saveMutation.isPending}
                onSearchChange={setScheduleSearchQuery}
                onSelectPhase={() => {}}
                onStartEditSchedule={handleStartEditSchedule}
                onCancelEditSchedule={handleCancelEditSchedule}
                onSaveSchedule={handleSaveSchedule}
                onAddSchedule={handleAddSchedule}
                onDeleteSchedule={handleDeleteSchedule}
                onUpdateScheduleField={(field, val) => {
                  setEditScheduleData((prev) => prev ? { ...prev, [field]: val } : null);
                }}
              />
            </div>
          )}

          {/* TAB 3: 업무분장 */}
          {visitedFestivalTabs.duties && (
            <div className={selectedTab === 'duties' ? 'block space-y-3.5' : 'hidden'}>
              <DutiesTab
                duties={activeDuties}
                editingDuties={editingDuties}
                editDutiesData={editDutiesData}
                dutySearchQuery={dutySearchQuery}
                selectedDutyCategory={selectedDutyCategory}
                isDutyPillsWrapped={isDutyPillsWrapped}
                showPrivateMobile={showPrivateMobile}
                isLocalAdmin={isLocalAdmin}
                isLargeFont={isLargeFont}
                isSyncingExcel={isSyncingExcel}
                isPendingSave={saveMutation.isPending}
                dutyPillsRef={dutyPillsRef}
                onDutySearchChange={setDutySearchQuery}
                onSelectDutyCategory={setSelectedDutyCategory}
                onTogglePillsWrap={toggleDutyPillsWrap}
                onScrollPillsLeft={handleScrollDutyPillsLeft}
                onScrollPillsRight={handleScrollDutyPillsRight}
                onPillsWheel={handleDutyPillsWheel}
                onSwitchToggle={handleSwitchToggle}
                onSyncDesktopExcel={handleSyncDesktopExcel}
                onExportCsv={handleExportDutiesCsv}
                onStartEditDuties={handleStartEditDuties}
                onCancelEditDuties={handleCancelEditDuties}
                onSaveDuties={handleSaveDuties}
                onAddDutyRow={handleAddDutyRow}
                onDeleteDutyRow={handleDeleteDutyRow}
                onMoveDutyUp={handleMoveDutyUp}
                onMoveDutyDown={handleMoveDutyDown}
                onUpdateDutyField={updateDutyField}
                onAddDutyStaff={handleAddDutyStaff}
                onDeleteDutyStaff={handleDeleteDutyStaff}
                onUpdateDutyStaff={handleUpdateDutyStaff}
              />
            </div>
          )}
        </div>
      </div>

      {/* Sub-Task Category Transfer Modal */}
      <SubTaskTransferModal
        isOpen={Boolean(transferTarget)}
        transferTarget={transferTarget}
        currentMilestones={data?.milestones || []}
        selectedTargetMilestoneId={selectedTargetMilestoneId}
        isTransferring={isTransferring}
        onSelectTarget={setSelectedTargetMilestoneId}
        onExecute={handleExecuteTransfer}
        onClose={handleCloseTransferModal}
      />

      {/* Emergency Contact PIN Verification Modal */}
      <SecurityPinModal
        isOpen={showPinModal}
        pinInput={pinInput}
        pinError={pinError}
        onPinChange={(val) => {
          setPinInput(val);
          setPinError(null);
        }}
        onSubmit={handlePinSubmit}
        onClose={() => {
          setShowPinModal(false);
          setPinInput('');
          setPinError(null);
        }}
      />
    </div>
  );
}

export function YangjaeFestivalSkeleton() {
  return (
    <div className="w-full flex justify-center pb-16">
      <div className="w-full max-w-md bg-white sm:rounded-xl sm:border sm:border-slate-200/80 sm:shadow-2xs overflow-hidden flex flex-col min-h-screen animate-pulse">
        {/* Top Header Skeleton */}
        <div className="bg-slate-900 px-3 sm:px-4 py-2.5 sm:py-3 flex items-center justify-between gap-1.5 sm:gap-2 border-b border-slate-800">
          <div className="min-w-0 flex-1">
            <div className="h-5 w-44 bg-slate-700 rounded" />
          </div>
          <div className="flex items-center gap-1 sm:gap-1.5">
            <div className="h-7 w-14 sm:w-16 bg-slate-800 rounded-lg" />
            <div className="h-7 w-12 sm:w-14 bg-slate-800 rounded-lg" />
          </div>
        </div>
        {/* Content Skeleton */}
        <div className="flex-1 p-4 space-y-4 bg-slate-50/40">
          <div className="bg-white border border-slate-200/80 rounded-xl p-4 space-y-3 shadow-2xs">
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
              <div className="h-5 w-32 bg-slate-200 rounded" />
              <div className="h-6 w-14 bg-slate-200 rounded-md" />
            </div>
            <div className="space-y-2">
              <div className="h-4 bg-slate-100 rounded w-full" />
              <div className="h-4 bg-slate-100 rounded w-5/6" />
              <div className="h-4 bg-slate-100 rounded w-4/6" />
            </div>
          </div>
          <div className="grid grid-cols-4 gap-1 bg-slate-100/90 p-1 rounded-xl border border-slate-200/80">
            <div className="h-8 bg-white rounded-lg shadow-2xs" />
            <div className="h-8 bg-slate-200/50 rounded-lg" />
            <div className="h-8 bg-slate-200/50 rounded-lg" />
            <div className="h-8 bg-slate-200/50 rounded-lg" />
          </div>
          <div className="space-y-3">
            <div className="h-28 bg-white border border-slate-200/80 rounded-xl p-3 shadow-2xs" />
            <div className="h-28 bg-white border border-slate-200/80 rounded-xl p-3 shadow-2xs" />
          </div>
        </div>
      </div>
    </div>
  );
}

YangjaeFestivalDashboardComponent.displayName = 'YangjaeFestivalDashboard';
export const YangjaeFestivalDashboard = React.memo(YangjaeFestivalDashboardComponent);
export default YangjaeFestivalDashboard;
