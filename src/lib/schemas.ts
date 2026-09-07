import { z } from 'zod';

// ============ Investigator Verification Status ============
export const VerificationStatusSchema = z.enum([
  'uncompleted',
  'in-progress',
  'verified',
  'risk-warning'
]).catch('uncompleted');

// ============ Task Module ============
export const TaskStatusSchema = z.enum(['todo', 'in-progress', 'done']);
export const TaskPrioritySchema = z.enum(['low', 'medium', 'high']);

export const TaskSchema = z.object({
  id: z.string().catch('unknown-id'),
  title: z.string().catch('제목 없음'),
  description: z.string().optional().catch(''),
  status: TaskStatusSchema.catch('todo'),
  priority: TaskPrioritySchema.catch('medium'),
  category: z.string().catch('미분류'),
  dueDate: z.string().optional().catch(undefined),
  projectId: z.string().optional().catch(undefined),
  recurrence: z.string().optional().catch(undefined),
  recurrenceStartDate: z.string().optional().catch(undefined),
  recurrenceEndDate: z.string().optional().catch(undefined),
  recurrenceCount: z.number().optional().catch(undefined),
  createdAt: z.string().catch(new Date().toISOString()),
  updatedAt: z.string().catch(new Date().toISOString()),
  tags: z.array(z.string()).default([]).catch([]),
});

export type TaskDto = z.infer<typeof TaskSchema>;

// ============ Budget Module ============
export const BudgetActionTypeSchema = z.enum(['general', 'issuance', 'daily_expense', 'transfer', 'correction', 'settle']);

export const BudgetCategorySchema = z.object({
  id: z.string().catch('unknown-cat'),
  name: z.string().catch('알 수 없는 카테고리'),
  totalBudget: z.number().catch(0),
  color: z.string().optional().default('#3b82f6').catch('#3b82f6'),
  description: z.string().optional().catch(''),
  policyProject: z.string().optional().catch('기타'),
  unitProject: z.string().optional().catch('전반'),
  detailedProject: z.string().optional().catch('기본운영'),
  managementProject: z.string().optional().catch(undefined),
  statItem: z.string().optional().catch('일반'),
  formationItem: z.string().optional().catch(undefined),
  budgetType: z.enum(['본예산', '간주예산', '추경']).optional().catch(undefined),
  fundingSource: z.string().optional().catch(undefined),
  fundingSplits: z.array(z.object({
    source: z.string(),
    amount: z.number()
  })).optional().catch(undefined),
  subItems: z.array(z.object({
    id: z.string().optional(),
    prefix: z.string().optional(),
    name: z.string(),
    calculation: z.string().optional(),
    amount: z.number(),
    isCustomFunding: z.boolean().optional(),
    isLocked: z.boolean().optional(),
    virtualAdjustment: z.number().optional().catch(0),
    note: z.string().optional().catch(''),
    checked: z.boolean().optional().catch(false),
    fundingSplits: z.array(z.object({
      source: z.string(),
      amount: z.number()
    })).optional(),
    calculations: z.array(z.object({
      id: z.string().optional(),
      name: z.string().optional(),
      calculation: z.string(),
      amount: z.number(),
      isCustomFunding: z.boolean().optional(),
      isLocked: z.boolean().optional(),
      virtualAdjustment: z.number().optional().catch(0),
      note: z.string().optional().catch(''),
      checked: z.boolean().optional().catch(false),
      fundingSplits: z.array(z.object({
        source: z.string(),
        amount: z.number()
      })).optional()
    })).optional()
  })).optional().catch(undefined),
  sortOrder: z.number().optional().catch(undefined),
});

export type BudgetCategoryDto = z.infer<typeof BudgetCategorySchema>;

export const BudgetEntrySchema = z.object({
  id: z.string().catch('unknown-entry'),
  categoryId: z.string().catch('unknown-cat'),
  amount: z.number().catch(0),
  date: z.string().catch(new Date().toISOString()),
  purpose: z.string().catch('내역 없음'),
  memo: z.string().optional().catch(''),
  isPlanned: z.boolean().optional().catch(false),
  isSettled: z.boolean().optional().catch(false),
  relatedPlanId: z.string().optional().catch(undefined),
  linkedSubItemId: z.string().optional().catch(undefined),
  entryType: z.literal('approval').optional().catch(undefined),
  actionType: BudgetActionTypeSchema.optional().catch(undefined),
  inventoryItemId: z.string().optional().catch(undefined),
  docRegNum: z.string().optional().catch(''),
  checked: z.boolean().optional().catch(false),
  fundingSource: z.string().optional().catch(undefined),
  transferDirection: z.enum(['in', 'out']).optional().catch(undefined),
  simulationEntryId: z.string().optional().catch(undefined),
});

export type BudgetEntryDto = z.infer<typeof BudgetEntrySchema>;

// ============ Budget Simulator Module ============
export const SimulationEntrySchema = z.object({
  id: z.string().catch('unknown-sim-id'),
  name: z.string().catch('지출 예정 항목'),
  detailedProject: z.string().catch('기본운영'),
  statItem: z.string().catch('일반운영비'),
  categoryId: z.string().optional().catch(undefined),
  unitPrice: z.number().catch(0),
  quantity: z.number().catch(1),
  amount: z.number().catch(0),
  memo: z.string().optional().catch(''),
  createdAt: z.string().catch(new Date().toISOString()),
  status: z.enum(['PLANNED', 'SETTLED', 'CANCELLED']).optional().catch('PLANNED'),
  budgetEntryId: z.string().optional().catch(undefined),
  settledEntryId: z.string().optional().catch(undefined),
  settledDate: z.string().optional().catch(undefined),
});

export type SimulationEntryDto = z.infer<typeof SimulationEntrySchema>;

// ============ Project Module ============
export const ChecklistItemSchema = z.object({
  id: z.string().catch('unknown-item'),
  text: z.string().catch('할일'),
  completed: z.boolean().catch(false),
});

export const ProjectSchema = z.object({
  id: z.string().catch('unknown-project'),
  name: z.string().catch('알 수 없는 프로젝트'),
  description: z.string().optional().catch(''),
  color: z.string().catch('#94a3b8'),
  checklistItems: z.array(ChecklistItemSchema).default([]).catch([]),
  createdAt: z.string().catch(new Date().toISOString()),
  updatedAt: z.string().catch(new Date().toISOString()),
  target: z.string().optional().catch(''),
  budget: z.string().optional().catch(''),
  location: z.string().optional().catch(''),
  staff: z.string().optional().catch(''),
  performance: z.string().optional().catch(''),
  futurePlans: z.string().optional().catch(''),
  timeline: z.string().optional().catch(''),
});

export const ExternalDocSchema = z.object({
  id: z.string().catch('unknown-doc-id'),
  name: z.string().catch('문서 이름 없음'),
  path: z.string().catch(''),
  size: z.number().catch(0),
  lastModified: z.string().catch(new Date().toISOString()),
  content: z.string().optional().catch(''),
  parsedAt: z.string().optional().catch(''),
  layerId: z.number().default(3).catch(3), // 3: 위키/문서 레이어
});

export type ExternalDocDto = z.infer<typeof ExternalDocSchema>;

export const ClassificationWordsSchema = z.object({
  id: z.string().catch('classification_rules'),
  agents: z.array(z.string()).default([]).catch([]),
  resources: z.array(z.string()).default([]).catch([]),
  executions: z.array(z.string()).default([]).catch([]),
});

export type ClassificationWordsDto = z.infer<typeof ClassificationWordsSchema>;

// ============ Weekly Scheduler Module ============
export const ScheduleTypeSchema = z.enum(['security', 'meeting', 'education', 'other']);

export const ScheduleSchema = z.object({
  id: z.string().catch('unknown-schedule'),
  date: z.string().catch(new Date().toISOString().split('T')[0]),
  endDate: z.string().optional().catch(undefined),
  startTime: z.string().catch('09:00'),
  endTime: z.string().catch('18:00'),
  title: z.string().catch('새로운 일정'),
  type: ScheduleTypeSchema.catch('other'),
  person: z.string().catch(''),
  notes: z.string().optional().catch(''),
  createdAt: z.string().catch(new Date().toISOString()),
  updatedAt: z.string().catch(new Date().toISOString()),
});

export type ScheduleDto = z.infer<typeof ScheduleSchema>;

// ============ Contacts Module ============
export const ContactSchema = z.object({
  id: z.string().catch('unknown-contact'),
  name: z.string().catch('이름 없음'),
  phone: z.string().catch(''),
  email: z.string().optional().catch(''),
  notes: z.string().optional().catch(''),
  createdAt: z.string().catch(new Date().toISOString()),
  updatedAt: z.string().catch(new Date().toISOString()),
});

export type ContactDto = z.infer<typeof ContactSchema>;

export const getDomainSchema = (sheetName: string) => {
  switch (sheetName.toUpperCase()) {
    case 'TASKS': return TaskSchema;
    case 'BUDGET_CATEGORIES': return BudgetCategorySchema;
    case 'BUDGET_ENTRIES': return BudgetEntrySchema;
    case 'SIMULATION_ENTRIES': return SimulationEntrySchema;
    case 'PROJECTS': return ProjectSchema;
    case 'EXTERNAL_DOCS': return ExternalDocSchema;
    case 'CLASSIFICATION_WORDS': return ClassificationWordsSchema;
    case 'SCHEDULES': return ScheduleSchema;
    case 'CONTACTS': return ContactSchema;
    default: return z.any(); // Fallback for unstructured arrays
  }
};

