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
  actionType: BudgetActionTypeSchema.optional().catch('general'),
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

// ============ Working Memory Module ============
export const WorkingMemoryCategorySchema = z.enum(['budget', 'audit', 'festival', 'directive', 'general']);
export const WorkingMemoryStatusSchema = z.enum(['pending', 'reflected']);
export const WorkingMemorySourceSchema = z.enum(['pc', 'mobile']);

export const WorkingMemorySchema = z.object({
  id: z.string().catch('unknown-memo'),
  content: z.string().catch(''),
  category: WorkingMemoryCategorySchema.catch('general'),
  tags: z.array(z.string()).default([]).catch([]),
  numericHighlight: z.string().optional().catch(undefined),
  dateHighlight: z.string().optional().catch(undefined),
  status: WorkingMemoryStatusSchema.catch('pending'),
  source: WorkingMemorySourceSchema.optional().catch(undefined),
  pinned: z.boolean().optional().catch(false),
  createdAt: z.string().catch(new Date().toISOString()),
  updatedAt: z.string().catch(new Date().toISOString()),
  reflectedAt: z.string().optional().catch(undefined),
});

export type WorkingMemoryDto = z.infer<typeof WorkingMemorySchema>;

// ============ Admin Document Module (Milestone 1) ============
export const AdminDocTypeSchema = z.enum([
  'POLICY_PLAN',
  'RESULT_REPORT',
  'ADMIN_AUDIT',
  'BUDGET_PLAN',
  'WEEKLY_REPORT',
]);

export const AdminDocTypeEnum = AdminDocTypeSchema;
export type AdminDocType = z.infer<typeof AdminDocTypeSchema>;

export const ADMIN_DOC_TYPE_LABELS: Record<AdminDocType, string> = {
  POLICY_PLAN: '방침서',
  RESULT_REPORT: '결과보고서',
  ADMIN_AUDIT: '행정사무감사',
  BUDGET_PLAN: '사업설명서',
  WEEKLY_REPORT: '주간업무보고',
};

export const AdminDocMetadataSchema = z.object({
  id: z.string().catch('unknown-doc'),
  docId: z.string().catch('unknown-doc-id'),
  title: z.string().catch('제목 없음'),
  docType: AdminDocTypeSchema.catch('POLICY_PLAN'),
  typeLabel: z.string().catch('방침서'),
  year: z.number().catch(2026),
  department: z.string().catch('보건행정과'),
  team: z.string().optional().catch('건강증진팀'),
  project: z.string().catch('기타_일반행정'),
  projectId: z.string().nullable().optional().catch(undefined),
  filePath: z.string().catch(''),
  originalFileName: z.string().catch(''),
  sourceLocation: z.enum(['DESKTOP', 'MASTER_ARCHIVE']).catch('MASTER_ARCHIVE'),
  documentDate: z.string().optional().catch(undefined),
  fileExt: z.string().catch('.hwpx'),
  fileSize: z.number().catch(0),
  budgetAmount: z.number().nullable().optional().catch(null),
  executionRate: z.number().nullable().optional().catch(null),
  auditFindings: z.array(z.string()).nullable().optional().catch(null),
  summary: z.string().catch(''),
  ontologyLinks: z.object({
    projectId: z.string().nullable().optional().catch(undefined),
    planDocId: z.string().nullable().optional().catch(null),
    resultDocId: z.string().nullable().optional().catch(null),
    auditDocId: z.string().nullable().optional().catch(null),
    budgetDocId: z.string().nullable().optional().catch(null),
    weeklyDocIds: z.array(z.string()).default([]).catch([]),
  }).optional().catch(undefined),
  createdAt: z.string().catch(new Date().toISOString()),
  updatedAt: z.string().catch(new Date().toISOString()),
});

export type AdminDocMetadataDto = z.infer<typeof AdminDocMetadataSchema>;

export const AdminDocIndexEnvelopeSchema = z.object({
  version: z.string().optional().catch('1.0.0'),
  generatedAt: z.string().catch(new Date().toISOString()),
  totalDocuments: z.number().int().nonnegative().optional().catch(0),
  totalIndexed: z.number().optional().catch(0),
  sourceDesktopCount: z.number().optional().catch(0),
  sourceArchiveCount: z.number().optional().catch(0),
  statsByType: z.record(z.string(), z.number()).optional().catch(undefined),
  statsByProject: z.record(z.string(), z.number()).optional().catch(undefined),
  documents: z.array(AdminDocMetadataSchema).catch([]),
});

export const AdminDocIndexSchema = z.union([
  z.array(AdminDocMetadataSchema),
  AdminDocIndexEnvelopeSchema,
]);

export type AdminDocIndexDto = z.infer<typeof AdminDocIndexSchema>;

export const SeedOntologyDocsSchema = z.object({
  version: z.string().catch('1.0.0'),
  generatedAt: z.string().catch(new Date().toISOString()),
  metadata: z.record(z.string(), z.any()).optional().catch(undefined),
  totalEntities: z.number().optional().catch(0),
  projects: z.array(z.any()).optional().catch([]),
  nodes: z.array(z.any()).optional().catch([]),
  edges: z.array(z.any()).optional().catch([]),
  entities: z.record(z.string(), z.any()).optional().catch(undefined),
  relations: z.array(z.any()).optional().catch([]),
});

export type SeedOntologyDocsDto = z.infer<typeof SeedOntologyDocsSchema>;

export const DOMAIN_SHEET_NAMES = [
  'TASKS',
  'BUDGET_CATEGORIES',
  'BUDGET_ENTRIES',
  'BUDGET_SIMULATIONS',
  'PROJECTS',
  'EXTERNAL_DOCS',
  'CLASSIFICATION_WORDS',
  'SCHEDULES',
  'CONTACTS',
  'WORKING_MEMORY',
  'ADMIN_DOC_INDEX',
] as const;

export type DomainSheetName = (typeof DOMAIN_SHEET_NAMES)[number];

export const getDomainSchema = (sheetName: string) => {
  switch (sheetName.toUpperCase()) {
    case 'TASKS': return TaskSchema;
    case 'BUDGET_CATEGORIES': return BudgetCategorySchema;
    case 'BUDGET_ENTRIES': return BudgetEntrySchema;
    case 'BUDGET_SIMULATIONS':
    case 'SIMULATION_ENTRIES': return SimulationEntrySchema;
    case 'PROJECTS': return ProjectSchema;
    case 'EXTERNAL_DOCS': return ExternalDocSchema;
    case 'CLASSIFICATION_WORDS': return ClassificationWordsSchema;
    case 'SCHEDULES': return ScheduleSchema;
    case 'CONTACTS': return ContactSchema;
    case 'WORKING_MEMORY': return WorkingMemorySchema;
    case 'ADMIN_DOC_INDEX': return AdminDocMetadataSchema;
    default: return z.any(); // Fallback for unstructured arrays
  }
};

// ============ Strict Gatekeeper Schemas (Zero .catch() Masking for CLI Harness & Audit) ============
export const StrictTaskSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().optional(),
  status: TaskStatusSchema,
  priority: TaskPrioritySchema,
  category: z.string(),
  dueDate: z.string().optional(),
  projectId: z.string().optional(),
  recurrence: z.string().optional(),
  recurrenceStartDate: z.string().optional(),
  recurrenceEndDate: z.string().optional(),
  recurrenceCount: z.number().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  tags: z.array(z.string()).default([]),
});

export const StrictBudgetCategorySchema = z.object({
  id: z.string(),
  name: z.string(),
  totalBudget: z.number(),
  color: z.string().optional().default('#3b82f6'),
  description: z.string().optional(),
  policyProject: z.string().optional(),
  unitProject: z.string().optional(),
  detailedProject: z.string().optional(),
  managementProject: z.string().optional(),
  statItem: z.string().optional(),
  formationItem: z.string().optional(),
  budgetType: z.enum(['본예산', '간주예산', '추경']).optional(),
  fundingSource: z.string().optional(),
  fundingSplits: z.array(z.object({
    source: z.string(),
    amount: z.number()
  })).optional(),
  subItems: z.array(z.object({
    id: z.string().optional(),
    prefix: z.string().optional(),
    name: z.string(),
    calculation: z.string().optional(),
    amount: z.number(),
    isCustomFunding: z.boolean().optional(),
    isLocked: z.boolean().optional(),
    virtualAdjustment: z.number().optional(),
    note: z.string().optional(),
    checked: z.boolean().optional(),
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
      virtualAdjustment: z.number().optional(),
      note: z.string().optional(),
      checked: z.boolean().optional(),
      fundingSplits: z.array(z.object({
        source: z.string(),
        amount: z.number()
      })).optional()
    })).optional()
  })).optional(),
  sortOrder: z.number().optional(),
});

export const StrictBudgetEntrySchema = z.object({
  id: z.string(),
  categoryId: z.string(),
  amount: z.number(),
  date: z.string(),
  purpose: z.string(),
  memo: z.string().optional(),
  isPlanned: z.boolean().optional(),
  isSettled: z.boolean().optional(),
  relatedPlanId: z.string().optional(),
  linkedSubItemId: z.string().optional(),
  entryType: z.literal('approval').optional(),
  actionType: BudgetActionTypeSchema.optional(),
  inventoryItemId: z.string().optional(),
  docRegNum: z.string().optional(),
  checked: z.boolean().optional(),
  fundingSource: z.string().optional(),
  transferDirection: z.enum(['in', 'out']).optional(),
  simulationEntryId: z.string().optional(),
});

export const StrictSimulationEntrySchema = z.object({
  id: z.string(),
  name: z.string(),
  detailedProject: z.string(),
  statItem: z.string(),
  categoryId: z.string().optional(),
  actionType: BudgetActionTypeSchema.optional(),
  unitPrice: z.number(),
  quantity: z.number(),
  amount: z.number(),
  memo: z.string().optional(),
  createdAt: z.string(),
  status: z.enum(['PLANNED', 'SETTLED', 'CANCELLED']).optional(),
  budgetEntryId: z.string().optional(),
  settledEntryId: z.string().optional(),
  settledDate: z.string().optional(),
});

export const StrictChecklistItemSchema = z.object({
  id: z.string(),
  text: z.string(),
  completed: z.boolean(),
});

export const StrictProjectSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  color: z.string(),
  checklistItems: z.array(StrictChecklistItemSchema).default([]),
  createdAt: z.string(),
  updatedAt: z.string(),
  target: z.string().optional(),
  budget: z.string().optional(),
  location: z.string().optional(),
  staff: z.string().optional(),
  performance: z.string().optional(),
  futurePlans: z.string().optional(),
  timeline: z.string().optional(),
});

export const StrictExternalDocSchema = z.object({
  id: z.string(),
  name: z.string(),
  path: z.string(),
  size: z.number(),
  lastModified: z.string(),
  content: z.string().optional(),
  parsedAt: z.string().optional(),
  layerId: z.number().default(3),
});

export const StrictClassificationWordsSchema = z.object({
  id: z.string(),
  agents: z.array(z.string()).default([]),
  resources: z.array(z.string()).default([]),
  executions: z.array(z.string()).default([]),
});

export const StrictScheduleSchema = z.object({
  id: z.string(),
  date: z.string(),
  endDate: z.string().optional(),
  startTime: z.string(),
  endTime: z.string(),
  title: z.string(),
  type: ScheduleTypeSchema,
  person: z.string(),
  notes: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const StrictContactSchema = z.object({
  id: z.string(),
  name: z.string(),
  phone: z.string(),
  email: z.string().optional(),
  notes: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const StrictWorkingMemorySchema = z.object({
  id: z.string(),
  content: z.string(),
  category: WorkingMemoryCategorySchema,
  tags: z.array(z.string()).default([]),
  numericHighlight: z.string().optional(),
  dateHighlight: z.string().optional(),
  status: WorkingMemoryStatusSchema,
  source: WorkingMemorySourceSchema.optional(),
  pinned: z.boolean().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  reflectedAt: z.string().optional(),
});

export const StrictAdminDocMetadataSchema = z.object({
  id: z.string(),
  docId: z.string(),
  title: z.string(),
  docType: AdminDocTypeSchema,
  typeLabel: z.string(),
  year: z.number(),
  department: z.string(),
  team: z.string().optional(),
  project: z.string(),
  projectId: z.string().nullable().optional(),
  filePath: z.string(),
  originalFileName: z.string(),
  sourceLocation: z.enum(['DESKTOP', 'MASTER_ARCHIVE']),
  documentDate: z.string().optional(),
  fileExt: z.string(),
  fileSize: z.number(),
  budgetAmount: z.number().nullable().optional(),
  executionRate: z.number().nullable().optional(),
  auditFindings: z.array(z.string()).nullable().optional(),
  summary: z.string(),
  ontologyLinks: z.object({
    projectId: z.string().nullable().optional(),
    planDocId: z.string().nullable().optional(),
    resultDocId: z.string().nullable().optional(),
    auditDocId: z.string().nullable().optional(),
    budgetDocId: z.string().nullable().optional(),
    weeklyDocIds: z.array(z.string()).default([]),
  }).optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const StrictAdminDocIndexEnvelopeSchema = z.object({
  version: z.string().optional(),
  generatedAt: z.string(),
  totalDocuments: z.number().int().nonnegative().optional(),
  totalIndexed: z.number().optional(),
  sourceDesktopCount: z.number().optional(),
  sourceArchiveCount: z.number().optional(),
  statsByType: z.record(z.string(), z.number()).optional(),
  statsByProject: z.record(z.string(), z.number()).optional(),
  documents: z.array(StrictAdminDocMetadataSchema),
});

export const StrictAdminDocIndexSchema = z.union([
  z.array(StrictAdminDocMetadataSchema),
  StrictAdminDocIndexEnvelopeSchema,
]);

export const StrictSeedOntologyDocsSchema = z.object({
  version: z.string(),
  generatedAt: z.string(),
  metadata: z.record(z.string(), z.any()).optional(),
  totalEntities: z.number().optional(),
  projects: z.array(z.any()).optional(),
  nodes: z.array(z.any()).optional(),
  edges: z.array(z.any()).optional(),
  entities: z.record(z.string(), z.any()).optional(),
  relations: z.array(z.any()).optional(),
});

export const getStrictDomainSchema = (sheetName: string) => {
  switch (sheetName.toUpperCase()) {
    case 'TASKS': return StrictTaskSchema;
    case 'BUDGET_CATEGORIES': return StrictBudgetCategorySchema;
    case 'BUDGET_ENTRIES': return StrictBudgetEntrySchema;
    case 'BUDGET_SIMULATIONS':
    case 'SIMULATION_ENTRIES': return StrictSimulationEntrySchema;
    case 'PROJECTS': return StrictProjectSchema;
    case 'EXTERNAL_DOCS': return StrictExternalDocSchema;
    case 'CLASSIFICATION_WORDS': return StrictClassificationWordsSchema;
    case 'SCHEDULES': return StrictScheduleSchema;
    case 'CONTACTS': return StrictContactSchema;
    case 'WORKING_MEMORY': return StrictWorkingMemorySchema;
    case 'ADMIN_DOC_INDEX': return StrictAdminDocMetadataSchema;
    default: return z.any();
  }
};



