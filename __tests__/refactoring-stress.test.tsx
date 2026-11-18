import React from 'react';
import { render, act } from '@testing-library/react';
import Home from '@/app/page';
import { SecurityLockScreen } from '@/components/SecurityLockScreen';
import { extractKeywords } from '@/hooks/useSignal';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Modal } from '@/components/ui/modal';

const createTestQueryClient = () => new QueryClient({ defaultOptions: { queries: { retry: false } } });
const renderHome = () => render(<QueryClientProvider client={createTestQueryClient()}><Home /></QueryClientProvider>);

// ==========================================
// 1. Mocks for ProtectedApp and Hooks
// ==========================================

jest.mock('@/hooks/useTasks', () => ({
  useTasks: () => ({
    tasks: [],
    updateTask: jest.fn(),
    stats: { total: 0, completed: 0, pending: 0 }
  })
}));

jest.mock('@/hooks/useBudget', () => ({
  useBudget: () => ({
    categories: [],
    entries: [],
    addCategory: jest.fn(),
    updateCategory: jest.fn(),
    deleteCategory: jest.fn(),
    replaceCategories: jest.fn(),
    addEntry: jest.fn(),
    updateEntry: jest.fn(),
    deleteEntry: jest.fn(),
    getCategoryStats: jest.fn(),
    overallStatsActual: {}
  })
}));

jest.mock('@/hooks/useInventory', () => ({
  useInventory: () => ({
    items: [],
    addItem: jest.fn(),
    updateItem: jest.fn(),
    deleteItem: jest.fn(),
    adjustStock: jest.fn(),
    getItemHistory: jest.fn()
  })
}));

jest.mock('@/hooks/useMeetings', () => ({
  useMeetings: () => ({ meetings: [] })
}));

jest.mock('@/hooks/useProjects', () => ({
  useProjects: () => ({ projects: [] })
}));

jest.mock('@/lib/sheets-api', () => ({
  syncTombstones: jest.fn(() => Promise.resolve()),
  readSheet: jest.fn(() => Promise.resolve([])),
  addRow: jest.fn(() => Promise.resolve()),
  deleteRow: jest.fn(() => Promise.resolve()),
  updateRow: jest.fn(() => Promise.resolve()),
}));

// Mock the Sidebar component to avoid rendering its internals
jest.mock('@/components/Sidebar', () => ({
  Sidebar: () => <div data-testid="sidebar" />
}));

// Mock the sub-components of ProtectedApp that are dynamically imported
jest.mock('@/components/dashboard/PortfolioDashboardView', () => ({
  PortfolioDashboardView: () => <div data-testid="dashboard-view" />
}));
jest.mock('@/components/WorkspaceView', () => ({
  WorkspaceView: () => <div data-testid="workspace-view" />
}));
jest.mock('@/components/inventory/InventoryList', () => ({
  InventoryList: () => <div data-testid="inventory-list" />
}));
jest.mock('@/components/SearchResultModal', () => ({
  SearchResultModal: () => <div data-testid="search-modal" />
}));
jest.mock('@/components/ai/AIAssistantModal', () => ({
  AIAssistantModal: () => <div data-testid="ai-modal" />
}));

jest.mock('@/components/WikiEditor', () => ({
  WikiEditor: () => <div data-testid="wiki-editor" />
}));


// Mock canvas-related 3D dependencies for MindMap3D actual component test
jest.mock('@/lib/OntologyCanvasEngine', () => {
  return {
    OntologyCanvasEngine: jest.fn().mockImplementation(() => {
      return {
        init: jest.fn(),
        destroy: jest.fn(),
        tick: jest.fn().mockReturnValue(false),
        render: jest.fn(),
        nodes: [],
        edges: [],
        collapsedNodeIds: new Set(),
      };
    })
  };
});

jest.mock('@/lib/engine/PerformanceProfiler', () => {
  return {
    PerformanceProfiler: {
      getInstance: () => ({
        tick: jest.fn(),
        recordLagSpike: jest.fn(),
        recordRender: jest.fn(),
        getSpikeDiagnostic: jest.fn(),
      })
    }
  };
});

jest.mock('@/lib/engine/OntologyLayout', () => {
  return {
    OntologyLayout: {
      dynamicRules: {}
    }
  };
});

jest.mock('@/lib/signal-graph', () => ({
  buildSignalGraph: jest.fn().mockReturnValue({ nodes: [], edges: [] }),
}));

// Mock ResizeObserver
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// ==========================================
// 2. Tests Suites
// ==========================================

describe('useSignal Hook Keyword Extraction', () => {
  test('extractKeywords removes suffixes and stopwords in Korean text', () => {
    // Test a sentence containing suffixes and stopwords
    // "서울시 강남체육센터에서 비만예방 프로그램을 진행했다."
    const keywords = extractKeywords('서울시 강남체육센터에서 비만예방 프로그램을 진행했다.');
    expect(keywords).toContain('서울시');
    expect(keywords).toContain('강남체육센터');
    expect(keywords).toContain('비만예방');
    expect(keywords).toContain('프로그램');
    expect(keywords).toContain('진행'); // '진행했다' should be stripped to '진행'
    
    // Stopwords and single letters should be filtered out
    expect(keywords).not.toContain('에서');
    expect(keywords).not.toContain('을');
    expect(keywords).not.toContain('진행했다');
  });
});

describe('Home Component Lifecycle and Timer Cleanup Stress Test', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(global, 'setTimeout');
    jest.spyOn(global, 'clearTimeout');
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  test('rapid mount and unmount does not leak timers or throw errors', () => {
    const runs = 100;
    for (let i = 0; i < runs; i++) {
      const { unmount } = renderHome();
      unmount();
    }
    
    const setTimeoutsCount = (global.setTimeout as unknown as jest.Mock).mock.calls.length;
    const clearTimeoutsCount = (global.clearTimeout as unknown as jest.Mock).mock.calls.length;
    
    // Check that we scheduled at least 'runs' timeouts and successfully cleared 'runs' of them
    expect(setTimeoutsCount).toBeGreaterThanOrEqual(runs);
    expect(clearTimeoutsCount).toBeGreaterThanOrEqual(runs);
  });


  test('inner timer is cleaned up if unmounted mid-flight', () => {
    const { unmount } = renderHome();
    
    // Fast-forward past the first timer (1000ms) but not the second (700ms)
    act(() => {
      jest.advanceTimersByTime(1200);
    });
    
    // Verify that the second timer was scheduled
    const setTimeoutsCount = (global.setTimeout as unknown as jest.Mock).mock.calls.length;
    expect(setTimeoutsCount).toBeGreaterThanOrEqual(2);
    
    // Unmount while the second timer is pending
    unmount();
    
    // Verify that clearTimeout was called for timers
    const clearTimeoutsCount = (global.clearTimeout as unknown as jest.Mock).mock.calls.length;
    expect(clearTimeoutsCount).toBeGreaterThanOrEqual(1);
  });
});


describe('SecurityLockScreen Event Listener Registration and Cleanup', () => {
  let activeListeners: { type: string; handler: any; options?: any }[] = [];
  const originalAddEventListener = window.addEventListener;
  const originalRemoveEventListener = window.removeEventListener;

  beforeEach(() => {
    activeListeners = [];
    window.addEventListener = jest.fn((type, handler, options) => {
      activeListeners.push({ type, handler, options });
      originalAddEventListener(type, handler, options);
    });
    window.removeEventListener = jest.fn((type, handler, options) => {
      activeListeners = activeListeners.filter(
        l => !(l.type === type && l.handler === handler)
      );
      originalRemoveEventListener(type, handler, options);
    });
  });

  afterEach(() => {
    window.addEventListener = originalAddEventListener;
    window.removeEventListener = originalRemoveEventListener;
  });

  test('registers keydown listener on mount and unregisters on unmount', () => {
    const onVerify = jest.fn().mockResolvedValue(true);
    const onSetup = jest.fn();
    
    const { unmount } = render(
      <SecurityLockScreen 
        hasSetupPIN={true} 
        failCount={0} 
        onVerify={onVerify} 
        onSetup={onSetup} 
      />
    );

    // Verify keydown listener is registered
    const keydownListeners = activeListeners.filter(l => l.type === 'keydown');
    expect(keydownListeners.length).toBe(1);

    // Unmount
    unmount();

    // Verify keydown listener is cleaned up
    const remainingKeydown = activeListeners.filter(l => l.type === 'keydown');
    expect(remainingKeydown.length).toBe(0);
  });
});

describe('VLDS Modal Event Listener Registration and Cleanup', () => {
  let activeListeners: { type: string; handler: any; options?: any }[] = [];
  const originalAddEventListener = window.addEventListener;
  const originalRemoveEventListener = window.removeEventListener;

  beforeEach(() => {
    activeListeners = [];
    window.addEventListener = jest.fn((type, handler, options) => {
      activeListeners.push({ type, handler, options });
      originalAddEventListener(type, handler, options);
    });
    window.removeEventListener = jest.fn((type, handler, options) => {
      activeListeners = activeListeners.filter(
        l => !(l.type === type && l.handler === handler)
      );
      originalRemoveEventListener(type, handler, options);
    });
  });

  afterEach(() => {
    window.addEventListener = originalAddEventListener;
    window.removeEventListener = originalRemoveEventListener;
  });

  test('registers Escape keydown listener on open and unregisters cleanly on unmount', () => {
    const { unmount } = render(
      <Modal isOpen={true} onClose={jest.fn()} title="테스트 모달">
        <div>콘텐츠</div>
      </Modal>
    );

    const keydownListeners = activeListeners.filter(l => l.type === 'keydown');
    expect(keydownListeners.length).toBeGreaterThanOrEqual(1);

    unmount();

    const remainingKeydown = activeListeners.filter(l => l.type === 'keydown');
    expect(remainingKeydown.length).toBe(0);
  });
});
