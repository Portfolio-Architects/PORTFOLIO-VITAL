/**
 * VITAL Work & Wealth Architecture — Wednesday Batching Engine
 * Requirement: R1 (Weekly Administrative Work Reports & Wednesday Batching)
 * Standards: Rule G, Rule M, Rule P, docs/HWP_GENERATION_GUIDELINES.md
 *
 * Given reference date W (target Wednesday):
 * - Past actuals (실적 기간): [W - 2 days, W + 4 days] (Monday ~ Sunday)
 * - Next plan (계획 기간): [W + 5 days, W + 11 days] (Following Monday ~ Sunday)
 */

import { TaskDto, WeeklyWorkItemDto, WeeklyReportDto } from '@/lib/schemas';

export interface WednesdayBatchPeriods {
  targetWednesday: string;
  performanceStart: string;
  performanceEnd: string;
  planStart: string;
  planEnd: string;
  performanceLabel: string;
  planLabel: string;
}

export interface WeeklyProjectBlock {
  projectOrder: number;
  projectName: string;
  period: string;
  target?: string;
  location?: string;
  contents: string[];
  metrics?: string;
  status: 'performance' | 'plan';
}

export interface FormattedWeeklyColumn {
  status: 'performance' | 'plan';
  periodLabel: string;
  blocks: WeeklyProjectBlock[];
  renderedParagraphs: Array<{
    type: 'title' | 'spacer' | 'detail' | 'bullet';
    text: string;
    paraPrId: number;
    charPrId: number;
  }>;
}

/**
 * Format date range into Korean public admin standard label:
 * Example: "11. 02.(월) ~ 11. 08.(일)"
 */
export function formatPeriodLabel(start: Date, end: Date): string {
  const sm = String(start.getUTCMonth() + 1).padStart(2, '0');
  const sd = String(start.getUTCDate()).padStart(2, '0');
  const em = String(end.getUTCMonth() + 1).padStart(2, '0');
  const ed = String(end.getUTCDate()).padStart(2, '0');
  return `${sm}. ${sd}.(월) ~ ${em}. ${ed}.(일)`;
}

/**
 * Calculates target Wednesday and exact date windows for:
 * - Past actuals (실적): [W - 2 days, W + 4 days] (Monday ~ Sunday)
 * - Next plan (계획): [W + 5 days, W + 11 days] (Next Monday ~ Sunday)
 */
export function computeWednesdayBatchPeriods(dateInput: string | Date): WednesdayBatchPeriods {
  if (!dateInput) {
    throw new Error('[WEDNESDAY BATCH ERROR] Invalid date input: null or undefined');
  }

  const dt =
    typeof dateInput === 'string'
      ? new Date(dateInput.includes('T') ? dateInput : `${dateInput}T00:00:00Z`)
      : new Date(dateInput);

  if (isNaN(dt.getTime())) {
    throw new Error(`[WEDNESDAY BATCH ERROR] Invalid date input: ${dateInput}`);
  }

  // 0 = Sun, 1 = Mon, 2 = Tue, 3 = Wed, 4 = Thu, 5 = Fri, 6 = Sat
  const dayOfWeek = dt.getUTCDay();
  const diffToWed = 3 - dayOfWeek;
  const wed = new Date(dt.getTime());
  wed.setUTCDate(wed.getUTCDate() + diffToWed);

  const pStart = new Date(wed.getTime());
  pStart.setUTCDate(pStart.getUTCDate() - 2); // Monday

  const pEnd = new Date(wed.getTime());
  pEnd.setUTCDate(pEnd.getUTCDate() + 4); // Sunday

  const nextStart = new Date(wed.getTime());
  nextStart.setUTCDate(nextStart.getUTCDate() + 5); // Next Monday

  const nextEnd = new Date(wed.getTime());
  nextEnd.setUTCDate(nextEnd.getUTCDate() + 11); // Next Sunday

  const fmtIso = (d: Date) => d.toISOString().split('T')[0];

  return {
    targetWednesday: fmtIso(wed),
    performanceStart: fmtIso(pStart),
    performanceEnd: fmtIso(pEnd),
    planStart: fmtIso(nextStart),
    planEnd: fmtIso(nextEnd),
    performanceLabel: formatPeriodLabel(pStart, pEnd),
    planLabel: formatPeriodLabel(nextStart, nextEnd),
  };
}

/**
 * Formats a project block into public admin standard lines:
 * Title -> Period -> Target -> Location -> Contents -> Metrics
 */
export function formatWeeklyBlockToLines(block: WeeklyProjectBlock): string[] {
  const lines: string[] = [];

  // Project Title with sequence order (e.g. "8. 서울체력장 강남센터")
  const orderPrefix = block.projectName.startsWith(`${block.projectOrder}.`)
    ? ''
    : `${block.projectOrder}. `;
  lines.push(`${orderPrefix}${block.projectName}`);

  // Period
  if (block.period) {
    lines.push(` ○ 기    간 : ${block.period}`);
  }

  // Target
  if (block.target) {
    lines.push(` ○ 대    상 : ${block.target}`);
  }

  // Location
  if (block.location) {
    lines.push(` ○ 장    소 : ${block.location}`);
  }

  // Contents
  if (block.contents && block.contents.length > 0) {
    if (block.contents.length === 1 && !block.contents[0].includes('\n')) {
      lines.push(` ○ 내    용 : ${block.contents[0]}`);
    } else {
      lines.push(` ○ 내    용`);
      for (const c of block.contents) {
        const sublines = c.split('\n').map((s) => s.trim()).filter(Boolean);
        for (const sub of sublines) {
          const bullet = sub.startsWith('-') ? sub : `   - ${sub}`;
          lines.push(bullet);
        }
      }
    }
  }

  // Metrics
  if (block.metrics) {
    const label = block.status === 'performance' ? '실    적' : '계    획';
    lines.push(` ○ ${label} : ${block.metrics}`);
  }

  return lines;
}

/**
 * Groups and sorts WeeklyWorkItemDto items by status and project order
 */
export function groupWeeklyItemsByProject(items: WeeklyWorkItemDto[]): {
  performance: WeeklyProjectBlock[];
  plan: WeeklyProjectBlock[];
} {
  const performance: WeeklyProjectBlock[] = [];
  const plan: WeeklyProjectBlock[] = [];

  for (const item of items) {
    const block: WeeklyProjectBlock = {
      projectOrder: item.projectOrder || 1,
      projectName: item.projectName,
      period: item.period,
      target: item.target,
      location: item.location,
      contents: Array.isArray(item.contents) ? item.contents : [],
      metrics: item.metrics,
      status: item.status,
    };

    if (item.status === 'performance') {
      performance.push(block);
    } else {
      plan.push(block);
    }
  }

  // Sort by projectOrder ascending
  performance.sort((a, b) => a.projectOrder - b.projectOrder);
  plan.sort((a, b) => a.projectOrder - b.projectOrder);

  return { performance, plan };
}

/**
 * Format project blocks into structured XML paragraph descriptors matching
 * Health Center Weekly Report Master Table typography (12pt Bold Blue #0000FF, 12pt Regular Black).
 */
export function buildWeeklyColumnParagraphs(
  blocks: WeeklyProjectBlock[],
  status: 'performance' | 'plan',
  periodLabel: string
): FormattedWeeklyColumn {
  const renderedParagraphs: FormattedWeeklyColumn['renderedParagraphs'] = [];

  for (let idx = 0; idx < blocks.length; idx++) {
    const block = blocks[idx];

    // Spacer paragraph before subsequent projects
    if (idx > 0) {
      renderedParagraphs.push({
        type: 'spacer',
        text: '',
        paraPrId: 54,
        charPrId: 42,
      });
    }

    // 1. Project Title (12pt Bold Blue #0000FF, Hancom Dotum)
    const titlePrefix = block.projectName.startsWith(`${block.projectOrder}.`)
      ? ''
      : `${block.projectOrder}. `;
    renderedParagraphs.push({
      type: 'title',
      text: `${titlePrefix}${block.projectName}`,
      paraPrId: 54,
      charPrId: 42,
    });

    // 2. Details (12pt Regular Black, Human Myeongjo)
    if (block.period) {
      renderedParagraphs.push({
        type: 'detail',
        text: ` ○ 기    간 : ${block.period}`,
        paraPrId: 53,
        charPrId: 45,
      });
    }

    if (block.target) {
      renderedParagraphs.push({
        type: 'detail',
        text: ` ○ 대    상 : ${block.target}`,
        paraPrId: 53,
        charPrId: 45,
      });
    }

    if (block.location) {
      renderedParagraphs.push({
        type: 'detail',
        text: ` ○ 장    소 : ${block.location}`,
        paraPrId: 53,
        charPrId: 45,
      });
    }

    if (block.contents && block.contents.length > 0) {
      if (block.contents.length === 1 && !block.contents[0].includes('\n')) {
        renderedParagraphs.push({
          type: 'detail',
          text: ` ○ 내    용 : ${block.contents[0]}`,
          paraPrId: 53,
          charPrId: 45,
        });
      } else {
        renderedParagraphs.push({
          type: 'detail',
          text: ` ○ 내    용`,
          paraPrId: 53,
          charPrId: 45,
        });
        for (const c of block.contents) {
          const sublines = c.split('\n').map((s) => s.trim()).filter(Boolean);
          for (const sub of sublines) {
            const bullet = sub.startsWith('-') ? sub : `   - ${sub}`;
            renderedParagraphs.push({
              type: 'bullet',
              text: bullet,
              paraPrId: 53,
              charPrId: 45,
            });
          }
        }
      }
    }

    if (block.metrics) {
      const label = status === 'performance' ? '실    적' : '계    획';
      renderedParagraphs.push({
        type: 'detail',
        text: ` ○ ${label} : ${block.metrics}`,
        paraPrId: 53,
        charPrId: 45,
      });
    }
  }

  return {
    status,
    periodLabel,
    blocks,
    renderedParagraphs,
  };
}

/**
 * Aggregates generic TaskDto tasks (from TASKS.json) into Wednesday batch items:
 * - Actuals: completed tasks in [W - 2, W + 4]
 * - Plan: todo/in-progress tasks in [W + 5, W + 11]
 */
export function aggregateTasksForWednesday(
  tasks: TaskDto[],
  targetDate: string | Date
): {
  periods: WednesdayBatchPeriods;
  weeklyReport: WeeklyReportDto;
} {
  const periods = computeWednesdayBatchPeriods(targetDate);
  const items: WeeklyWorkItemDto[] = [];

  // Categorize standard health promotion program categories to order
  const categoryOrderMap: Record<string, { order: number; name: string }> = {
    '서울체력장': { order: 8, name: '서울체력장 강남센터' },
    '체력인증센터': { order: 8, name: '서울체력장 강남센터' },
    '공공PT': { order: 9, name: '취약계층 공공 PT 프로그램' },
    '취약계층': { order: 9, name: '취약계층 공공 PT 프로그램' },
    '비만예방': { order: 10, name: '비만예방 및 걷기 챌린지' },
    '건강뜀': { order: 10, name: '비만예방 및 걷기 챌린지' },
    '모바일헬스케어': { order: 11, name: '손목닥터 및 모바일 헬스케어' },
    '손목닥터': { order: 11, name: '손목닥터 및 모바일 헬스케어' },
  };

  const resolveProject = (category: string) => {
    for (const [key, val] of Object.entries(categoryOrderMap)) {
      if (category.includes(key)) {
        return val;
      }
    }
    return { order: 12, name: category || '신체활동 증진사업' };
  };

  // Group by category for performance vs plan
  const perfMap = new Map<string, { order: number; tasks: TaskDto[] }>();
  const planMap = new Map<string, { order: number; tasks: TaskDto[] }>();

  for (const t of tasks) {
    const taskDate = t.dueDate || t.updatedAt.split('T')[0];
    const proj = resolveProject(t.category);

    if (t.status === 'done' && taskDate >= periods.performanceStart && taskDate <= periods.performanceEnd) {
      if (!perfMap.has(proj.name)) perfMap.set(proj.name, { order: proj.order, tasks: [] });
      perfMap.get(proj.name)!.tasks.push(t);
    } else if (
      t.status !== 'done' &&
      taskDate >= periods.planStart &&
      taskDate <= periods.planEnd
    ) {
      if (!planMap.has(proj.name)) planMap.set(proj.name, { order: proj.order, tasks: [] });
      planMap.get(proj.name)!.tasks.push(t);
    }
  }

  // Build performance items
  let itemIdx = 1;
  for (const [name, data] of perfMap.entries()) {
    items.push({
      id: `agg-perf-${itemIdx++}`,
      projectOrder: data.order,
      projectName: name,
      period: `${periods.performanceStart} ~ ${periods.performanceEnd}`,
      target: '관내 구민 및 대상자',
      location: '강남구보건소 및 관내',
      contents: data.tasks.map((t) => t.title + (t.description ? ` (${t.description})` : '')),
      metrics: `금주 ${data.tasks.length}건 추진 완료`,
      status: 'performance',
    });
  }

  // Build plan items
  for (const [name, data] of planMap.entries()) {
    items.push({
      id: `agg-plan-${itemIdx++}`,
      projectOrder: data.order,
      projectName: name,
      period: `${periods.planStart} ~ ${periods.planEnd}`,
      target: '관내 구민 및 예정 대상자',
      location: '강남구보건소 및 관내',
      contents: data.tasks.map((t) => t.title + (t.description ? ` (${t.description})` : '')),
      metrics: `차주 ${data.tasks.length}건 실행 예정`,
      status: 'plan',
    });
  }

  const weeklyReport: WeeklyReportDto = {
    id: `weekly-${periods.targetWednesday.replace(/-/g, '')}`,
    reportDate: periods.targetWednesday,
    departmentName: '보건행정과',
    teamTitle: '건강증진팀장 김지영',
    performancePeriod: periods.performanceLabel,
    planPeriod: periods.planLabel,
    items,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  return { periods, weeklyReport };
}
