import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import {
  computeWednesdayBatchPeriods,
  aggregateTasksForWednesday,
  WednesdayBatchPeriods,
} from '@/lib/weekly/wednesday-batcher';
import {
  WeeklyReportSchema,
  WeeklyReportDto,
  TaskSchema,
  TaskDto,
} from '@/lib/schemas';
import { withLock, readSheetData, writeSheetData } from '@/lib/server/storage-service';

const execFileAsync = promisify(execFile);

async function loadAllWeeklyReports(): Promise<WeeklyReportDto[]> {
  try {
    const raw = await readSheetData<WeeklyReportDto[]>('WEEKLY_REPORTS', { fallback: [] });
    if (Array.isArray(raw)) {
      return raw.map((item) => WeeklyReportSchema.parse(item));
    }
  } catch {
    // If not found or empty, return empty array
  }
  return [];
}

async function loadTasks(): Promise<TaskDto[]> {
  try {
    const raw = await readSheetData<TaskDto[]>('TASKS', { fallback: [] });
    if (Array.isArray(raw)) {
      return raw.map((item) => TaskSchema.parse(item));
    }
  } catch {
    // Return empty array
  }
  return [];
}

/**
 * GET /api/weekly-report
 * Query params:
 * - date: YYYY-MM-DD reference date (defaults to current week's Wednesday)
 * - download: boolean ("true" to download .hwpx)
 * - aggregate: boolean ("true" to aggregate from TASKS.json)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get('date') || new Date().toISOString().split('T')[0];
    const isDownload = searchParams.get('download') === 'true' || searchParams.get('format') === 'hwpx';
    const isAggregate = searchParams.get('aggregate') === 'true';

    const periods: WednesdayBatchPeriods = computeWednesdayBatchPeriods(dateParam);
    const targetWed = periods.targetWednesday;

    const allReports = await loadAllWeeklyReports();
    let currentReport = allReports.find((r) => r.reportDate === targetWed);

    // If no stored report for this Wednesday and aggregate requested, compute from TASKS.json
    if (!currentReport || isAggregate) {
      const tasks = await loadTasks();
      const aggregated = aggregateTasksForWednesday(tasks, targetWed);
      if (!currentReport) {
        currentReport = aggregated.weeklyReport;
      }
    }

    // Fallback: If still no report, create an empty structured report skeleton
    if (!currentReport) {
      currentReport = {
        id: `weekly-${targetWed.replace(/-/g, '')}`,
        reportDate: targetWed,
        departmentName: '보건행정과',
        teamTitle: '건강증진팀장 김지영',
        performancePeriod: periods.performanceLabel,
        planPeriod: periods.planLabel,
        items: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }

    // Handle HWPX Binary Download
    if (isDownload) {
      const pythonBin = process.platform === 'win32' ? 'python' : 'python3';
      const scriptPath = path.join(process.cwd(), 'scripts', 'generate_weekly_hwpx.py');

      const tempId = `hwpx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const tempJsonPath = path.join(process.cwd(), 'scratch', `${tempId}.json`);
      const tempHwpxPath = path.join(process.cwd(), 'scratch', `${tempId}.hwpx`);

      await fs.mkdir(path.join(process.cwd(), 'scratch'), { recursive: true });
      await fs.writeFile(tempJsonPath, JSON.stringify([currentReport], null, 2), 'utf-8');

      try {
        await execFileAsync(pythonBin, [
          scriptPath,
          '--date',
          targetWed,
          '--data',
          tempJsonPath,
          '--output',
          tempHwpxPath,
        ]);

        const fileBuffer = await fs.readFile(tempHwpxPath);
        const filename = `(${targetWed.replace(/-/g, '')}) 보건소 주간 업무실적 및 계획(건강증진팀)_신체활동.hwpx`;

        return new NextResponse(fileBuffer, {
          status: 200,
          headers: {
            'Content-Type': 'application/hwp+zip',
            'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
            'Cache-Control': 'no-store',
          },
        });
      } finally {
        await fs.unlink(tempJsonPath).catch(() => {});
        await fs.unlink(tempHwpxPath).catch(() => {});
      }
    }

    return NextResponse.json({
      success: true,
      periods,
      currentReport,
      allReports,
    });
  } catch (error: any) {
    console.error('[API WEEKLY-REPORT ERROR]', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to process weekly report' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/weekly-report
 * Actions:
 * - "save-report": Save or update report in data/WEEKLY_REPORTS.json
 * - "generate-hwpx": Generate and return binary HWPX for the given payload
 * - "aggregate": Aggregate tasks from data/TASKS.json
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const action = body.action || 'save-report';

    if (action === 'generate-hwpx') {
      const reportInput = body.report || body;
      const parsedReport = WeeklyReportSchema.parse(reportInput);

      const pythonBin = process.platform === 'win32' ? 'python' : 'python3';
      const scriptPath = path.join(process.cwd(), 'scripts', 'generate_weekly_hwpx.py');

      const tempId = `hwpx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const tempJsonPath = path.join(process.cwd(), 'scratch', `${tempId}.json`);
      const tempHwpxPath = path.join(process.cwd(), 'scratch', `${tempId}.hwpx`);

      await fs.mkdir(path.join(process.cwd(), 'scratch'), { recursive: true });
      await fs.writeFile(tempJsonPath, JSON.stringify([parsedReport], null, 2), 'utf-8');

      try {
        await execFileAsync(pythonBin, [
          scriptPath,
          '--date',
          parsedReport.reportDate,
          '--data',
          tempJsonPath,
          '--output',
          tempHwpxPath,
        ]);

        const fileBuffer = await fs.readFile(tempHwpxPath);
        const filename = `(${parsedReport.reportDate.replace(/-/g, '')}) 보건소 주간 업무실적 및 계획(건강증진팀)_신체활동.hwpx`;

        return new NextResponse(fileBuffer, {
          status: 200,
          headers: {
            'Content-Type': 'application/hwp+zip',
            'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
            'Cache-Control': 'no-store',
          },
        });
      } finally {
        await fs.unlink(tempJsonPath).catch(() => {});
        await fs.unlink(tempHwpxPath).catch(() => {});
      }
    }

    if (action === 'save-report') {
      const reportInput = body.report || body;
      const parsedReport = WeeklyReportSchema.parse(reportInput);

      return await withLock('WEEKLY_REPORTS', async () => {
        const allReports = await loadAllWeeklyReports();
        const existingIdx = allReports.findIndex((r) => r.id === parsedReport.id || r.reportDate === parsedReport.reportDate);

        const updatedReport: WeeklyReportDto = {
          ...parsedReport,
          updatedAt: new Date().toISOString(),
        };

        if (existingIdx >= 0) {
          allReports[existingIdx] = updatedReport;
        } else {
          allReports.unshift(updatedReport);
        }

        await writeSheetData('WEEKLY_REPORTS', allReports);

        return NextResponse.json({
          success: true,
          report: updatedReport,
          totalReports: allReports.length,
        });
      });
    }

    if (action === 'aggregate') {
      const date = body.date || new Date().toISOString().split('T')[0];
      const tasks = await loadTasks();
      const aggregated = aggregateTasksForWednesday(tasks, date);

      return NextResponse.json({
        success: true,
        periods: aggregated.periods,
        report: aggregated.weeklyReport,
      });
    }

    return NextResponse.json({ success: false, error: `Unknown action: ${action}` }, { status: 400 });
  } catch (error: any) {
    console.error('[API WEEKLY-REPORT POST ERROR]', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to execute weekly report action' },
      { status: 500 }
    );
  }
}
