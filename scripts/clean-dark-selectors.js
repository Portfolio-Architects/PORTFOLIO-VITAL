const fs = require('fs');
const path = require('path');

const targetFiles = [
  'src/components/dashboard/MobileMemoInbox.tsx',
  'src/components/dashboard/SchedulePresetSelector.tsx',
  'src/components/dashboard/scheduler/GoogleCalendarSyncModal.tsx',
  'src/components/dashboard/scheduler/MonthCell.tsx',
  'src/components/dashboard/scheduler/ScheduleForm.tsx',
  'src/components/dashboard/scheduler/ScheduleItem.tsx',
  'src/components/dashboard/scheduler/ScheduleModal.tsx',
  'src/components/dashboard/scheduler/TimetableSlotCell.tsx',
  'src/components/dashboard/scheduler/types.ts',
  'src/components/dashboard/scheduler/WeekDayColumn.tsx',
  'src/components/dashboard/WeeklyScheduler.tsx',
  'src/components/dashboard/WorkingMemoryContextBanner.tsx',
  'src/components/memory/WorkingMemoryPage.tsx',
  'src/components/project/ProjectManagementPage.tsx',
  'src/components/SemanticReviewModal.tsx',
  'src/components/WikiEditor.tsx',
  'src/components/WorkspaceView.tsx',
  'src/lib/working-memory-parser.ts'
];

// Matches any dark: prefix token within className or string literals
// e.g. dark:bg-slate-900, dark:hover:bg-slate-800, dark:border-slate-700/50, dark:text-slate-300
const darkTokenRegex = /\bdark:(?:[a-zA-Z0-9_\-\/\[\]#.%!]|:[a-zA-Z0-9_\-\/\[\]#.%!])+/g;

let totalRemoved = 0;

for (const relPath of targetFiles) {
  const fullPath = path.resolve(__dirname, '..', relPath);
  if (!fs.existsSync(fullPath)) {
    console.error('File not found:', fullPath);
    continue;
  }
  let content = fs.readFileSync(fullPath, 'utf8');
  const matches = content.match(darkTokenRegex) || [];
  totalRemoved += matches.length;

  // Replace each dark:... token cleanly:
  // If preceded by a space, remove the space + token
  // If followed by a space (at start of quote), remove token + space
  // Otherwise just remove token
  let updated = content.replace(/( +)\bdark:(?:[a-zA-Z0-9_\-\/\[\]#.%!]|:[a-zA-Z0-9_\-\/\[\]#.%!])+/g, '');
  updated = updated.replace(/\bdark:(?:[a-zA-Z0-9_\-\/\[\]#.%!]|:[a-zA-Z0-9_\-\/\[\]#.%!])+( +)/g, '');
  updated = updated.replace(/\bdark:(?:[a-zA-Z0-9_\-\/\[\]#.%!]|:[a-zA-Z0-9_\-\/\[\]#.%!])+/g, '');

  // Clean up any double spaces that might be left in string literals
  // (Carefully only within strings)
  updated = updated.replace(/(className\s*=\s*["'`])([^"'`]+)(["'`])/g, (match, prefix, cls, suffix) => {
    const cleanedCls = cls.replace(/ {2,}/g, ' ').trim();
    return `${prefix}${cleanedCls}${suffix}`;
  });

  fs.writeFileSync(fullPath, updated, 'utf8');
  console.log(`Cleaned ${matches.length} dark: tokens from ${relPath}`);
}

console.log(`\nTotal dark: tokens removed: ${totalRemoved}`);
