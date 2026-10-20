import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

let cachedBackupStats: { son: number; father: number; grandfather: number; total: number } | null = null;
let lastBackupStatsCheck = 0;

let cachedDiagnoseData: any = null;
let lastDiagnoseCheck = 0;

async function getBackupStats(): Promise<{ son: number; father: number; grandfather: number; total: number }> {
  const now = Date.now();
  // 60-second in-memory cache to prevent blocking file system recursion on every request
  if (cachedBackupStats && (now - lastBackupStatsCheck < 60000)) {
    return cachedBackupStats;
  }

  let sonCount = 0;
  let fatherCount = 0;
  let grandfatherCount = 0;

  const baseDir = path.join(process.cwd(), 'data', 'backups');
  try {
    const entries = await fs.readdir(baseDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory() && entry.name !== 'daily' && entry.name !== 'weekly') {
        const subFiles = await fs.readdir(path.join(baseDir, entry.name));
        sonCount += subFiles.filter(f => f.endsWith('.json') && !f.endsWith('.tmp')).length;
      }
    }

    const dailyDir = path.join(baseDir, 'daily');
    try {
      const dailyEntries = await fs.readdir(dailyDir, { withFileTypes: true });
      for (const entry of dailyEntries) {
        if (entry.isDirectory()) {
          const subFiles = await fs.readdir(path.join(dailyDir, entry.name));
          fatherCount += subFiles.filter(f => f.endsWith('.json') && !f.endsWith('.tmp')).length;
        }
      }
    } catch {}

    const weeklyDir = path.join(baseDir, 'weekly');
    try {
      const weeklyEntries = await fs.readdir(weeklyDir, { withFileTypes: true });
      for (const entry of weeklyEntries) {
        if (entry.isDirectory()) {
          const subFiles = await fs.readdir(path.join(weeklyDir, entry.name));
          grandfatherCount += subFiles.filter(f => f.endsWith('.json') && !f.endsWith('.tmp')).length;
        }
      }
    } catch {}
  } catch {}

  cachedBackupStats = {
    son: sonCount,
    father: fatherCount,
    grandfather: grandfatherCount,
    total: sonCount + fatherCount + grandfatherCount
  };
  lastBackupStatsCheck = now;

  return cachedBackupStats;
}

export async function GET() {
  try {
    const logs: Array<{ timestamp: string; level: 'info' | 'warn' | 'error'; message: string }> = [];
    const nowMs = Date.now();

    // 1. Next.js status & System Environment log entries
    const memUsage = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
    logs.push({
      timestamp: new Date().toISOString(),
      level: 'info',
      message: `[VITAL Daemon] Next.js dev server listening on port 3001. Heap: ${memUsage}MB.`
    });
    logs.push({
      timestamp: new Date(nowMs - 2000).toISOString(),
      level: 'info',
      message: `[Watcher Daemon] Disabled file auto-parsing daemon (Manual mindmap mode active).`
    });

    // 2. Read diagnose report (cached 15s)
    const diagnosePath = path.join(process.cwd(), 'data', 'diagnose_report.json');
    if (!cachedDiagnoseData || (nowMs - lastDiagnoseCheck > 15000)) {
      try {
        const diagRaw = await fs.readFile(diagnosePath, 'utf-8');
        cachedDiagnoseData = JSON.parse(diagRaw);
        lastDiagnoseCheck = nowMs;
      } catch {}
    }

    if (cachedDiagnoseData) {
      const diagTime = cachedDiagnoseData.timestamp || new Date().toISOString();
      const warnCount = cachedDiagnoseData.summary?.totalWarnings || 0;
      logs.push({
        timestamp: diagTime,
        level: warnCount > 0 ? 'warn' : 'info',
        message: `[Lint check] Compiled code syntax check. Warnings: ${warnCount}, Architectural Violations: ${cachedDiagnoseData.summary?.totalViolations || 0}, Bottlenecks: ${cachedDiagnoseData.summary?.totalBottlenecks || 0}.`
      });
    }

    // Sort logs ascending by timestamp and cap at latest 100 logs to guarantee instant UI rendering
    const sortedLogs = logs
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
      .slice(-100);
    const backupStats = await getBackupStats();

    return NextResponse.json({
      success: true,
      data: sortedLogs,
      daemonActive: false,
      watchDir: 'd:/Desktop',
      serverHeapMB: memUsage,
      backupStats
    });

  } catch (err: any) {
    console.error('[Logs API] Error fetching execution logs:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
