import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import fs from 'fs';
import path from 'path';

import { ExpenseBatchToolbar } from '@/components/budget/ui/ExpenseBatchToolbar';
import { SecurityPinModal } from '@/components/festival/yangjae/SecurityPinModal';
import { SubTaskTransferModal } from '@/components/festival/yangjae/SubTaskTransferModal';

function collectComponentFiles(dir: string): string[] {
  let results: string[] = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      results = results.concat(collectComponentFiles(fullPath));
    } else if (/\.(tsx?|jsx?)$/.test(file)) {
      results.push(fullPath);
    }
  }
  return results;
}

describe('Empirical Style Regression & Transition Stress Test (Challenger M4-1)', () => {
  const rootDir = process.cwd();
  const componentsDir = path.join(rootDir, 'src', 'components');
  const parserFile = path.join(rootDir, 'src', 'lib', 'working-memory-parser.ts');
  const componentFiles = collectComponentFiles(componentsDir);

  describe('Adversarial Static Scans', () => {
    test('Zero `dark:` selectors exist across src/components and working-memory-parser.ts', () => {
      const filesToScan = [...componentFiles, parserFile];
      const violations: Array<{ file: string; line: number; text: string }> = [];

      for (const file of filesToScan) {
        if (!fs.existsSync(file)) continue;
        const content = fs.readFileSync(file, 'utf-8');
        const lines = content.split('\n');
        lines.forEach((line, index) => {
          if (/dark:/.test(line)) {
            violations.push({
              file: path.relative(rootDir, file),
              line: index + 1,
              text: line.trim()
            });
          }
        });
      }

      expect(violations).toEqual([]);
      expect(violations.length).toBe(0);
    });

    test('Zero `backdrop-blur` occurrences exist across all files in src/components', () => {
      const violations: Array<{ file: string; line: number; text: string }> = [];

      for (const file of componentFiles) {
        const content = fs.readFileSync(file, 'utf-8');
        const lines = content.split('\n');
        lines.forEach((line, index) => {
          if (/backdrop-blur/.test(line)) {
            violations.push({
              file: path.relative(rootDir, file),
              line: index + 1,
              text: line.trim()
            });
          }
        });
      }

      expect(violations).toEqual([]);
      expect(violations.length).toBe(0);
    });

    test('Solid and translucent fallbacks exist across cataloged modal and toolbar files', () => {
      const checkPairs: Array<{ file: string; expectedRegex: RegExp }> = [
        { file: 'src/components/AppLogModal.tsx', expectedRegex: /bg-slate-900\/60/ },
        { file: 'src/components/budget/BudgetSimulator.tsx', expectedRegex: /bg-slate-900\/60/ },
        { file: 'src/components/budget/ui/ExpenseBatchToolbar.tsx', expectedRegex: /bg-slate-900\/95/ },
        { file: 'src/components/budget/ui/SimulationBurnUpChart.tsx', expectedRegex: /bg-white\/95/ },
        { file: 'src/components/budget/ui/StatItemDetailModal.tsx', expectedRegex: /bg-slate-50/ },
        { file: 'src/components/dashboard/SchedulePresetSelector.tsx', expectedRegex: /bg-slate-900\/60/ },
        { file: 'src/components/dashboard/scheduler/GoogleCalendarSyncModal.tsx', expectedRegex: /bg-slate-900\/60/ },
        { file: 'src/components/dashboard/scheduler/ScheduleModal.tsx', expectedRegex: /bg-slate-900\/60/ },
        { file: 'src/components/festival/yangjae/SecurityPinModal.tsx', expectedRegex: /bg-slate-900\/60/ },
        { file: 'src/components/festival/yangjae/SubTaskTransferModal.tsx', expectedRegex: /bg-slate-900\/60/ },
        { file: 'src/components/law/LawSearchPanel.tsx', expectedRegex: /bg-white\/95/ },
        { file: 'src/components/law/LawSystemPage.tsx', expectedRegex: /bg-white\/95/ },
        { file: 'src/components/ontology/AdminOntologyDrawer.tsx', expectedRegex: /bg-slate-900\/95/ },
        { file: 'src/components/ontology/AdminOntologyExplorer.tsx', expectedRegex: /bg-slate-900\/95/ },
        { file: 'src/components/project/ProjectManagementPage.tsx', expectedRegex: /bg-slate-900\/60/ },
        { file: 'src/components/QuickInput.tsx', expectedRegex: /bg-slate-900\/95/ },
        { file: 'src/components/SearchResultModal.tsx', expectedRegex: /bg-white\/95/ },
        { file: 'src/components/SemanticReviewModal.tsx', expectedRegex: /bg-slate-900\/60/ },
        { file: 'src/components/weekly/WeeklyReportManager.tsx', expectedRegex: /bg-slate-900\/60/ },
      ];

      for (const pair of checkPairs) {
        const fullPath = path.join(rootDir, pair.file);
        expect(fs.existsSync(fullPath)).toBe(true);
        const content = fs.readFileSync(fullPath, 'utf-8');
        expect(content).toMatch(pair.expectedRegex);
      }
    });

    test('transition-all is restricted only to preserved YangjaeFestivalDashboard test selectors', () => {
      const transitionAllMatches: Array<{ file: string; line: number; text: string }> = [];

      for (const file of componentFiles) {
        const content = fs.readFileSync(file, 'utf-8');
        const lines = content.split('\n');
        lines.forEach((line, index) => {
          if (/\btransition-all\b/.test(line)) {
            transitionAllMatches.push({
              file: path.relative(rootDir, file).replace(/\\/g, '/'),
              line: index + 1,
              text: line.trim()
            });
          }
        });
      }

      // Exactly 2 occurrences should exist, and both must be in YangjaeFestivalDashboard.tsx
      expect(transitionAllMatches.length).toBe(2);
      for (const m of transitionAllMatches) {
        expect(m.file).toBe('src/components/festival/YangjaeFestivalDashboard.tsx');
      }
    });
  });

  describe('React DOM Dynamic Rendering & Boundary Validation', () => {
    test('ExpenseBatchToolbar renders with solid/translucent fallback and compositor transitions', () => {
      const handleSettle = jest.fn();
      const handleStatus = jest.fn();
      const handleDelete = jest.fn();
      const handleClear = jest.fn();

      const { container } = render(
        <ExpenseBatchToolbar
          selectedCount={3}
          onSettleApprove={handleSettle}
          onStatusChange={handleStatus}
          onDelete={handleDelete}
          onClearSelection={handleClear}
        />
      );

      const toolbar = container.querySelector('.bg-slate-900\\/95');
      expect(toolbar).toBeInTheDocument();
      expect(toolbar?.className).not.toContain('backdrop-blur');

      const buttons = container.querySelectorAll('button');
      expect(buttons.length).toBeGreaterThan(0);
      buttons.forEach(btn => {
        expect(btn.className).toMatch(/transition-colors/);
        expect(btn.className).not.toContain('transition-all');
        expect(btn.className).not.toContain('backdrop-blur');
      });
    });

    test('SecurityPinModal renders with solid/translucent backdrop and strictly adheres to Rule S 448px boundary', () => {
      const { container } = render(
        <SecurityPinModal
          isOpen={true}
          pinInput=""
          pinError={null}
          onPinChange={jest.fn()}
          onSubmit={jest.fn()}
          onClose={jest.fn()}
        />
      );

      const backdrop = container.firstChild as HTMLElement;
      expect(backdrop).toBeInTheDocument();
      expect(backdrop.className).toContain('bg-slate-900/60');
      expect(backdrop.className).not.toContain('backdrop-blur');

      const modalBox = container.querySelector('.max-w-sm');
      expect(modalBox).toBeInTheDocument();
      expect(modalBox?.className).not.toContain('dark:');
    });

    test('SubTaskTransferModal renders with solid/translucent backdrop, valid role and no blur', () => {
      const mockMilestones = [
        { id: 1, name: 'Task 1', subTasks: [] },
        { id: 2, name: 'Task 2', subTasks: [] }
      ];

      const { container } = render(
        <SubTaskTransferModal
          isOpen={true}
          transferTarget={{ sourceMilestoneId: 1, detailIndex: 0, detailRaw: '2026. 9. 14. 세부과업' }}
          currentMilestones={mockMilestones as any}
          selectedTargetMilestoneId={2}
          isTransferring={false}
          onSelectTarget={jest.fn()}
          onExecute={jest.fn()}
          onClose={jest.fn()}
        />
      );

      const backdrop = container.firstChild as HTMLElement;
      expect(backdrop).toBeInTheDocument();
      expect(backdrop.className).toContain('bg-slate-900/60');
      expect(backdrop.className).not.toContain('backdrop-blur');

      const dialog = screen.getByRole('dialog');
      expect(dialog).toBeInTheDocument();
      expect(dialog.className).not.toContain('backdrop-blur');
      expect(dialog.className).not.toContain('dark:');
    });
  });
});
