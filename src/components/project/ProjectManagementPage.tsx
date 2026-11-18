'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { useProjects } from '@/hooks/useProjects';
import { useTasks } from '@/hooks/useTasks';
import { Project, ChecklistItem, Task } from '@/types';
import dynamic from 'next/dynamic';
import { 
  FolderGit2, Plus, Trash2, CheckCircle2, Circle, Edit2, 
  Calendar, ClipboardList, AlertCircle, Sparkles,
  Target, MapPin, BookOpen,
  CreditCard, UserCheck, BarChart2, Clock
} from 'lucide-react';

function WeeklySchedulerSkeleton() {
  return (
    <div className="w-full h-full min-h-[600px] glass-panel rounded-[2rem] p-8 shadow-2xs border border-white/20 animate-pulse flex flex-col gap-6">
      <div className="flex justify-between items-center pb-6 border-b border-slate-200/50">
        <div className="w-48 h-6 bg-slate-200 rounded-lg" />
        <div className="w-36 h-9 bg-slate-200 rounded-xl" />
      </div>
      <div className="grid grid-cols-7 gap-4 flex-grow">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="bg-slate-200/30 rounded-xl" />
        ))}
      </div>
    </div>
  );
}

const WeeklyScheduler = dynamic(() => import('@/components/dashboard/WeeklyScheduler').then(mod => mod.WeeklyScheduler), {
  ssr: false,
  loading: () => <WeeklySchedulerSkeleton />
});

// ============ Memoized Sub-Components ============

const ProjectListItem = React.memo(({
  project,
  isSelected,
  progress,
  onSelect,
  onStartEdit,
  onDelete
}: {
  project: Project;
  isSelected: boolean;
  progress: number;
  onSelect: (id: string) => void;
  onStartEdit: (project: Project) => void;
  onDelete: (id: string, e: React.MouseEvent) => void;
}) => {
  return (
    <div
      onClick={() => onSelect(project.id)}
      className={`p-3.5 rounded-xl border transition-colors duration-150 cursor-pointer flex flex-col gap-2.5 ${
        isSelected 
          ? 'bg-blue-50/40 border-blue-200 shadow-xs' 
          : 'bg-white border-slate-100 hover:border-slate-200 hover:bg-slate-50/30'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span 
            className="w-2.5 h-2.5 rounded-full shrink-0" 
            style={{ backgroundColor: project.color }} 
          />
          <h3 className="font-extrabold text-[13px] text-slate-800 truncate">{project.name}</h3>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onStartEdit(project);
            }}
            className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md transition-colors border-0 bg-transparent cursor-pointer"
          >
            <Edit2 size={13} />
          </button>
          <button
            onClick={(e) => onDelete(project.id, e)}
            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors border-0 bg-transparent cursor-pointer"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {project.description && (
        <p className="text-[11px] font-semibold text-slate-500 line-clamp-2 leading-relaxed">
          {project.description}
        </p>
      )}

      <div className="flex items-center gap-2 mt-0.5">
        <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div 
            className="h-full rounded-full transition-[width] duration-300"
            style={{ width: `${progress}%`, backgroundColor: project.color }}
          />
        </div>
        <span className="text-[10px] font-bold text-slate-500 min-w-[28px] text-right">{progress}%</span>
      </div>
    </div>
  );
});
ProjectListItem.displayName = 'ProjectListItem';

const ChecklistItemRow = React.memo(({
  projectId,
  item,
  onToggle,
  onDelete
}: {
  projectId: string;
  item: ChecklistItem;
  onToggle: (projectId: string, itemId: string) => void;
  onDelete: (projectId: string, itemId: string) => void;
}) => {
  return (
    <div className="flex items-center justify-between p-3 bg-slate-50/60 rounded-xl border border-slate-100/50 hover:bg-slate-50 transition-colors">
      <button
        onClick={() => onToggle(projectId, item.id)}
        className="flex items-start gap-3 flex-1 text-left border-0 bg-transparent p-0 cursor-pointer"
      >
        <span className="shrink-0 mt-0.5">
          {item.completed ? (
            <CheckCircle2 className="text-emerald-500" size={16} />
          ) : (
            <Circle className="text-slate-300 hover:text-slate-400" size={16} />
          )}
        </span>
        <span className={`text-[12px] font-bold leading-relaxed ${
          item.completed ? 'text-slate-400 line-through' : 'text-slate-700'
        }`}>
          {item.text}
        </span>
      </button>

      <button
        onClick={() => onDelete(projectId, item.id)}
        className="p-1 text-slate-400 hover:text-rose-600 rounded-md transition-colors border-0 bg-transparent cursor-pointer shrink-0 ml-2"
      >
        <Trash2 size={13} />
      </button>
    </div>
  );
});
ChecklistItemRow.displayName = 'ChecklistItemRow';

const AssociatedTaskItemRow = React.memo(({
  task,
  onToggleStatus
}: {
  task: Task;
  onToggleStatus: (task: Task) => void;
}) => {
  const statusColors: Record<string, string> = {
    'todo': 'bg-slate-100 text-slate-600 border-slate-200/50',
    'in-progress': 'bg-blue-50 text-blue-600 border-blue-100',
    'done': 'bg-emerald-50 text-emerald-600 border-emerald-100'
  };
  const priorityColors: Record<string, string> = {
    'low': 'bg-slate-100 text-slate-500',
    'medium': 'bg-amber-50 text-amber-600',
    'high': 'bg-rose-50 text-rose-600'
  };
  const statusLabel: Record<string, string> = {
    'todo': '대기',
    'in-progress': '진행중',
    'done': '완료'
  };

  return (
    <div className="p-3 bg-white border border-slate-150 rounded-xl flex items-center justify-between gap-3 shadow-2xs hover:shadow-xs transition-shadow">
      <div className="flex flex-col gap-1 min-w-0">
        <h4 className="font-extrabold text-[12px] text-slate-800 truncate">{task.title}</h4>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${priorityColors[task.priority] || priorityColors.medium}`}>
            우선순위: {task.priority.toUpperCase()}
          </span>
        </div>
      </div>

      <button
        onClick={() => onToggleStatus(task)}
        className={`px-2.5 py-1.5 rounded-lg border text-[10px] font-extrabold transition-colors duration-150 cursor-pointer ${statusColors[task.status] || statusColors.todo}`}
      >
        {statusLabel[task.status] || '대기'}
      </button>
    </div>
  );
});
AssociatedTaskItemRow.displayName = 'AssociatedTaskItemRow';

// ============ Main Page Component ============

export default function ProjectManagementPage() {
  const {
    projects,
    addProject,
    updateProject,
    deleteProject,
    addChecklistItem,
    toggleChecklistItem,
    deleteChecklistItem,
    getProjectProgress
  } = useProjects();

  const { tasks, addTask, updateTask } = useTasks();

  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'scheduler'>('overview');
  const [isAddingProject, setIsAddingProject] = useState(false);
  const [isEditingProject, setIsEditingProject] = useState(false);
  
  // Project form states
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDesc, setNewProjectDesc] = useState('');
  const [newProjectColor, setNewProjectColor] = useState('#3b82f6');
  const [newProjectTarget, setNewProjectTarget] = useState('');
  const [newProjectBudget, setNewProjectBudget] = useState('');
  const [newProjectLocation, setNewProjectLocation] = useState('');
  const [newProjectStaff, setNewProjectStaff] = useState('');
  const [newProjectPerformance, setNewProjectPerformance] = useState('');
  const [newProjectFuturePlans, setNewProjectFuturePlans] = useState('');
  const [newProjectTimeline, setNewProjectTimeline] = useState('');
  
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);

  // New checklist item state
  const [newChecklistText, setNewChecklistText] = useState('');

  // Associated task addition state
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<'low' | 'medium' | 'high'>('medium');

  const selectedProject = useMemo(() => {
    return projects.find(p => p.id === selectedProjectId) || null;
  }, [projects, selectedProjectId]);

  const colorPalette = useMemo(() => [
    '#3b82f6', // Blue
    '#10b981', // Emerald
    '#f59e0b', // Amber
    '#ef4444', // Red
    '#8b5cf6', // Violet
    '#ec4899', // Pink
    '#14b8a6', // Teal
    '#6366f1', // Indigo
  ], []);

  const resetForm = useCallback(() => {
    setNewProjectName('');
    setNewProjectDesc('');
    setNewProjectColor('#3b82f6');
    setNewProjectTarget('');
    setNewProjectBudget('');
    setNewProjectLocation('');
    setNewProjectStaff('');
    setNewProjectPerformance('');
    setNewProjectFuturePlans('');
    setNewProjectTimeline('');
  }, []);

  const handleSelectProject = useCallback((id: string) => {
    setSelectedProjectId(id);
  }, []);

  const startEditProject = useCallback((project: Project) => {
    setEditingProjectId(project.id);
    setNewProjectName(project.name);
    setNewProjectDesc(project.description || '');
    setNewProjectColor(project.color);
    setNewProjectTarget(project.target || '');
    setNewProjectBudget(project.budget || '');
    setNewProjectLocation(project.location || '');
    setNewProjectStaff(project.staff || '');
    setNewProjectPerformance(project.performance || '');
    setNewProjectFuturePlans(project.futurePlans || '');
    setNewProjectTimeline(project.timeline || '');
    setIsEditingProject(true);
  }, []);

  const handleDeleteProject = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('이 사업/프로젝트를 완전히 삭제하시겠습니까? 연관된 모든 체크리스트 및 소속 하위 업무들이 일괄 삭제됩니다.')) {
      deleteProject(id);
      setSelectedProjectId(prev => prev === id ? null : prev);
    }
  }, [deleteProject]);

  const handleCreateProject = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;

    const created = addProject({
      name: newProjectName.trim(),
      description: newProjectDesc.trim(),
      color: newProjectColor,
      target: newProjectTarget.trim(),
      budget: newProjectBudget.trim(),
      location: newProjectLocation.trim(),
      staff: newProjectStaff.trim(),
      performance: newProjectPerformance.trim(),
      futurePlans: newProjectFuturePlans.trim(),
      timeline: newProjectTimeline.trim(),
    });

    resetForm();
    setIsAddingProject(false);
    
    if (created && created.id) {
      setSelectedProjectId(created.id);
    }
  }, [addProject, newProjectName, newProjectDesc, newProjectColor, newProjectTarget, newProjectBudget, newProjectLocation, newProjectStaff, newProjectPerformance, newProjectFuturePlans, newProjectTimeline, resetForm]);

  const handleUpdateProject = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProjectId || !newProjectName.trim()) return;

    updateProject(editingProjectId, {
      name: newProjectName.trim(),
      description: newProjectDesc.trim(),
      color: newProjectColor,
      target: newProjectTarget.trim(),
      budget: newProjectBudget.trim(),
      location: newProjectLocation.trim(),
      staff: newProjectStaff.trim(),
      performance: newProjectPerformance.trim(),
      futurePlans: newProjectFuturePlans.trim(),
      timeline: newProjectTimeline.trim(),
    });

    resetForm();
    setIsEditingProject(false);
    setEditingProjectId(null);
  }, [editingProjectId, newProjectName, newProjectDesc, newProjectColor, newProjectTarget, newProjectBudget, newProjectLocation, newProjectStaff, newProjectPerformance, newProjectFuturePlans, newProjectTimeline, updateProject, resetForm]);

  const handleToggleChecklist = useCallback((projectId: string, itemId: string) => {
    toggleChecklistItem(projectId, itemId);
  }, [toggleChecklistItem]);

  const handleDeleteChecklist = useCallback((projectId: string, itemId: string) => {
    deleteChecklistItem(projectId, itemId);
  }, [deleteChecklistItem]);

  const handleAddChecklist = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProjectId || !newChecklistText.trim()) return;
    addChecklistItem(selectedProjectId, newChecklistText.trim());
    setNewChecklistText('');
  }, [selectedProjectId, newChecklistText, addChecklistItem]);

  const handleCreateAssociatedTask = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProjectId || !newTaskTitle.trim()) return;

    addTask({
      title: newTaskTitle.trim(),
      status: 'todo',
      priority: newTaskPriority,
      category: selectedProject?.name || '사업관리',
      projectId: selectedProjectId,
      tags: [selectedProject?.name || '사업'],
    });

    setNewTaskTitle('');
    setNewTaskPriority('medium');
    setIsAddingTask(false);
  }, [selectedProjectId, newTaskTitle, newTaskPriority, selectedProject?.name, addTask]);

  const handleToggleTaskStatus = useCallback((task: Task) => {
    const nextStatusMap: Record<string, 'todo' | 'in-progress' | 'done'> = {
      'todo': 'in-progress',
      'in-progress': 'done',
      'done': 'todo'
    };
    const newStatus = nextStatusMap[task.status] || 'todo';
    updateTask(task.id, { status: newStatus });
  }, [updateTask]);

  // Get associated tasks
  const associatedTasks = useMemo(() => {
    return selectedProjectId 
      ? tasks.filter(t => t.projectId === selectedProjectId)
      : [];
  }, [tasks, selectedProjectId]);

  // Map progress for projects
  const progressMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const p of projects) {
      map[p.id] = getProjectProgress(p.id);
    }
    return map;
  }, [projects, getProjectProgress]);

  return (
    <div className="flex flex-col h-full bg-slate-50/50 p-4 md:p-6 overflow-hidden gap-4">
      {/* Top Header Bar with Tab Switcher */}
      <div className="flex items-center justify-between bg-white border border-slate-200/80 rounded-2xl px-5 py-3 shadow-xs shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
            <FolderGit2 size={20} />
          </div>
          <div>
            <h1 className="text-base font-extrabold text-slate-800">사업 · 일정 관리</h1>
            <p className="vlds-subtitle text-[11px] font-medium text-slate-500">단위사업 개요 · 체크리스트 · 일정 플래너</p>
          </div>
        </div>

        {/* Tab Buttons */}
        <div className="flex p-1 bg-slate-100/80 rounded-xl border border-slate-200/60 shrink-0">
          <button
            onClick={() => setActiveTab('overview')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-extrabold transition-colors duration-150 cursor-pointer border-0 ${
              activeTab === 'overview'
                ? 'bg-white text-blue-600 shadow-xs'
                : 'text-slate-500 hover:text-slate-700 bg-transparent'
            }`}
          >
            <FolderGit2 size={15} />
            <span>사업 개요</span>
          </button>
          <button
            onClick={() => setActiveTab('scheduler')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-extrabold transition-colors duration-150 cursor-pointer border-0 ${
              activeTab === 'scheduler'
                ? 'bg-white text-blue-600 shadow-xs'
                : 'text-slate-500 hover:text-slate-700 bg-transparent'
            }`}
          >
            <Calendar size={15} />
            <span>일정 플래너</span>
          </button>
        </div>
      </div>

      {/* Main Tab Content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {activeTab === 'overview' ? (
          <div className="flex flex-col md:flex-row w-full max-w-[1700px] mx-auto gap-6 h-full">
        
        {/* Left Column: Project List Sidebar */}
        <div className="w-full md:w-[360px] shrink-0 bg-white rounded-2xl border border-slate-200/80 shadow-sm flex flex-col h-full overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FolderGit2 className="text-blue-600" size={20} />
              <h2 className="font-extrabold text-[15px] text-slate-800">사업 목록</h2>
            </div>
            <button
              onClick={() => {
                setEditingProjectId(null);
                resetForm();
                setIsAddingProject(true);
              }}
              className="p-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors flex items-center justify-center cursor-pointer border-0"
              title="새 사업 추가"
            >
              <Plus size={16} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2 custom-scrollbar">
            {projects.length === 0 ? (
              <div className="py-12 px-4 text-center">
                <ClipboardList className="mx-auto text-slate-300 mb-3" size={36} />
                <p className="text-[12px] font-bold text-slate-400">등록 사업 없음</p>
                <p className="text-[10px] text-slate-400 mt-1">상단 + 버튼 클릭 · 신규 사업 등록</p>
              </div>
            ) : (
              projects.map(p => (
                <ProjectListItem
                  key={p.id}
                  project={p}
                  isSelected={p.id === selectedProjectId}
                  progress={progressMap[p.id] || 0}
                  onSelect={handleSelectProject}
                  onStartEdit={startEditProject}
                  onDelete={handleDeleteProject}
                />
              ))
            )}
          </div>
        </div>

        {/* Right Column: Project Details Panel */}
        <div className="flex-1 bg-white rounded-2xl border border-slate-200/80 shadow-sm flex flex-col h-full overflow-hidden">
          {selectedProject ? (
            <div className="flex flex-col h-full overflow-hidden">
              {/* Project Header */}
              <div className="p-5 border-b border-slate-100 flex flex-col gap-2 shrink-0 bg-slate-50/20">
                <div className="flex items-center gap-3">
                  <span 
                    className="w-3.5 h-3.5 rounded-full shrink-0" 
                    style={{ backgroundColor: selectedProject.color }} 
                  />
                  <h1 className="text-lg font-black text-slate-800 leading-snug">
                    {selectedProject.name}
                  </h1>
                </div>
                {selectedProject.description && (
                  <p className="text-xs text-slate-500 leading-relaxed max-w-[90%] whitespace-pre-wrap pl-6">
                    {selectedProject.description}
                  </p>
                )}
              </div>

              {/* Panels split: Left (Attributes & Checklist), Right (Achievements & Tasks) */}
              <div className="flex-1 flex flex-col lg:flex-row overflow-hidden min-h-0">
                
                {/* Left Panel: Attributes & Checklist */}
                <div className="flex-1 flex flex-col border-r border-slate-100 p-5 overflow-hidden">
                  
                  {/* 사업 속성 그리드 (Project Parameters Grid) */}
                  <div className="mb-4 shrink-0 bg-slate-50/80 border border-slate-150/40 rounded-xl p-3.5 flex flex-col gap-2.5">
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                      <div className="flex items-center justify-between text-[11px] border-b border-slate-100 pb-1">
                        <span className="text-slate-400 font-bold flex items-center gap-1.5">
                          <Target size={12} /> 추진 대상
                        </span>
                        <span className="text-slate-700 font-extrabold truncate max-w-[120px]">{selectedProject.target || '-'}</span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] border-b border-slate-100 pb-1">
                        <span className="text-slate-400 font-bold flex items-center gap-1.5">
                          <CreditCard size={12} /> 예산규모
                        </span>
                        <span className="text-slate-700 font-extrabold truncate max-w-[120px]">{selectedProject.budget || '-'}</span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] border-b border-slate-100 pb-1">
                        <span className="text-slate-400 font-bold flex items-center gap-1.5">
                          <MapPin size={12} /> 추진 장소
                        </span>
                        <span className="text-slate-700 font-extrabold truncate max-w-[120px]">{selectedProject.location || '-'}</span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] border-b border-slate-100 pb-1">
                        <span className="text-slate-400 font-bold flex items-center gap-1.5">
                          <UserCheck size={12} /> 담당 요원
                        </span>
                        <span className="text-slate-700 font-extrabold truncate max-w-[120px]">{selectedProject.staff || '-'}</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-[11px] pt-0.5">
                      <span className="text-slate-400 font-bold flex items-center gap-1.5">
                        <Clock size={12} /> 추진 마감
                      </span>
                      <span className="text-blue-600 font-black">{selectedProject.timeline || '-'}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 mb-3 shrink-0">
                    <CheckCircle2 size={15} className="text-slate-500" />
                    <h3 className="font-black text-slate-700 text-[11px] uppercase tracking-wider">추진 체크리스트</h3>
                  </div>

                  {/* Checklist List */}
                  <div className="flex-1 overflow-y-auto flex flex-col gap-2 mb-4 pr-1 custom-scrollbar">
                    {selectedProject.checklistItems.length === 0 ? (
                      <div className="py-8 text-center my-auto">
                        <ClipboardList className="mx-auto text-slate-300 mb-2" size={24} />
                        <p className="text-[11px] font-bold text-slate-400">등록 체크리스트 없음</p>
                      </div>
                    ) : (
                      selectedProject.checklistItems.map((item: ChecklistItem) => (
                        <ChecklistItemRow
                          key={item.id}
                          projectId={selectedProject.id}
                          item={item}
                          onToggle={handleToggleChecklist}
                          onDelete={handleDeleteChecklist}
                        />
                      ))
                    )}
                  </div>

                  {/* Add Checklist Form */}
                  <form onSubmit={handleAddChecklist} className="flex gap-2 shrink-0">
                    <input
                      type="text"
                      placeholder="체크리스트 항목 입력"
                      value={newChecklistText}
                      onChange={e => setNewChecklistText(e.target.value)}
                      className="flex-1 px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 font-bold bg-white text-slate-700"
                    />
                    <button
                      type="submit"
                      className="px-3.5 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-colors cursor-pointer border-0 flex items-center gap-1"
                    >
                      <Plus size={14} />
                      <span>추가</span>
                    </button>
                  </form>
                </div>

                {/* Right Panel: Performance, Future Plans & Tasks */}
                <div className="flex-1 flex flex-col p-5 overflow-hidden bg-slate-50/10">
                  
                  {/* 추진 실적 & 향후 계획 카드 */}
                  <div className="grid grid-cols-1 gap-3.5 mb-4 shrink-0">
                    <div className="bg-white border border-slate-150/60 rounded-xl p-3 shadow-2xs">
                      <h4 className="text-[11px] font-black text-slate-500 flex items-center gap-1.5 mb-1.5 uppercase">
                        <BarChart2 size={12} className="text-emerald-500" /> 주요 추진 실적
                      </h4>
                      <p className="text-[11.5px] font-bold text-slate-700 whitespace-pre-wrap leading-relaxed">
                        {selectedProject.performance || '등록 실적 없음 · [정보 수정] 입력'}
                      </p>
                    </div>

                    <div className="bg-white border border-slate-150/60 rounded-xl p-3 shadow-2xs">
                      <h4 className="text-[11px] font-black text-slate-500 flex items-center gap-1.5 mb-1.5 uppercase">
                        <BookOpen size={12} className="text-blue-500" /> 향후 추진 계획
                      </h4>
                      <p className="text-[11.5px] font-bold text-slate-700 whitespace-pre-wrap leading-relaxed">
                        {selectedProject.futurePlans || '등록 향후 계획 없음'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between mb-3 shrink-0 border-t border-slate-100 pt-3">
                    <div className="flex items-center gap-1.5">
                      <Calendar size={15} className="text-slate-500" />
                      <h3 className="font-black text-slate-700 text-[11px] uppercase tracking-wider">연계 실무 업무</h3>
                    </div>
                    <button
                      onClick={() => setIsAddingTask(true)}
                      className="px-2.5 py-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors text-[10px] font-extrabold flex items-center gap-1 border-0 cursor-pointer"
                    >
                      <Plus size={12} />
                      <span>업무 배정</span>
                    </button>
                  </div>

                  {/* Associated Tasks List */}
                  <div className="flex-1 overflow-y-auto flex flex-col gap-2 mb-2 pr-1 custom-scrollbar">
                    {associatedTasks.length === 0 ? (
                      <div className="py-8 text-center my-auto">
                        <AlertCircle className="mx-auto text-slate-300 mb-2" size={24} />
                        <p className="text-[11px] font-bold text-slate-400">배정 업무 없음</p>
                      </div>
                    ) : (
                      associatedTasks.map(task => (
                        <AssociatedTaskItemRow
                          key={task.id}
                          task={task}
                          onToggleStatus={handleToggleTaskStatus}
                        />
                      ))
                    )}
                  </div>
                </div>

              </div>
            </div>
          ) : (
            <div className="m-auto text-center p-8 max-w-sm">
              <FolderGit2 className="mx-auto text-slate-300 mb-4 animate-pulse" size={48} />
              <h2 className="text-base font-extrabold text-slate-800">단위사업 상세</h2>
              <p className="text-[12px] text-slate-400 leading-relaxed mt-2">
                좌측 사업 선택 → 추진 현황 · 체크리스트 · 연계 업무 조회
              </p>
            </div>
          )}
        </div>
      </div>
    ) : (
          <div className="w-full h-full overflow-y-auto custom-scrollbar">
            <WeeklyScheduler />
          </div>
        )}
      </div>

      {/* Add / Edit Project Dialog Modal */}
      {(isAddingProject || isEditingProject) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-[620px] overflow-hidden flex flex-col p-6 animate-scale-up animate-duration-200">
            <div className="flex items-center gap-2 mb-4 shrink-0">
              <Sparkles className="text-blue-500 animate-pulse" size={18} />
              <h3 className="font-black text-slate-800 text-[14px]">
                {isEditingProject ? '사업 정보 수정' : '신규 사업 등록'}
              </h3>
            </div>

            <form onSubmit={isEditingProject ? handleUpdateProject : handleCreateProject} className="flex-1 flex flex-col gap-4 overflow-y-auto pr-1 custom-scrollbar max-h-[75vh]">
              
              {/* 기본 정보 */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5 col-span-2">
                  <label className="text-[11px] font-black text-slate-500 uppercase tracking-wide">사업명 *</label>
                  <input
                    type="text"
                    required
                    placeholder="예: 서울체력장 강남센터 구축"
                    value={newProjectName}
                    onChange={e => setNewProjectName(e.target.value)}
                    className="px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 font-bold text-slate-700 bg-white"
                  />
                </div>

                <div className="flex flex-col gap-1.5 col-span-2">
                  <label className="text-[11px] font-black text-slate-500 uppercase tracking-wide">사업 상세 설명</label>
                  <textarea
                    placeholder="주요 목적 · 일정 · 관리 메모"
                    value={newProjectDesc}
                    onChange={e => setNewProjectDesc(e.target.value)}
                    className="px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 font-semibold text-slate-700 bg-white min-h-[60px]"
                  />
                </div>

                {/* 추가 속성 그리드 */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-black text-slate-500 uppercase tracking-wide">추진 대상</label>
                  <input
                    type="text"
                    placeholder="예: 강남구 주민 전체"
                    value={newProjectTarget}
                    onChange={e => setNewProjectTarget(e.target.value)}
                    className="px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 font-bold text-slate-700 bg-white"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-black text-slate-500 uppercase tracking-wide">예산 규모</label>
                  <input
                    type="text"
                    placeholder="예: 25,000,000원"
                    value={newProjectBudget}
                    onChange={e => setNewProjectBudget(e.target.value)}
                    className="px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 font-bold text-slate-700 bg-white"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-black text-slate-500 uppercase tracking-wide">추진 장소</label>
                  <input
                    type="text"
                    placeholder="예: 강남구보건소 2층 체력측정실"
                    value={newProjectLocation}
                    onChange={e => setNewProjectLocation(e.target.value)}
                    className="px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 font-bold text-slate-700 bg-white"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-black text-slate-500 uppercase tracking-wide">담당 요원</label>
                  <input
                    type="text"
                    placeholder="예: 총괄주무관 · 전담요원"
                    value={newProjectStaff}
                    onChange={e => setNewProjectStaff(e.target.value)}
                    className="px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 font-bold text-slate-700 bg-white"
                  />
                </div>

                <div className="flex flex-col gap-1.5 col-span-2">
                  <label className="text-[11px] font-black text-slate-500 uppercase tracking-wide">추진 마감 · 정량 지표</label>
                  <input
                    type="text"
                    placeholder="예: 2026. 12. 31. 마감 · 연 5,000명 측정"
                    value={newProjectTimeline}
                    onChange={e => setNewProjectTimeline(e.target.value)}
                    className="px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 font-bold text-slate-700 bg-white"
                  />
                </div>

                <div className="flex flex-col gap-1.5 col-span-2">
                  <label className="text-[11px] font-black text-slate-500 uppercase tracking-wide">주요 추진 실적</label>
                  <textarea
                    placeholder="완료 예산 집행 · 기획 수립 성과"
                    value={newProjectPerformance}
                    onChange={e => setNewProjectPerformance(e.target.value)}
                    className="px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 font-semibold text-slate-700 bg-white min-h-[60px]"
                  />
                </div>

                <div className="flex flex-col gap-1.5 col-span-2">
                  <label className="text-[11px] font-black text-slate-500 uppercase tracking-wide">향후 추진 계획</label>
                  <textarea
                    placeholder="차기 일정 · 후속 추진 사항"
                    value={newProjectFuturePlans}
                    onChange={e => setNewProjectFuturePlans(e.target.value)}
                    className="px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 font-semibold text-slate-700 bg-white min-h-[60px]"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5 mt-2">
                <label className="text-[11px] font-black text-slate-500 uppercase tracking-wide">사업 고유 색상</label>
                <div className="flex items-center gap-2 mt-1">
                  {colorPalette.map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setNewProjectColor(c)}
                      className={`w-7 h-7 rounded-full transition-transform cursor-pointer border-2 ${
                        newProjectColor === c ? 'scale-110 border-slate-800' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 mt-6 border-t border-slate-100 pt-4 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddingProject(false);
                    setIsEditingProject(false);
                    setEditingProjectId(null);
                  }}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-50 transition-colors cursor-pointer bg-transparent"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition-colors cursor-pointer border-0"
                >
                  {isEditingProject ? '저장' : '생성'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Associated Task Addition Modal */}
      {isAddingTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-[420px] overflow-hidden flex flex-col p-6 animate-scale-up animate-duration-200">
            <h3 className="font-black text-slate-800 text-[14px] mb-4">프로젝트 연계 업무 배정</h3>

            <form onSubmit={handleCreateAssociatedTask} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-black text-slate-500 uppercase tracking-wide">업무명 (Task Title)</label>
                <input
                  type="text"
                  required
                  placeholder="예: 홍보 리플릿 시안 제작 지출 기안 작성"
                  value={newTaskTitle}
                  onChange={e => setNewTaskTitle(e.target.value)}
                  className="px-3.5 py-2.5 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 font-bold text-slate-700 bg-white"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-black text-slate-500 uppercase tracking-wide">업무 중요도 (Priority)</label>
                <select
                  value={newTaskPriority}
                  onChange={e => setNewTaskPriority(e.target.value as any)}
                  className="px-3 py-2.5 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 font-bold text-slate-700 bg-white cursor-pointer"
                >
                  <option value="low">낮음 (LOW)</option>
                  <option value="medium">중간 (MEDIUM)</option>
                  <option value="high">높음 (HIGH)</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 mt-4">
                <button
                  type="button"
                  onClick={() => setIsAddingTask(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-50 transition-colors cursor-pointer bg-transparent"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition-colors cursor-pointer border-0"
                >
                  배정 완료
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
