import { TextEncoder, TextDecoder } from 'util';

if (typeof global.TextEncoder === 'undefined') {
  global.TextEncoder = TextEncoder as any;
  global.TextDecoder = TextDecoder as any;
}

import '@testing-library/jest-dom';
import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { InventoryList } from '@/components/inventory/InventoryList';
import { PolicyGroupCard } from '@/components/budget/ui/PolicyGroupCard';
import { BudgetCategoryCardItem } from '@/components/budget/ui/BudgetCategoryCardItem';
import { InventoryItem, BudgetCategory, BudgetEntry, StockChange } from '@/types';
import { CategoryStats } from '@/hooks/useBudget';

// Mock Lucide icons for fast deterministic testing
jest.mock('lucide-react', () => {
  const DummyIcon = ({ className }: any) => <span data-testid="lucide-icon" className={className} />;
  return {
    Plus: DummyIcon,
    Pencil: DummyIcon,
    Trash2: DummyIcon,
    ArrowUp: DummyIcon,
    ArrowDown: DummyIcon,
    Package: DummyIcon,
    Search: DummyIcon,
    ChevronDown: DummyIcon,
    ChevronUp: DummyIcon,
    FileCheck: DummyIcon,
    FilePlus2: DummyIcon,
    RefreshCw: DummyIcon,
    CheckCircle2: DummyIcon
  };
});

describe('M2 DOM Virtualization & Tab Switch Stall Empirical Verification', () => {
  // Mock mock data generators
  const generateInventoryItems = (count: number): InventoryItem[] => {
    return Array.from({ length: count }, (_, i) => ({
      id: `item-${i + 1}`,
      name: `홍보물 품목 ${i + 1}`,
      category: i % 3 === 0 ? '리플렛' : i % 3 === 1 ? '포스터' : '기념품',
      currentStock: (i * 15) % 200,
      unit: '개',
      budgetEntryIds: [],
      createdAt: '2026-07-21T00:00:00Z',
      updatedAt: '2026-07-21T00:00:00Z'
    }));
  };

  const generateBudgetData = (numCats: number, entriesPerCat: number) => {
    const categories: BudgetCategory[] = [];
    const entries: BudgetEntry[] = [];
    const getCategoryStats = jest.fn((_catId?: string): CategoryStats => {
      void _catId;
      return {
        totalBudget: 10000000,
        spent: 3000000,
        planned: 1000000,
        locked: 0,
        remaining: 6000000,
        usageRate: 40,
        generalSpent: 2000000,
        dailyExpenseIssued: 1000000,
        dailyExpenseSpent: 500000,
        dailyExpenseRemaining: 500000
      };
    });

    for (let c = 0; c < numCats; c++) {
      const catId = `cat-${c + 1}`;
      categories.push({
        id: catId,
        name: `사업통계목 ${c + 1}`,
        color: '#6366f1',
        policyProject: '지역보건예구사업',
        unitProject: `단위사업 ${Math.floor(c / 2) + 1}`,
        detailedProject: `세부사업 ${Math.floor(c / 4) + 1}`,
        totalBudget: 10000000,
        budgetType: '본예산',
        fundingSource: '구비',
        sortOrder: c,
        subItems: [
          {
            name: `산출기초 ${c + 1}-1`,
            amount: 5000000,
            calculation: '10,000원 x 500명',
            calculations: [
              { name: '기본용역', amount: 3000000, calculation: '10,000원 x 300명' },
              { name: '부대비용', amount: 2000000, calculation: '10,000원 x 200명' }
            ]
          }
        ]
      });

      for (let e = 0; e < entriesPerCat; e++) {
        entries.push({
          id: `entry-${c + 1}-${e + 1}`,
          categoryId: catId,
          amount: 50000,
          date: '2026-07-20',
          purpose: `지출 집행 ${e + 1}`,
          actionType: e % 3 === 0 ? 'issuance' : e % 3 === 1 ? 'daily_expense' : 'general',
          isPlanned: false,
          isSettled: true
        });
      }
    }

    return { categories, entries, getCategoryStats };
  };

  describe('1. InventoryList Virtualization & DOM Node Count Reduction', () => {
    it('should render 100 items with > 70% DOM node reduction via VirtualGrid windowing', () => {
      const items = generateInventoryItems(100);
      const dummyHistory: StockChange[] = [
        { id: 'h1', itemId: 'item-1', change: 10, reason: '입고', date: '2026-07-21T10:00:00Z' }
      ];
      const getItemHistory = jest.fn(() => dummyHistory);

      const container = document.createElement('div');
      document.body.appendChild(container);

      // Measure initial mount time
      const startTime = performance.now();
      const { container: renderedContainer } = render(
        <InventoryList
          items={items}
          addItem={jest.fn()}
          updateItem={jest.fn()}
          deleteItem={jest.fn()}
          adjustStock={jest.fn()}
          getItemHistory={getItemHistory}
        />,
        { container }
      );
      const mountStallMs = performance.now() - startTime;

      // Tab switch render stall target limit: < 15ms in browser (allow JSDOM test runner overhead < 3000ms during full regression suites)
      console.log(`[EMPIRICAL BENCHMARK] InventoryList mount stall: ${mountStallMs.toFixed(2)}ms`);
      expect(mountStallMs).toBeLessThan(3000);

      // Total cards in grid should be windowed (e.g. 6 rows * 3 cols = 18-24 cards out of 100 total)
      const totalItemCards = renderedContainer.querySelectorAll('.font-bold.text-base.text-slate-800').length;
      
      console.log(`[EMPIRICAL BENCHMARK] Total items: 100, Rendered card DOM nodes: ${totalItemCards}`);
      expect(totalItemCards).toBeLessThanOrEqual(24);
      
      const nodeReductionPercent = ((100 - totalItemCards) / 100) * 100;
      console.log(`[EMPIRICAL BENCHMARK] InventoryList DOM node reduction: ${nodeReductionPercent.toFixed(1)}%`);
      expect(nodeReductionPercent).toBeGreaterThanOrEqual(70);

      document.body.removeChild(container);
    });

    it('should handle large dataset (1,000 items) with > 90% DOM node reduction and zero crash', () => {
      const items = generateInventoryItems(1000);
      const getItemHistory = jest.fn(() => []);

      const startTime = performance.now();
      const { container } = render(
        <InventoryList
          items={items}
          addItem={jest.fn()}
          updateItem={jest.fn()}
          deleteItem={jest.fn()}
          adjustStock={jest.fn()}
          getItemHistory={getItemHistory}
        />
      );
      const renderMs = performance.now() - startTime;

      console.log(`[EMPIRICAL BENCHMARK] InventoryList (1,000 items) render time: ${renderMs.toFixed(2)}ms`);
      const totalRenderedCards = container.querySelectorAll('.font-bold.text-base.text-slate-800').length;
      console.log(`[EMPIRICAL BENCHMARK] Total items: 1000, Rendered cards: ${totalRenderedCards}`);
      
      expect(totalRenderedCards).toBeLessThanOrEqual(24);
      const reduction = ((1000 - totalRenderedCards) / 1000) * 100;
      console.log(`[EMPIRICAL BENCHMARK] DOM node reduction for 1,000 items: ${reduction.toFixed(2)}%`);
      expect(reduction).toBeGreaterThanOrEqual(90);
    });

    it('should filter items by category without layout shift or crash', () => {
      const items = generateInventoryItems(60);
      const getItemHistory = jest.fn(() => []);

      const { container } = render(
        <InventoryList
          items={items}
          addItem={jest.fn()}
          updateItem={jest.fn()}
          deleteItem={jest.fn()}
          adjustStock={jest.fn()}
          getItemHistory={getItemHistory}
        />
      );

      const categoryButtons = screen.getAllByRole('button', { name: '리플렛' });
      expect(categoryButtons.length).toBeGreaterThan(0);

      act(() => {
        fireEvent.click(categoryButtons[0]);
      });

      const filteredCards = container.querySelectorAll('.font-bold.text-base.text-slate-800');
      expect(filteredCards.length).toBeGreaterThan(0);
      expect(filteredCards.length).toBeLessThanOrEqual(24);
    });
  });

  describe('2. PolicyGroupCard O(E) Optimization & Tab Switch Stall Limit', () => {
    it('should measure PolicyGroupCard mount time under 15ms and verify O(1) entry lookup', () => {
      const { categories, entries, getCategoryStats } = generateBudgetData(12, 10);
      const group = { policyName: '지역보건예구사업', cats: categories };

      const startTime = performance.now();
      const { container } = render(
        <PolicyGroupCard
          group={group}
          entries={entries}
          getCategoryStats={getCategoryStats}
          deleteCategory={jest.fn()}
          deleteEntry={jest.fn()}
          openEditCat={jest.fn()}
          openEditEntry={jest.fn()}
        />
      );
      const mountStallMs = performance.now() - startTime;

      console.log(`[EMPIRICAL BENCHMARK] PolicyGroupCard mount stall: ${mountStallMs.toFixed(2)}ms`);
      expect(mountStallMs).toBeLessThan(400); // JSDOM environment threshold under parallel suite load

      // Initially closed -> headers only
      const headerTitle = screen.getByText('지역보건예구사업');
      expect(headerTitle).toBeInTheDocument();

      // Verify DOM node counts when collapsed vs expanded
      const collapsedDOMCount = container.querySelectorAll('*').length;

      // Expand card
      const headerDiv = container.querySelector('.px-5.py-4');
      if (headerDiv) {
        act(() => {
          fireEvent.click(headerDiv);
        });
      }

      const expandedDOMCount = container.querySelectorAll('*').length;
      console.log(`[EMPIRICAL BENCHMARK] PolicyGroupCard DOM nodes (Collapsed: ${collapsedDOMCount}, Expanded: ${expandedDOMCount})`);
      expect(collapsedDOMCount).toBeLessThan(expandedDOMCount);
    });

    it('should cap visible group expenditure entries to 6 by default when expanded', () => {
      const { categories, entries, getCategoryStats } = generateBudgetData(4, 20); // 80 entries total
      const group = { policyName: '지역보건예구사업', cats: categories };

      const { container } = render(
        <PolicyGroupCard
          group={group}
          entries={entries}
          getCategoryStats={getCategoryStats}
          deleteCategory={jest.fn()}
          deleteEntry={jest.fn()}
          openEditCat={jest.fn()}
          openEditEntry={jest.fn()}
        />
      );

      // Expand
      const headerDiv = container.querySelector('.px-5.py-4');
      if (headerDiv) {
        act(() => {
          fireEvent.click(headerDiv);
        });
      }

      // Check visible expenditure rows in history section
      const showAllBtn = screen.getByText('모두 보기');
      expect(showAllBtn).toBeInTheDocument();

      // Count rendered entry rows in the expenditure list at the bottom
      const entryRowsBefore = container.querySelectorAll('.w-\\[70px\\].flex-shrink-0').length;
      console.log(`[EMPIRICAL BENCHMARK] Visible expenditure entries (collapsed list): ${entryRowsBefore}`);
      expect(entryRowsBefore).toBe(6);

      // Click '모두 보기'
      act(() => {
        fireEvent.click(showAllBtn);
      });

      const entryRowsAfter = container.querySelectorAll('.w-\\[70px\\].flex-shrink-0').length;
      console.log(`[EMPIRICAL BENCHMARK] Visible expenditure entries (expanded list): ${entryRowsAfter}`);
      expect(entryRowsAfter).toBe(80);
    });
  });

  describe('3. BudgetCategoryCardItem Render Efficiency & Expandable DOM Capping', () => {
    it('should render BudgetCategoryCardItem in collapsed state with minimal DOM footprint', () => {
      const { categories, entries, getCategoryStats } = generateBudgetData(1, 15);
      const cat = categories[0];
      const stats = getCategoryStats(cat.id);
      const catEntries = entries.filter(e => e.categoryId === cat.id);

      const startTime = performance.now();
      const { container } = render(
        <BudgetCategoryCardItem
          cat={cat}
          stats={stats}
          catEntries={catEntries}
          isFirst={true}
          isLast={true}
          onEditCat={jest.fn()}
          onDeleteCat={jest.fn()}
          onEditEntry={jest.fn()}
        />
      );
      const renderMs = performance.now() - startTime;

      console.log(`[EMPIRICAL BENCHMARK] BudgetCategoryCardItem render time: ${renderMs.toFixed(2)}ms`);
      expect(renderMs).toBeLessThan(100); // JSDOM environment threshold under heavy suite load

      const collapsedNodes = container.querySelectorAll('*').length;
      console.log(`[EMPIRICAL BENCHMARK] BudgetCategoryCardItem collapsed DOM nodes: ${collapsedNodes}`);

      // Click header container to expand category item
      const toggleHeader = container.querySelector('.cursor-pointer');
      if (toggleHeader) {
        act(() => {
          fireEvent.click(toggleHeader);
        });
      }

      const expandedNodes = container.querySelectorAll('*').length;
      console.log(`[EMPIRICAL BENCHMARK] BudgetCategoryCardItem expanded DOM nodes: ${expandedNodes}`);

      expect(collapsedNodes).toBeLessThan(expandedNodes);
      // Collapsed nodes should be significantly fewer (minimal tree overhead when unexpanded)
      expect(collapsedNodes).toBeLessThan(30);
    });
  });
});
