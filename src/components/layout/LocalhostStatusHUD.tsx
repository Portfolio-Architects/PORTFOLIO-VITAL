'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { useLocalhostHealth } from '@/hooks/useLocalhostHealth';
import { 
  Activity, 
  Server, 
  Database, 
  Cpu, 
  FolderGit2, 
  Terminal, 
  X, 
  RotateCw, 
  Wifi, 
  WifiOff, 
  RefreshCw
} from 'lucide-react';

interface LocalhostStatusHUDProps {
  onOpenLogs?: () => void;
}

function LocalhostStatusHUDComponent({ onOpenLogs }: LocalhostStatusHUDProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { data: health, isLoading, isFetching, refetch } = useLocalhostHealth(true);

  const status = health?.port3001.status || (isLoading ? 'online' : 'offline');
  const serverPort = health?.port3001.port ?? 3001;
  const isOnline = health?.offlineSync.isOnline ?? true;
  const crdtSynced = health?.offlineSync.crdtSynced ?? true;
  const clientMB = health?.heapMemory.clientMB ?? null;
  const serverMB = health?.heapMemory.serverMB ?? null;
  const displayHeapMB = clientMB || serverMB || 0;
  const totalBackups = health?.backups.total ?? 0;

  const handleOpenModal = useCallback(() => setIsModalOpen(true), []);
  const handleCloseModal = useCallback(() => setIsModalOpen(false), []);
  const handleRefetch = useCallback(() => { refetch(); }, [refetch]);

  const handleOpenLogsAction = useCallback(() => {
    setIsModalOpen(false);
    onOpenLogs?.();
  }, [onOpenLogs]);

  // LED status styling memoization
  const statusColor = useMemo(() => {
    if (status === 'offline') return 'rose';
    if (status === 'degraded' || !isOnline || !crdtSynced) return 'amber';
    return 'emerald';
  }, [status, isOnline, crdtSynced]);

  return (
    <>
      {/* Minimalist Compact Status Badge in Header */}
      <button
        type="button"
        onClick={handleOpenModal}
        className="flex items-center gap-2 px-3 py-1.5 bg-slate-50/90 hover:bg-slate-100 border border-slate-200/80 hover:border-slate-300 rounded-lg text-xs font-medium text-slate-700 shadow-2xs transition-colors select-none cursor-pointer group"
        title="Localhost Health & Daemon Status HUD"
        suppressHydrationWarning
      >
        <span className="relative flex h-2 w-2" suppressHydrationWarning>
          <span
            className={`relative inline-flex rounded-full h-2 w-2 ${
              statusColor === 'emerald'
                ? 'bg-emerald-500'
                : statusColor === 'amber'
                ? 'bg-amber-500'
                : 'bg-rose-500'
            }`}
          />
        </span>

        <div className="flex items-center gap-1.5 text-[11px] font-mono tabular-nums" suppressHydrationWarning>
          <span className="font-semibold text-slate-900" suppressHydrationWarning>{serverPort}</span>
          <span className="text-slate-300">·</span>
          <span className="text-slate-600" suppressHydrationWarning>{displayHeapMB}MB</span>
          <span className="text-slate-300">·</span>
          <span className="text-slate-600" suppressHydrationWarning>Bk:{totalBackups}</span>
        </div>

        {isOnline ? (
          <Wifi className="w-3 h-3 text-emerald-600 shrink-0" />
        ) : (
          <WifiOff className="w-3 h-3 text-rose-500 shrink-0" />
        )}
      </button>

      {/* Expanded Minimalist HUD Modal */}
      {isModalOpen && (
        <div 
          className="fixed inset-0 z-[120] bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={handleCloseModal}
        >
          <div
            className="bg-white border border-slate-200/90 text-slate-900 shadow-xl rounded-xl max-w-xl w-full p-5 sm:p-6 space-y-4 relative"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-slate-100 rounded-lg border border-slate-200/80 text-slate-700">
                  <Activity className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2 tracking-tight">
                    Localhost Health & Daemon Status HUD
                  </h2>
                  <p className="text-[11px] text-slate-500 font-mono tabular-nums mt-0.5">
                    Port {serverPort} · Latency: {health?.port3001.latencyMs ?? 0}ms · Refetch: 5000ms
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleRefetch}
                  disabled={isFetching}
                  className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg border border-transparent hover:border-slate-200/80 transition-colors cursor-pointer"
                  title="수동 새로고침"
                >
                  <RotateCw className={`w-4 h-4 ${isFetching ? 'animate-spin text-slate-900' : ''}`} />
                </button>
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg border border-transparent hover:border-slate-200/80 transition-colors cursor-pointer"
                  title="닫기"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Grid 1: Server Status & Connection */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-50/70 border border-slate-200/80 rounded-xl p-3.5 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Server className="w-4 h-4 text-slate-600" />
                  <div>
                    <div className="text-[11px] font-medium text-slate-500">Dev Server (Port {serverPort})</div>
                    <div className={`text-xs font-semibold font-mono tabular-nums flex items-center gap-1.5 mt-0.5 ${
                      status === 'online'
                        ? 'text-emerald-700'
                        : status === 'degraded'
                        ? 'text-amber-700'
                        : 'text-rose-600'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        status === 'online'
                          ? 'bg-emerald-500'
                          : status === 'degraded'
                          ? 'bg-amber-500'
                          : 'bg-rose-500'
                      }`} />
                      {status.toUpperCase()} ({health?.port3001.latencyMs ?? 0}ms)
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-slate-50/70 border border-slate-200/80 rounded-xl p-3.5 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  {isOnline ? (
                    <Wifi className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <WifiOff className="w-4 h-4 text-rose-500" />
                  )}
                  <div>
                    <div className="text-[11px] font-medium text-slate-500">Offline & CRDT Sync</div>
                    <div className={`text-xs font-semibold font-mono tabular-nums flex items-center gap-1.5 mt-0.5 ${
                      isOnline ? 'text-emerald-700' : 'text-rose-600'
                    }`}>
                      {isOnline
                        ? `ONLINE (${crdtSynced ? 'CRDT Synced' : 'Syncing'})`
                        : `OFFLINE (${health?.offlineSync.pendingCount ?? 0} Pending)`}
                    </div>
                  </div>
                </div>
                <RefreshCw className={`w-3.5 h-3.5 text-slate-400 ${crdtSynced ? '' : 'animate-spin text-amber-600'}`} />
              </div>
            </div>

            {/* Section 2: Memory Gauges */}
            <div className="bg-slate-50/70 border border-slate-200/80 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                  <Cpu className="w-4 h-4 text-slate-600" />
                  <span>Heap Memory Monitoring (MB)</span>
                </div>
                <span className="text-[11px] font-mono tabular-nums text-slate-500">
                  Total Active: <strong className="text-slate-900">{health?.heapMemory.totalMB ?? displayHeapMB} MB</strong>
                </span>
              </div>

              {/* Client Gauge */}
              <div className="space-y-1">
                <div className="flex justify-between text-[11px] font-mono tabular-nums">
                  <span className="text-slate-500">Browser JS Heap (Client):</span>
                  <span className="text-slate-800 font-semibold">{clientMB !== null ? `${clientMB} MB` : 'N/A'}</span>
                </div>
                <div className="w-full h-1.5 bg-slate-200/80 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-slate-800 rounded-full transition-all duration-300"
                    style={{ width: `${Math.min(100, Math.max(10, ((clientMB || 0) / 300) * 100))}%` }}
                  />
                </div>
              </div>

              {/* Server Gauge */}
              <div className="space-y-1">
                <div className="flex justify-between text-[11px] font-mono tabular-nums">
                  <span className="text-slate-500">Next.js Dev Heap (Server):</span>
                  <span className="text-slate-800 font-semibold">{serverMB !== null ? `${serverMB} MB` : 'N/A'}</span>
                </div>
                <div className="w-full h-1.5 bg-slate-200/80 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-600 rounded-full transition-all duration-300"
                    style={{ width: `${Math.min(100, Math.max(10, ((serverMB || 0) / 400) * 100))}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Section 3: Auto-Backup Tier Stats */}
            <div className="bg-slate-50/70 border border-slate-200/80 rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                <Database className="w-4 h-4 text-slate-600" />
                <span>Auto-Backup Tiers (다중 계층 이력 보존)</span>
              </div>

              <div className="grid grid-cols-4 gap-2">
                <div className="bg-white border border-slate-200/80 rounded-lg p-2.5 text-center shadow-2xs">
                  <div className="text-[10px] text-slate-500 font-medium">Son Tier</div>
                  <div className="text-sm font-bold font-mono tabular-nums text-slate-900 mt-0.5">
                    {health?.backups.son ?? 0}
                  </div>
                  <div className="text-[9px] text-slate-400 mt-0.5">최근 20회</div>
                </div>

                <div className="bg-white border border-slate-200/80 rounded-lg p-2.5 text-center shadow-2xs">
                  <div className="text-[10px] text-slate-500 font-medium">Father Tier</div>
                  <div className="text-sm font-bold font-mono tabular-nums text-slate-900 mt-0.5">
                    {health?.backups.father ?? 0}
                  </div>
                  <div className="text-[9px] text-slate-400 mt-0.5">일별 7일</div>
                </div>

                <div className="bg-white border border-slate-200/80 rounded-lg p-2.5 text-center shadow-2xs">
                  <div className="text-[10px] text-slate-500 font-medium">Grandfather</div>
                  <div className="text-sm font-bold font-mono tabular-nums text-slate-900 mt-0.5">
                    {health?.backups.grandfather ?? 0}
                  </div>
                  <div className="text-[9px] text-slate-400 mt-0.5">주별 4주</div>
                </div>

                <div className="bg-white border border-slate-200/80 rounded-lg p-2.5 text-center shadow-2xs">
                  <div className="text-[10px] text-slate-500 font-medium">Total Count</div>
                  <div className="text-sm font-bold font-mono tabular-nums text-emerald-700 mt-0.5">
                    {totalBackups}
                  </div>
                  <div className="text-[9px] text-slate-400 mt-0.5">전체 백업</div>
                </div>
              </div>
            </div>

            {/* Section 4: File Watcher & Path */}
            <div className="bg-slate-50/70 border border-slate-200/80 rounded-xl p-3.5 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <FolderGit2 className="w-4 h-4 text-slate-600 shrink-0" />
                <div>
                  <span className="text-slate-500">File Watcher Target:</span>
                  <code className="ml-2 px-2 py-0.5 bg-white border border-slate-200/80 rounded text-[11px] font-mono text-slate-800">
                    {health?.fileWatcher.path ?? 'd:/Desktop'}
                  </code>
                </div>
              </div>
              <span className="text-[11px] font-mono text-slate-500">
                Mode: {health?.fileWatcher.active ? 'Active' : 'Manual'}
              </span>
            </div>

            {/* Modal Footer / Daemon Logs Action */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <span className="text-[11px] font-mono tabular-nums text-slate-400">
                Last probe: {health?.offlineSync.lastSyncedAt ?? 'Just now'}
              </span>

              {onOpenLogs && (
                <button
                  type="button"
                  onClick={handleOpenLogsAction}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold transition-colors shadow-2xs cursor-pointer"
                >
                  <Terminal className="w-3.5 h-3.5" />
                  <span>구동 로그 전체 보기 (Daemon Logs)</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

LocalhostStatusHUDComponent.displayName = 'LocalhostStatusHUD';
export const LocalhostStatusHUD = React.memo(LocalhostStatusHUDComponent);

