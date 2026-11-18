const fs = require('fs');
const path = require('path');

const blurReplacements = [
  {
    file: 'src/components/ai/AgentStatusBoard.tsx',
    edits: [
      { from: "bg: 'bg-blue-500/10 border-blue-200/60 shadow-[0_0_18px_rgba(59,130,246,0.12)] backdrop-blur-xs'", to: "bg: 'bg-blue-500/10 border-blue-200/60 shadow-[0_0_18px_rgba(59,130,246,0.12)]'" },
      { from: "bg: 'bg-emerald-500/10 border-emerald-200/50 shadow-[0_0_15px_rgba(16,185,129,0.08)] backdrop-blur-xs'", to: "bg: 'bg-emerald-500/10 border-emerald-200/50 shadow-[0_0_15px_rgba(16,185,129,0.08)]'" },
      { from: "bg: 'bg-rose-500/10 border-rose-200/50 shadow-[0_0_15px_rgba(239,68,68,0.08)] backdrop-blur-xs'", to: "bg: 'bg-rose-500/10 border-rose-200/50 shadow-[0_0_15px_rgba(239,68,68,0.08)]'" },
      { from: "bg: 'bg-white/40 border-slate-200/50 backdrop-blur-xs'", to: "bg: 'bg-white/95 border-slate-200/50'" }
    ]
  },
  {
    file: 'src/components/ai/AIAssistantModal.tsx',
    edits: [
      { from: 'bg-white/30 backdrop-blur-xs', to: 'bg-white/95' },
      { from: 'bg-white/30 backdrop-blur-xs', to: 'bg-white/95' },
      { from: 'bg-white/50 backdrop-blur-xs', to: 'bg-white/95' }
    ]
  },
  {
    file: 'src/components/AppLogModal.tsx',
    edits: [
      { from: 'bg-slate-900/40 backdrop-blur-xs', to: 'bg-slate-900/60' }
    ]
  },
  {
    file: 'src/components/budget/BudgetSimulator.tsx',
    edits: [
      { from: 'bg-slate-900/40 backdrop-blur-xs', to: 'bg-slate-900/60' }
    ]
  },
  {
    file: 'src/components/budget/ui/ExpenseBatchToolbar.tsx',
    edits: [
      { from: 'bg-slate-900/95 backdrop-blur-md', to: 'bg-slate-900/95' }
    ]
  },
  {
    file: 'src/components/budget/ui/SimulationBurnUpChart.tsx',
    edits: [
      { from: 'bg-white/95 backdrop-blur-xs', to: 'bg-white/95' }
    ]
  },
  {
    file: 'src/components/budget/ui/StatItemDetailModal.tsx',
    edits: [
      { from: 'bg-slate-50/95 backdrop-blur-xs', to: 'bg-slate-50' },
      { from: 'bg-slate-50/95 backdrop-blur-xs', to: 'bg-slate-50' }
    ]
  },
  {
    file: 'src/components/dashboard/SchedulePresetSelector.tsx',
    edits: [
      { from: 'bg-black/50 backdrop-blur-xs', to: 'bg-slate-900/60' }
    ]
  },
  {
    file: 'src/components/dashboard/scheduler/GoogleCalendarSyncModal.tsx',
    edits: [
      { from: 'bg-black/50 backdrop-blur-xs', to: 'bg-slate-900/60' }
    ]
  },
  {
    file: 'src/components/dashboard/scheduler/ScheduleForm.tsx',
    edits: [
      { from: ' backdrop-blur-xs', to: '' }
    ]
  },
  {
    file: 'src/components/dashboard/scheduler/ScheduleModal.tsx',
    edits: [
      { from: 'bg-black/50 backdrop-blur-xs', to: 'bg-slate-900/60' }
    ]
  },
  {
    file: 'src/components/festival/yangjae/SecurityPinModal.tsx',
    edits: [
      { from: 'bg-slate-900/60 backdrop-blur-xs', to: 'bg-slate-900/60' }
    ]
  },
  {
    file: 'src/components/festival/yangjae/SubTaskTransferModal.tsx',
    edits: [
      { from: 'bg-slate-950/60 backdrop-blur-xs', to: 'bg-slate-900/60' }
    ]
  },
  {
    file: 'src/components/law/LawSearchPanel.tsx',
    edits: [
      { from: 'bg-white/60 backdrop-blur-md', to: 'bg-white/95' },
      { from: 'bg-black/45 backdrop-blur-xs', to: 'bg-slate-900/60' }
    ]
  },
  {
    file: 'src/components/law/LawSystemPage.tsx',
    edits: [
      { from: 'bg-white/70 backdrop-blur-xs', to: 'bg-white/95' }
    ]
  },
  {
    file: 'src/components/ontology/AdminOntologyDrawer.tsx',
    edits: [
      { from: 'bg-slate-900/95 backdrop-blur-md', to: 'bg-slate-900/95' }
    ]
  },
  {
    file: 'src/components/ontology/AdminOntologyExplorer.tsx',
    edits: [
      { from: 'bg-slate-900/80 backdrop-blur', to: 'bg-slate-900/95' }
    ]
  },
  {
    file: 'src/components/project/ProjectManagementPage.tsx',
    edits: [
      { from: 'bg-black/50 backdrop-blur-xs', to: 'bg-slate-900/60' },
      { from: 'bg-black/50 backdrop-blur-xs', to: 'bg-slate-900/60' }
    ]
  },
  {
    file: 'src/components/QuickInput.tsx',
    edits: [
      { from: 'bg-slate-900/95 backdrop-blur-md', to: 'bg-slate-900/95' }
    ]
  },
  {
    file: 'src/components/SearchResultModal.tsx',
    edits: [
      { from: 'bg-white/70 backdrop-blur-xs', to: 'bg-white/95' },
      { from: 'bg-white/70 backdrop-blur-xs', to: 'bg-white/95' },
      { from: 'bg-black/50 backdrop-blur-md', to: 'bg-slate-900/60' }
    ]
  },
  {
    file: 'src/components/SemanticReviewModal.tsx',
    edits: [
      { from: 'bg-slate-900/60 backdrop-blur-md', to: 'bg-slate-900/60' }
    ]
  },
  {
    file: 'src/components/weekly/WeeklyReportManager.tsx',
    edits: [
      { from: 'bg-slate-900/60 backdrop-blur-sm', to: 'bg-slate-900/60' }
    ]
  }
];

let replacedCount = 0;
for (const entry of blurReplacements) {
  const fullPath = path.resolve(__dirname, '..', entry.file);
  let content = fs.readFileSync(fullPath, 'utf8');
  for (const edit of entry.edits) {
    if (!content.includes(edit.from)) {
      console.error(`Target not found in ${entry.file}: "${edit.from}"`);
      continue;
    }
    content = content.replace(edit.from, edit.to);
    replacedCount++;
  }
  fs.writeFileSync(fullPath, content, 'utf8');
  console.log(`Updated blur occurrences in ${entry.file}`);
}

console.log(`\nTotal backdrop-blur replacements executed: ${replacedCount}`);
