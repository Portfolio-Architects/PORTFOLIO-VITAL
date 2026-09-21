import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { InventoryList } from '@/components/inventory/InventoryList';
import { PolicyGroupCard } from '@/components/budget/ui/PolicyGroupCard';
import { InventoryItem, BudgetCategory, BudgetEntry } from '@/types';

// Mock Lucide icons
jest.mock('lucide-react', () => ({
  Plus: () => <span data-testid="icon-plus" />,
  Pencil: () => <span data-testid="icon-pencil" />,
  Trash2: () => <span data-testid="icon-trash" />,
  ArrowUp: () => <span data-testid="icon-arrow-up" />,
  ArrowDown: () => <span data-testid="icon-arrow-down" />,
  Package: () => <span data-testid="icon-package" />,
  Search: () => <span data-testid="icon-search" />,
  ChevronDown: () => <span data-testid="icon-chevron-down" />,
  ChevronUp: () => <span data-testid="icon-chevron-up" />,
  FileCheck: () => <span data-testid="icon-file-check" />,
  FilePlus2: () => <span data-testid="icon-file-plus2" />,
  RefreshCw: () => <span data-testid="icon-refresh-cw" />,
  CheckCircle2: () => <span data-testid="icon-check-circle" />,
  X: () => <span data-testid="icon-x" />
}));

describe('Empirical Challenger M2-2 (R2 Virtualization & Category Card DOM Optimization)', () => {
  const sampleItems: InventoryItem[] = Array.from({ length: 30 }, (_, i) => ({
    id: `item-${i + 1}`,
    name: `홍보물 품목 ${i + 1}`,
    category: i % 2 === 0 ? '리플렛' : '기념품',
    currentStock: 50 + i,
    unit: '개',
    budgetEntryIds: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }));

  const mockAddItem = jest.fn();
  const mockUpdateItem = jest.fn();
  const mockDeleteItem = jest.fn();
  const mockAdjustStock = jest.fn();
  const mockGetItemHistory = jest.fn((id: string) => [
    { id: `hist-${id}`, itemId: id, change: 10, reason: '기본입고', date: new Date().toISOString() }
  ]);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('1. InventoryList Virtualization & Rapid Scroll / Resize Edge Cases', () => {
    it('renders virtualized grid and handles scroll offset correctly', () => {
      const { container } = render(
        <InventoryList
          items={sampleItems}
          addItem={mockAddItem}
          updateItem={mockUpdateItem}
          deleteItem={mockDeleteItem}
          adjustStock={mockAdjustStock}
          getItemHistory={mockGetItemHistory}
        />
      );

      // Verify search input rendered
      expect(screen.getByPlaceholderText('품목명 또는 분류 검색...')).toBeInTheDocument();

      // Trigger scroll event on window
      act(() => {
        window.scrollY = 600;
        fireEvent.scroll(window);
      });

      // Confirm component rendered grid
      expect(container.querySelector('.grid')).toBeInTheDocument();
    });

    it('handles search query filtering and updates visible items', () => {
      render(
        <InventoryList
          items={sampleItems}
          addItem={mockAddItem}
          updateItem={mockUpdateItem}
          deleteItem={mockDeleteItem}
          adjustStock={mockAdjustStock}
          getItemHistory={mockGetItemHistory}
        />
      );

      const searchInput = screen.getByPlaceholderText('품목명 또는 분류 검색...');
      fireEvent.change(searchInput, { target: { value: '홍보물 품목 1' } });

      // Should filter to item 1
      expect(screen.getByText('홍보물 품목 1')).toBeInTheDocument();
    });
  });

  describe('2. Item CRUD and Stock Adjustment Modal during Virtualization', () => {
    it('opens and submits stock adjustment modal for item during virtualization', () => {
      render(
        <InventoryList
          items={sampleItems}
          addItem={mockAddItem}
          updateItem={mockUpdateItem}
          deleteItem={mockDeleteItem}
          adjustStock={mockAdjustStock}
          getItemHistory={mockGetItemHistory}
        />
      );

      // Click 입고 button for item 1
      const adjustButtons = screen.getAllByText('입고');
      fireEvent.click(adjustButtons[0]);

      expect(screen.getByText(/재고 조정 — 홍보물 품목 1/)).toBeInTheDocument();

      // Submit stock adjustment
      const submitBtn = screen.getByText('적용');
      fireEvent.click(submitBtn);

      expect(mockAdjustStock).toHaveBeenCalledWith('item-1', 1, '입고');
    });

    it('triggers delete callback when delete button clicked', () => {
      render(
        <InventoryList
          items={sampleItems}
          addItem={mockAddItem}
          updateItem={mockUpdateItem}
          deleteItem={mockDeleteItem}
          adjustStock={mockAdjustStock}
          getItemHistory={mockGetItemHistory}
        />
      );

      const deleteBtns = screen.getAllByTitle('삭제');
      fireEvent.click(deleteBtns[0]);

      expect(mockDeleteItem).toHaveBeenCalledWith('item-1');
    });
  });

  describe('3. PolicyGroupCard Expand / Collapse & Swap Category Stress Test', () => {
    const mockCats: BudgetCategory[] = [
      { id: 'cat-1', name: '통계목1', color: '#6366f1', policyProject: '건강도시', unitProject: '보건소운영', detailedProject: '사업1', totalBudget: 1000000, sortOrder: 0 },
      { id: 'cat-2', name: '통계목2', color: '#6366f1', policyProject: '건강도시', unitProject: '보건소운영', detailedProject: '사업1', totalBudget: 2000000, sortOrder: 1 }
    ];

    const mockEntries: BudgetEntry[] = [
      { id: 'e-1', categoryId: 'cat-1', amount: 100000, date: '2026-07-01', purpose: '품목구매', actionType: 'general' }
    ];

    const mockGetStats = jest.fn(() => ({
      spent: 100000,
      planned: 0,
      locked: 0,
      remaining: 900000,
      usageRate: 10,
      totalBudget: 1000000,
      dailyExpenseIssued: 0,
      dailyExpenseSpent: 0,
      dailyExpenseRemaining: 0,
      generalSpent: 100000
    }));

    const mockUpdateCategory = jest.fn();

    it('expands and collapses policy group card without throwing state errors', () => {
      render(
        <PolicyGroupCard
          group={{ policyName: '건강도시 조성', cats: mockCats }}
          entries={mockEntries}
          getCategoryStats={mockGetStats}
          deleteCategory={jest.fn()}
          deleteEntry={jest.fn()}
          openEditCat={jest.fn()}
          openEditEntry={jest.fn()}
          updateCategory={mockUpdateCategory}
        />
      );

      const header = screen.getByText('건강도시 조성');
      expect(header).toBeInTheDocument();

      // Expand card
      fireEvent.click(header);
      expect(screen.getAllByText('통계목1').length).toBeGreaterThanOrEqual(1);

      // Collapse card
      fireEvent.click(header);
      expect(screen.queryByText('통계목1')).not.toBeInTheDocument();
    });

    it('detects multiple calls on handleSwapCat during category position swap', () => {
      render(
        <PolicyGroupCard
          group={{ policyName: '건강도시 조성', cats: mockCats }}
          entries={mockEntries}
          getCategoryStats={mockGetStats}
          deleteCategory={jest.fn()}
          deleteEntry={jest.fn()}
          openEditCat={jest.fn()}
          openEditEntry={jest.fn()}
          updateCategory={mockUpdateCategory}
        />
      );

      // Expand card
      fireEvent.click(screen.getByText('건강도시 조성'));

      // Find down arrow button to swap cat 1 down
      const downBtns = screen.getAllByTitle('아래로 이동');
      fireEvent.click(downBtns[0]);

      // handleSwapCat iterates over ALL cats in sortedCats and calls updateCategory for each one
      expect(mockUpdateCategory).toHaveBeenCalledTimes(2);
    });
  });
});
