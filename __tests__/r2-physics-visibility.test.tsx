/* eslint-disable */
import { TextEncoder, TextDecoder } from 'util';

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

import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { OntologyCanvasEngine } from '@/lib/OntologyCanvasEngine';
import { OntologyGraph } from '@/lib/ontology.types';
import { useDocumentVisibility } from '@/hooks/useDocumentVisibility';

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

const mockGraph: OntologyGraph = {
  nodes: [
    { id: 'center', label: '중심 노드', group: 'CORE_PROJECT', baseValue: 10 },
    { id: 'node1', label: '하위 노드 1', parentId: 'center', group: 'OTHER', baseValue: 5 },
    { id: 'node2', label: '하위 노드 2', parentId: 'center', group: 'OTHER', baseValue: 5 },
  ],
  edges: [
    { source: 'center', target: 'node1', type: 'DEPENDENCY', weight: 1 },
    { source: 'center', target: 'node2', type: 'DEPENDENCY', weight: 1 },
  ],
};

describe('R2 Empirical Challenge: Physics Loop & Tab Visibility', () => {
  let engine: OntologyCanvasEngine;

  beforeEach(() => {
    engine = new OntologyCanvasEngine();
    engine.init(mockGraph);
  });

  describe('1. Physics Loop Pause and Resume Behavior (Unit)', () => {
    test('engine.freeze() sets isPaused=true and resets node velocities to 0', () => {
      engine.nodes[1].vx = 5.5;
      engine.nodes[1].vy = -3.2;

      engine.freeze();

      expect(engine.isPaused).toBe(true);
      expect(engine.nodes[1].vx).toBe(0);
      expect(engine.nodes[1].vy).toBe(0);
    });

    test('tick() returns false immediately when engine is paused', () => {
      engine.pause();
      expect(engine.isPaused).toBe(true);
      const isDirty = engine.tick();
      expect(isDirty).toBe(false);
    });

    test('engine.resume() and wakeUp() restore physics calculation', () => {
      engine.freeze();
      expect(engine.isPaused).toBe(true);

      engine.resume();
      expect(engine.isPaused).toBe(false);
      expect(engine.physicsAlpha).toBe(1.0);
      expect((engine as any).idleFramesCount).toBe(0);
      expect(engine.needsRedraw).toBe(true);

      const isDirty = engine.tick();
      expect(isDirty).toBe(true);
    });

    test('physics loop sleeps after 90 idle frames to reduce CPU load', () => {
      engine.resume();
      // Fast forward 90 idle ticks
      for (let i = 0; i < 90; i++) {
        engine.tick();
      }
      expect((engine as any).idleFramesCount).toBe(90);

      // Frame 91: returns true once for final clean redraw
      engine.needsRedraw = true;
      const finalDrawDirty = engine.tick();
      expect(finalDrawDirty).toBe(true);
      expect(engine.needsRedraw).toBe(false);

      // Frame 92+: returns false (asleep)
      const sleptDirty = engine.tick();
      expect(sleptDirty).toBe(false);
    });

    test('user interaction wakes up the engine from sleep', () => {
      for (let i = 0; i < 100; i++) {
        engine.tick();
      }
      expect(engine.tick()).toBe(false); // Sleeping

      engine.wakeUp();
      expect((engine as any).idleFramesCount).toBe(0);
      expect(engine.physicsAlpha).toBe(1.0);
      expect(engine.needsRedraw).toBe(true);

      expect(engine.tick()).toBe(true);
    });
  });

  describe('2. Tab Visibility & document.hidden Integration (useDocumentVisibility)', () => {
    let originalHidden: boolean;

    beforeEach(() => {
      originalHidden = document.hidden;
    });

    afterEach(() => {
      Object.defineProperty(document, 'hidden', {
        configurable: true,
        get: () => originalHidden,
      });
    });

    test('tab switching to background (hidden=true) transitions visibility state to false immediately', () => {
      Object.defineProperty(document, 'hidden', {
        configurable: true,
        get: () => false,
      });
      const { result, unmount } = renderHook(() => useDocumentVisibility());
      expect(result.current).toBe(true);

      Object.defineProperty(document, 'hidden', {
        configurable: true,
        get: () => true,
      });

      act(() => {
        document.dispatchEvent(new Event('visibilitychange'));
      });

      expect(result.current).toBe(false);
      unmount();
    });

    test('mounting while document.hidden is true reports false without tearing', () => {
      Object.defineProperty(document, 'hidden', {
        configurable: true,
        get: () => true,
      });

      const { result, unmount } = renderHook(() => useDocumentVisibility());
      expect(result.current).toBe(false);
      unmount();
    });

    test('returning to active tab (hidden=false) restores visibility state to true', () => {
      Object.defineProperty(document, 'hidden', {
        configurable: true,
        get: () => true,
      });

      const { result, unmount } = renderHook(() => useDocumentVisibility());
      expect(result.current).toBe(false);

      Object.defineProperty(document, 'hidden', {
        configurable: true,
        get: () => false,
      });
      act(() => {
        document.dispatchEvent(new Event('visibilitychange'));
      });

      expect(result.current).toBe(true);
      unmount();
    });
  });
});
