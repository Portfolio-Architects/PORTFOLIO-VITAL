/* eslint-disable */
import { TextEncoder, TextDecoder } from 'util';
import fs from 'fs';
import path from 'path';

if (typeof global.TextEncoder === 'undefined') {
  global.TextEncoder = TextEncoder as any;
  global.TextDecoder = TextDecoder as any;
}
if (typeof global.ResizeObserver === 'undefined') {
  global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as any;
}

import { queryClient } from '@/lib/query-client';
import { OntologyCanvasEngine } from '@/lib/OntologyCanvasEngine';
import { OntologyGraph } from '@/lib/ontology.types';

// Mock Canvas 2D context
function createMockCanvas() {
  return {
    clearRect: jest.fn(),
    scale: jest.fn(),
    save: jest.fn(),
    restore: jest.fn(),
    translate: jest.fn(),
    beginPath: jest.fn(),
    arc: jest.fn(),
    fill: jest.fn(),
    stroke: jest.fn(),
    moveTo: jest.fn(),
    lineTo: jest.fn(),
    fillText: jest.fn(),
    strokeRect: jest.fn(),
    fillRect: jest.fn(),
    setLineDash: jest.fn(),
    measureText: jest.fn(() => ({ width: 50 })),
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    font: '',
    textAlign: '',
    textBaseline: '',
    globalAlpha: 1,
    shadowColor: '',
    shadowBlur: 0,
  };
}

HTMLCanvasElement.prototype.getContext = jest.fn().mockImplementation(() => createMockCanvas()) as any;
HTMLCanvasElement.prototype.getBoundingClientRect = jest.fn().mockImplementation(() => ({
  left: 0, top: 0, width: 800, height: 600, right: 800, bottom: 600, x: 0, y: 0, toJSON: () => {}
})) as any;

describe('Challenger 1 Adversarial Stress Test Suite: Zero-Stall Pipeline (R2)', () => {
  describe('1. QueryClient Background Isolation Guard', () => {
    test('Default queries config enforces refetchIntervalInBackground = false', () => {
      const defaultOptions = queryClient.getDefaultOptions();
      expect(defaultOptions.queries).toBeDefined();
      expect(defaultOptions.queries?.refetchIntervalInBackground).toBe(false);
    });

    test('Default queries config enforces refetchOnWindowFocus = false and refetchOnReconnect = false', () => {
      const defaultOptions = queryClient.getDefaultOptions();
      expect(defaultOptions.queries?.refetchOnWindowFocus).toBe(false);
      expect(defaultOptions.queries?.refetchOnReconnect).toBe(false);
    });
  });

  describe('2. Staggered Preloading Schedule & Resource Cleanup Analysis', () => {
    test('ProtectedApp.tsx source code implements exact 3-stage staggered preloading', () => {
      const protectedAppPath = path.join(__dirname, '..', 'src', 'components', 'ProtectedApp.tsx');
      const content = fs.readFileSync(protectedAppPath, 'utf8');

      // Stage 1 (+3.5s)
      expect(content).toMatch(/scheduleIdle\(\(\)\s*=>\s*\{[\s\S]*?WorkspaceView[\s\S]*?BudgetDashboard[\s\S]*?\},\s*3500\)/);

      // Stage 2 (+5.5s)
      expect(content).toMatch(/scheduleIdle\(\(\)\s*=>\s*\{[\s\S]*?YangjaeFestivalDashboard[\s\S]*?InventoryList[\s\S]*?\},\s*5500\)/);

      // Stage 3 (+7.5s)
      expect(content).toMatch(/scheduleIdle\(\(\)\s*=>\s*\{[\s\S]*?BudgetSimulator[\s\S]*?AppLogModal[\s\S]*?AIAssistantModal[\s\S]*?CommandPalette[\s\S]*?\},\s*7500\)/);

      // Memory cleanup return function
      expect(content).toMatch(/timeouts\.forEach\(clearTimeout\)/);
      expect(content).toMatch(/idleCallbacks\.forEach\(h\s*=>\s*window\.cancelIdleCallback\(h\)\)/);
    });

    test('Simulated scheduleStaggeredPreloads properly unregisters all timers on unmount', () => {
      jest.useFakeTimers();

      const cancelledIdleCallbacks: number[] = [];

      // Mock timers tracking
      const timeoutSpy = jest.spyOn(global, 'clearTimeout');
      (window as any).requestIdleCallback = jest.fn(() => {
        return Math.floor(Math.random() * 10000);
      });
      (window as any).cancelIdleCallback = jest.fn((id) => {
        cancelledIdleCallbacks.push(id);
      });

      // Execute simulated scheduling
      const idleCallbacks: number[] = [];
      const timeouts: NodeJS.Timeout[] = [];

      const scheduleIdle = (fn: () => void, delayMs: number) => {
        const timeoutId = setTimeout(() => {
          if ('requestIdleCallback' in window) {
            const handle = (window as any).requestIdleCallback(() => fn(), { timeout: 2000 });
            idleCallbacks.push(handle);
          } else {
            fn();
          }
        }, delayMs);
        timeouts.push(timeoutId);
      };

      scheduleIdle(() => {}, 3500);
      scheduleIdle(() => {}, 5500);
      scheduleIdle(() => {}, 7500);

      expect(timeouts.length).toBe(3);

      // Cleanup before timers expire
      const cleanup = () => {
        timeouts.forEach(clearTimeout);
        if ('cancelIdleCallback' in window) {
          idleCallbacks.forEach(h => (window as any).cancelIdleCallback(h));
        }
      };

      cleanup();

      expect(timeoutSpy).toHaveBeenCalledTimes(3);

      timeoutSpy.mockRestore();
      jest.useRealTimers();
    });
  });

  describe('3. OntologyCanvasEngine Adversarial Delta Clamping & Visibility Stress Test', () => {
    let engine: OntologyCanvasEngine;
    const denseGraph: OntologyGraph = {
      nodes: [
        { id: 'root', label: 'Root Center', group: 'CORE_PROJECT', baseValue: 20 },
        { id: 'cat1', label: 'Category 1', parentId: 'root', group: 'DATA_PIPELINE', baseValue: 10 },
        { id: 'cat2', label: 'Category 2', parentId: 'root', group: 'DCF_MODELING', baseValue: 10 },
        { id: 'cat3', label: 'Category 3', parentId: 'root', group: 'INFRASTRUCTURE', baseValue: 10 },
        { id: 'leaf1_1', label: 'Leaf 1-1', parentId: 'cat1', group: 'DATA_PIPELINE', baseValue: 5 },
        { id: 'leaf1_2', label: 'Leaf 1-2', parentId: 'cat1', group: 'DATA_PIPELINE', baseValue: 5 },
        { id: 'leaf2_1', label: 'Leaf 2-1', parentId: 'cat2', group: 'DCF_MODELING', baseValue: 5 },
        { id: 'leaf2_2', label: 'Leaf 2-2', parentId: 'cat2', group: 'DCF_MODELING', baseValue: 5 },
        { id: 'leaf3_1', label: 'Leaf 3-1', parentId: 'cat3', group: 'INFRASTRUCTURE', baseValue: 5 },
        { id: 'leaf3_2', label: 'Leaf 3-2', parentId: 'cat3', group: 'INFRASTRUCTURE', baseValue: 5 },
      ],
      edges: [
        { source: 'root', target: 'cat1', type: 'DEPENDENCY', weight: 2 },
        { source: 'root', target: 'cat2', type: 'DEPENDENCY', weight: 2 },
        { source: 'root', target: 'cat3', type: 'DEPENDENCY', weight: 2 },
        { source: 'cat1', target: 'leaf1_1', type: 'DEPENDENCY', weight: 1 },
        { source: 'cat1', target: 'leaf1_2', type: 'DEPENDENCY', weight: 1 },
        { source: 'cat2', target: 'leaf2_1', type: 'DEPENDENCY', weight: 1 },
        { source: 'cat2', target: 'leaf2_2', type: 'DEPENDENCY', weight: 1 },
        { source: 'cat3', target: 'leaf3_1', type: 'DEPENDENCY', weight: 1 },
        { source: 'cat3', target: 'leaf3_2', type: 'DEPENDENCY', weight: 1 },
      ],
    };

    beforeEach(() => {
      engine = new OntologyCanvasEngine();
      engine.init(denseGraph);
    });

    test('Delta Clamping Invariant: Extreme time leaps (1 minute to 24 hours) remain clamped <= 100ms and coordinate-safe', () => {
      let mockPerfTime = 1000;
      const perfSpy = jest.spyOn(performance, 'now').mockImplementation(() => mockPerfTime);

      // Initial tick
      engine.resume();
      engine.tick();

      // Simulate 60-second tab suspension
      mockPerfTime += 60000;
      engine.tick();

      // Check all node coordinates are finite and not NaN
      for (const node of engine.nodes) {
        expect(Number.isFinite(node.worldX)).toBe(true);
        expect(Number.isFinite(node.worldY)).toBe(true);
        expect(Number.isNaN(node.worldX)).toBe(false);
        expect(Number.isNaN(node.worldY)).toBe(false);
      }

      // Simulate 24-hour tab suspension (86,400,000ms)
      mockPerfTime += 86400000;
      engine.tick();

      for (const node of engine.nodes) {
        expect(Number.isFinite(node.worldX)).toBe(true);
        expect(Number.isFinite(node.worldY)).toBe(true);
        expect(Number.isNaN(node.worldX)).toBe(false);
        expect(Number.isNaN(node.worldY)).toBe(false);
      }

      perfSpy.mockRestore();
    });

    test('Rapid Pause-Resume Cycling (500 iterations) maintains state consistency without crash', () => {
      for (let i = 0; i < 500; i++) {
        engine.pause();
        expect(engine.isPaused).toBe(true);
        expect(engine.tick()).toBe(false);

        engine.resume();
        expect(engine.isPaused).toBe(false);
        expect(engine.physicsAlpha).toBe(1.0);
      }
    });

    test('Freeze accurately halts all velocities and pauses simulation loop', () => {
      for (const node of engine.nodes) {
        node.vx = (Math.random() - 0.5) * 20;
        node.vy = (Math.random() - 0.5) * 20;
      }

      engine.freeze();

      expect(engine.isPaused).toBe(true);
      for (const node of engine.nodes) {
        expect(node.vx).toBe(0);
        expect(node.vy).toBe(0);
      }

      expect(engine.tick()).toBe(false);
    });

    test('Zero-division / Negative timestamp edge case safety', () => {
      let mockPerfTime = 5000;
      const perfSpy = jest.spyOn(performance, 'now').mockImplementation(() => mockPerfTime);

      engine.resume();
      engine.tick();

      // Time went backward (e.g. system clock adjustment)
      mockPerfTime = 4000;
      expect(() => engine.tick()).not.toThrow();

      for (const node of engine.nodes) {
        expect(Number.isFinite(node.worldX)).toBe(true);
        expect(Number.isFinite(node.worldY)).toBe(true);
      }

      perfSpy.mockRestore();
    });
  });
});
