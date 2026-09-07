// ============ Task Module ============
export type TaskStatus = 'todo' | 'in-progress' | 'done';
export type TaskPriority = 'low' | 'medium' | 'high';

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  category: string;
  dueDate?: string;
  projectId?: string;
  recurrence?: string; // 반복 패턴: '매주 목요일', '매월 15일', '매일' 등
  recurrenceStartDate?: string;
  recurrenceEndDate?: string;
  recurrenceCount?: number; // 총 반복 횟수
  createdAt: string;
  updatedAt: string;
  tags: string[];
}

// ============ Budget Module ============
export type BudgetActionType = 'general' | 'issuance' | 'daily_expense' | 'transfer' | 'correction' | 'settle'; // 일반품의, 일상경비교부, 일상경비지출, 이용/전용, 정정, 정산(결산)

export interface BudgetFundingSplit {
  source: string;
  amount: number;
}

export interface BudgetCalculation {
  id?: string;
  name?: string;
  calculation: string;
  amount: number;
  isCustomFunding?: boolean;
  fundingSplits?: BudgetFundingSplit[];
  isLocked?: boolean;
  virtualAdjustment?: number;
  note?: string;
  checked?: boolean;
}

export interface BudgetSubItem {
  id?: string;
  prefix?: string;
  name: string;
  calculation?: string;
  amount: number;
  isCustomFunding?: boolean;
  fundingSplits?: BudgetFundingSplit[];
  isLocked?: boolean;
  virtualAdjustment?: number;
  calculations?: BudgetCalculation[];
  note?: string;
  checked?: boolean;
}

export interface BudgetCategory {
  id: string;
  name: string;
  totalBudget: number;
  color: string;
  description?: string;
  policyProject?: string; // 정책사업명
  unitProject?: string;   // 단위사업명
  detailedProject?: string; // 세부사업명
  managementProject?: string; // 관리사업명 (선택사항, 재원/부서 등으로 세부사업 내에서 한 번 더 쪼갤 때 사용)
  formationItem?: string; // 편성목 (ex: 201 일반운영비)
  statItem?: string;      // 통계목 (ex: 01 사무관리비)
  budgetType?: '본예산' | '간주예산' | '추경'; // 예산 구분
  fundingSource?: string; // 재원 구분 (구비, 국비, 시비 등)
  fundingSplits?: BudgetFundingSplit[]; // 정확한 분할 금액을 저장하기 위한 원본 데이터 보존용
  subItems?: BudgetSubItem[]; // 세부 산출내역 (산출근거)
  sortOrder?: number; // 편성목 표시 순서 (낮을수록 위)
}

export type ExpenseEntry = BudgetEntry;

export interface BudgetEntry {
  id: string;
  categoryId: string;
  amount: number;
  date: string;
  purpose: string;
  memo?: string;
  
  // Commitment Accounting (원인행위 & 정산)
  isPlanned?: boolean;    // true = 지출품의(예상), false = 실제 지출
  isSettled?: boolean;    // true = 이 품의에 대한 실제 지출(정산) 완료됨
  relatedPlanId?: string; // 실제 지출(isPlanned:false)일 경우 연관된 품의서(isPlanned:true)의 ID
  
  entryType?: 'approval'; // Deprecated
  actionType?: BudgetActionType; // 일반품의, 일상경비 교부, 일상경비 지출
  inventoryItemId?: string;
  docRegNum?: string; // 시행 문서 번호 (보건행정과-00000)
  linkedSubItemId?: string; // 세부 산출내역(통제 항목) 연결 ID
  checked?: boolean;
  fundingSource?: string;
  transferDirection?: 'in' | 'out';
}

// ============ Inventory Module ============
export interface InventoryItem {
  id: string;
  name: string;
  category: string;
  currentStock: number;
  unit: string;
  budgetEntryIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface StockChange {
  id: string;
  itemId: string;
  change: number; // 양수=입고, 음수=출고
  reason: string;
  date: string;
}

// ============ Meeting Module ============
export interface Meeting {
  id: string;
  title: string;
  datetime: string;
  endTime?: string;
  location?: string;
  attendees: string[];
  agenda?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// ============ Project Module ============
export interface ChecklistItem {
  id: string;
  text: string;
  completed: boolean;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  color: string;
  checklistItems: ChecklistItem[];
  createdAt: string;
  updatedAt: string;
  target?: string;
  budget?: string;
  location?: string;
  staff?: string;
  performance?: string;
  futurePlans?: string;
  timeline?: string;
}

// ============ Document Generator Module ============
export interface DocumentEntry {
  id: string;
  title: string;           // 건명
  expenseType: string;     // 경비구분 (일상경비, 여비 등)
  amount: number;          // 금액
  vendorName: string;      // 업체명
  vendorRegNo: string;     // 사업자등록번호
  relatedDoc: string;      // 관련문서 번호
  recipient: string;       // 수신 (내부결재 등)
  budgetAccount: string;   // 예산과목
  paymentMethod: string;   // 지급방법
  status: 'draft' | 'ready' | 'done'; // 상태
}

export type ModuleType = 'dashboard' | 'workspace' | 'mindmap' | 'project' | 'festival' | 'simulator';

// ============ Budget Simulator Module ============
export interface SimulationEntry {
  id: string;
  name: string;             // 지출 예정 항목명
  detailedProject: string;  // 세부사업명
  statItem: string;         // 통계목명 (ex: "201-01 사무관리비")
  categoryId?: string;      // 매핑된 BudgetCategory ID (선택사항)
  unitPrice: number;        // 단가
  quantity: number;         // 수량
  amount: number;           // 총액 (unitPrice * quantity)
  memo?: string;            // 비고/메모
  createdAt: string;        // 생성일시 (ISO string)
}

export interface ProjectSimulationSummary {
  detailedProject: string;
  totalBudget: number;         // 총 예산액
  currentSpent: number;        // 현재 집행액
  currentRemaining: number;    // 현재 집행 잔액 (totalBudget - currentSpent)
  simulatedExpenditure: number;// 확정 지출 예정액 합계
  finalExpectedBalance: number;// 최종 예상 잔액 (currentRemaining - simulatedExpenditure)
  executionRate: number;       // 집행률 (%)
  isDeficit: boolean;          // finalExpectedBalance < 0
}

export interface StatItemSimulationSummary {
  statItem: string;
  detailedProject: string;
  totalBudget: number;
  currentSpent: number;
  currentRemaining: number;
  simulatedExpenditure: number;
  finalExpectedBalance: number;
  isDeficit: boolean;
}

// ============ Weekly Scheduler Module ============
export type ScheduleType = 'security' | 'meeting' | 'education' | 'other';

export interface Schedule {
  id: string;
  date: string;
  endDate?: string;
  startTime: string;
  endTime: string;
  title: string;
  type: ScheduleType;
  person: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// ============ Contacts Module ============
export interface Contact {
  id: string;
  name: string;
  phone: string;
  email?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// ============ Utility ============
export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}
