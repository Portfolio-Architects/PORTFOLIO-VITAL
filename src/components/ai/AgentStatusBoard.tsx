'use client';

import React, { useState } from 'react';
import { useAgentStatus, AgentStatus } from '@/hooks/useAgentStatus';
import { Bot, CheckCircle2, AlertCircle, RefreshCw, ChevronDown, ChevronUp, Radio } from 'lucide-react';

export function AgentStatusBoard() {
  const { statuses, resetAgentStatuses } = useAgentStatus();
  const [expandedFeedbackId, setExpandedFeedbackId] = useState<string | null>(null);

  // 에이전트 순서 정렬 (Planner -> Generator -> Evaluator)
  const order = ['planner', 'generator', 'evaluator'];
  const sortedStatuses = [...statuses].sort((a, b) => {
    const aIdx = order.indexOf(a.id.toLowerCase());
    const bIdx = order.indexOf(b.id.toLowerCase());
    return (aIdx === -1 ? 99 : aIdx) - (bIdx === -1 ? 99 : bIdx);
  });

  const getStatusStyle = (status: AgentStatus['status']) => {
    switch (status) {
      case 'running':
        return {
          bg: 'bg-blue-500/10 border-blue-200/60 shadow-[0_0_18px_rgba(59,130,246,0.12)]',
          text: 'text-blue-700',
          badge: 'bg-blue-500/15 text-blue-700 border border-blue-500/20',
          icon: <RefreshCw className="animate-spin text-blue-500" size={16} />
        };
      case 'success':
        return {
          bg: 'bg-emerald-500/10 border-emerald-200/50 shadow-[0_0_15px_rgba(16,185,129,0.08)]',
          text: 'text-emerald-700',
          badge: 'bg-emerald-500/15 text-emerald-700 border border-emerald-500/20',
          icon: <CheckCircle2 className="text-emerald-500 animate-pulse" size={16} />
        };
      case 'failed':
        return {
          bg: 'bg-rose-500/10 border-rose-200/50 shadow-[0_0_15px_rgba(239,68,68,0.08)]',
          text: 'text-rose-700',
          badge: 'bg-rose-500/15 text-rose-700 border border-rose-500/20',
          icon: <AlertCircle className="text-rose-500" size={16} />
        };
      default:
        return {
          bg: 'bg-white/95 border-slate-200/50',
          text: 'text-slate-500',
          badge: 'bg-slate-100/80 text-slate-600 border border-slate-200/30',
          icon: <Radio className="text-slate-400" size={16} />
        };
    }
  };

  const toggleFeedback = (id: string) => {
    setExpandedFeedbackId(expandedFeedbackId === id ? null : id);
  };

  return (
    <div className="flex flex-col glass-panel border border-white/30 rounded-2xl p-4 shadow-xl max-w-sm w-full animate-in fade-in slide-in-from-right-5 duration-300">
      {/* Header */}
      <div className="flex justify-between items-center mb-3.5 pb-2.5 border-b border-slate-200/50">
        <div className="flex items-center gap-1.5">
          <Bot size={18} className="text-blue-500" />
          <span className="text-xs font-bold text-slate-800 tracking-wide uppercase font-sans">AI Agents Live Status</span>
        </div>
        <div className="flex items-center gap-2">
          {/* Live indicator sync with partykit */}
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-[10px] font-semibold text-emerald-600">Sync Active</span>
          </div>
          {statuses.length > 0 && (
            <button 
              onClick={resetAgentStatuses}
              className="text-[10px] font-bold text-slate-400 hover:text-slate-600 transition-colors"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Empty State */}
      {sortedStatuses.length === 0 ? (
        <div className="py-6 text-center text-xs text-slate-400 font-semibold flex flex-col items-center gap-2">
          <Bot size={28} className="text-slate-300 animate-bounce" />
          <span>No agents active. Start a task to monitor.</span>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {sortedStatuses.map((agent) => {
            const style = getStatusStyle(agent.status);
            const isExpanded = expandedFeedbackId === agent.id;

            return (
              <div 
                key={agent.id} 
                className={`flex flex-col border rounded-xl overflow-hidden transition-colors duration-300 ${style.bg}`}
              >
                {/* Main Content */}
                <div className="flex items-center justify-between p-3 gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="shrink-0">
                      {style.icon}
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-slate-800">{agent.name}</span>
                      {agent.currentStep && (
                        <span className="text-[10px] text-slate-500 font-semibold truncate max-w-[160px]">
                          {agent.currentStep}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {agent.attempts !== undefined && (
                      <span className="text-[10px] font-semibold text-slate-400 bg-white/60 px-1.5 py-0.5 rounded border border-slate-200/40">
                        {agent.attempts}/{agent.maxAttempts || 3}
                      </span>
                    )}
                    <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full ${style.badge}`}>
                      {agent.status}
                    </span>
                    {agent.feedback && (
                      <button 
                        onClick={() => toggleFeedback(agent.id)}
                        className="text-slate-400 hover:text-slate-650 transition-colors"
                      >
                        {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </button>
                    )}
                  </div>
                </div>

                {/* Expanded Feedback Panel (Loud Failure details or suggestions) */}
                {isExpanded && agent.feedback && (
                  <div className="px-3 pb-3 pt-1 border-t border-slate-200/20 bg-black/[0.01] text-[10px] font-semibold text-slate-600 leading-normal whitespace-pre-wrap">
                    <div className="font-semibold text-slate-500 mb-1">Feedback Context:</div>
                    {agent.feedback}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
