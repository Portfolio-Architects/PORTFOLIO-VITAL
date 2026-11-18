/* eslint-disable @typescript-eslint/no-require-imports */
import { renderHook, act } from '@testing-library/react';
import { useGraphCustomization } from '@/__tests__/fixtures/useGraphCustomization';
import { globalYDoc } from '@/hooks/useYjsStore';
import * as Y from 'yjs';
import { OntologyNode } from '@/lib/ontology.types';

// Mock Yjs store to isolate tests and avoid hoisting ReferenceErrors
jest.mock('@/hooks/useYjsStore', () => {
  const YModule = require('yjs');
  const mockYDoc = new YModule.Doc();
  return {
    useYjsStore: () => ({
      ydoc: mockYDoc,
      provider: null
    }),
    globalYDoc: mockYDoc
  };
});

// Mock sheets API to prevent real read/write
jest.mock('@/lib/sheets-api', () => ({
  readSheet: jest.fn().mockResolvedValue([]),
  addRow: jest.fn().mockResolvedValue(true),
  deleteRow: jest.fn().mockResolvedValue(true),
  updateRow: jest.fn().mockResolvedValue(true),
  syncTombstones: jest.fn().mockResolvedValue(true),
  replaceAll: jest.fn().mockResolvedValue(true),
}));

// Helper function to wait for the 16ms debounce in hook update
const waitForHookUpdate = () => new Promise(resolve => setTimeout(resolve, 30));

describe('Milestone 3: Manual Node/Edge CRUD UI with Yjs Sync', () => {
  beforeEach(() => {
    // Clear all maps in Yjs doc before each test
    globalYDoc.getMap('customNodesMap').clear();
    globalYDoc.getMap('customEdgesMap').clear();
    globalYDoc.getMap('overrides').clear();
    globalYDoc.getMap('deletedEdgesMap').clear();
  });

  // Hashing calculation utilities identical to MindMap3D.tsx
  const calculateCustomizationHash = (overrides: any, customEdges: any[]) => {
    return [
      ...Object.entries(overrides)
        .filter(([, ov]: any) => 
          ov.customParent !== undefined || 
          ov.customOrbitIndex !== undefined || 
          ov.customLabel !== undefined || 
          ov.customColor !== undefined ||
          ov.customGroup !== undefined
        )
        .map(([id, ov]: any) => `${id}:${ov.customParent}:${ov.customOrbitIndex}:${ov.customLabel}:${ov.customColor}:${ov.customGroup}`),
      ...customEdges.map(e => `${e.source}->${e.target}:${e.type}:${e.weight}`)
    ]
      .sort()
      .join('|');
  };

  const calculateCustomNodesHash = (customNodes: any[]) => {
    return customNodes
      .map(n => `${n.id}:${n.label}:${n.group}:${n.baseValue}:${n.layerId}`)
      .sort()
      .join('|');
  };

  test('1. Verify new custom nodes storage in Yjs and customNodes array', async () => {
    const { result } = renderHook(() => useGraphCustomization(false)); // Disable polling for clean test
    
    let newNode: any;
    act(() => {
      newNode = result.current.addCustomNode(
        'New Custom Node',
        150,
        250,
        '#ff5500',
        'OTHER',
        90,
        0
      );
    });

    expect(newNode).toBeDefined();
    expect(newNode.id).toContain('custom-');
    expect(newNode.label).toBe('New Custom Node');
    expect(newNode.fixedX).toBe(150);
    expect(newNode.fixedY).toBe(250);
    expect(newNode.customColor).toBe('#ff5500');
    expect(newNode.group).toBe('OTHER');
    expect(newNode.baseValue).toBe(90);
    expect(newNode.layerId).toBe(0);

    // Confirm stored correctly in Yjs Map
    const yjsNode = globalYDoc.getMap('customNodesMap').get(newNode.id) as any;
    expect(yjsNode).toBeDefined();
    expect(yjsNode.label).toBe('New Custom Node');
    expect(yjsNode.group).toBe('OTHER');
    expect(yjsNode.baseValue).toBe(90);
    expect(yjsNode.layerId).toBe(0);

    // Wait for the debounce to populate the React state
    await act(async () => {
      await waitForHookUpdate();
    });

    // Confirm reflected in customNodes array of hook
    expect(result.current.customNodes).toHaveLength(1);
    expect(result.current.customNodes[0].id).toBe(newNode.id);
  });

  test('2. Verify new custom edges storage in Yjs and customEdges array', async () => {
    const { result } = renderHook(() => useGraphCustomization(false));

    act(() => {
      result.current.addCustomEdge('node-a', 'node-b', 'DEPENDENCY', 2.0);
    });

    // Confirm stored in Yjs Map under composite key source|||target
    const edgeKey = 'node-a|||node-b';
    const yjsEdge = globalYDoc.getMap('customEdgesMap').get(edgeKey) as any;
    expect(yjsEdge).toBeDefined();
    expect(yjsEdge.source).toBe('node-a');
    expect(yjsEdge.target).toBe('node-b');
    expect(yjsEdge.type).toBe('DEPENDENCY');
    expect(yjsEdge.weight).toBe(2.0);

    // Wait for debounce
    await act(async () => {
      await waitForHookUpdate();
    });

    // Confirm reflected in customEdges of hook
    expect(result.current.customEdges).toHaveLength(1);
    expect(result.current.customEdges[0].source).toBe('node-a');
    expect(result.current.customEdges[0].target).toBe('node-b');
  });

  test('3. Verify node deletion: confirm deleteCustomNode deletes node and related edges', async () => {
    const { result } = renderHook(() => useGraphCustomization(false));

    let nodeA: any;
    act(() => {
      nodeA = result.current.addCustomNode('Node A', 10, 10);
      result.current.addCustomEdge(nodeA.id, 'node-other1', 'DEPENDENCY', 1.0);
      result.current.addCustomEdge('node-other2', nodeA.id, 'DEPENDENCY', 1.5);
    });

    await act(async () => {
      await waitForHookUpdate();
    });

    expect(result.current.customNodes).toHaveLength(1);
    expect(result.current.customEdges).toHaveLength(2);

    // Perform deletion
    act(() => {
      result.current.deleteCustomNode(nodeA.id);
    });

    // Confirm deleted from customNodesMap
    expect(globalYDoc.getMap('customNodesMap').has(nodeA.id)).toBe(false);

    // Confirm edges where the deleted node is source or target are deleted from customEdgesMap
    expect(globalYDoc.getMap('customEdgesMap').has(`${nodeA.id}|||node-other1`)).toBe(false);
    expect(globalYDoc.getMap('customEdgesMap').has(`node-other2|||${nodeA.id}`)).toBe(false);

    await act(async () => {
      await waitForHookUpdate();
    });

    // Verify reflected in hook state
    expect(result.current.customNodes).toHaveLength(0);
    expect(result.current.customEdges).toHaveLength(0);
  });

  test('4. Verify edge unlinking: confirm deleteCustomEdge deletes the edge and sets tombstone', async () => {
    const { result } = renderHook(() => useGraphCustomization(false));

    act(() => {
      result.current.addCustomEdge('source-1', 'target-1', 'DEPENDENCY', 1.0);
    });

    await act(async () => {
      await waitForHookUpdate();
    });

    expect(result.current.customEdges).toHaveLength(1);
    expect(globalYDoc.getMap('deletedEdgesMap').has('source-1|||target-1')).toBe(false);

    // Unlink (delete custom edge)
    act(() => {
      result.current.deleteCustomEdge('source-1', 'target-1');
    });

    // Confirm edge is deleted from Yjs Map
    expect(globalYDoc.getMap('customEdgesMap').has('source-1|||target-1')).toBe(false);

    // Confirm tombstone is created
    expect(globalYDoc.getMap('deletedEdgesMap').get('source-1|||target-1')).toBe(true);

    await act(async () => {
      await waitForHookUpdate();
    });

    expect(result.current.customEdges).toHaveLength(0);
    expect(result.current.deletedEdges).toContain('source-1|||target-1');
  });

  test('5. Verify performance: coordinate changes do not modify hashes, but other fields do', async () => {
    const { result } = renderHook(() => useGraphCustomization(false));

    let node: any;
    act(() => {
      node = result.current.addCustomNode('Performance Node', 100, 100, '#000000', 'OTHER', 50, 1);
      result.current.addCustomEdge(node.id, 'node-b', 'DEPENDENCY', 1.0);
    });

    await act(async () => {
      await waitForHookUpdate();
    });

    const initNodes = result.current.customNodes;
    const initEdges = result.current.customEdges;
    const initOverrides = result.current.overrides;

    const hash1_nodes = calculateCustomNodesHash(initNodes);
    const hash1_cust = calculateCustomizationHash(initOverrides, initEdges);

    // Case A: Modify fixedX and fixedY coordinates
    act(() => {
      // Modify custom node coordinates in Yjs map
      const customNodesMap = globalYDoc.getMap('customNodesMap') as Y.Map<OntologyNode>;
      const existing = customNodesMap.get(node.id)!;
      customNodesMap.set(node.id, { ...existing, fixedX: 999, fixedY: 888 });

      // Modify existing node coordinate overrides
      result.current.setNodeOverride('existing-node-id', { fixedX: 123, fixedY: 456 });
    });

    await act(async () => {
      await waitForHookUpdate();
    });

    const updatedNodesA = result.current.customNodes;
    const updatedEdgesA = result.current.customEdges;
    const updatedOverridesA = result.current.overrides;

    const hash2_nodes = calculateCustomNodesHash(updatedNodesA);
    const hash2_cust = calculateCustomizationHash(updatedOverridesA, updatedEdgesA);

    // Assert that hashes have NOT changed after spatial update
    expect(hash2_nodes).toBe(hash1_nodes);
    expect(hash2_cust).toBe(hash1_cust);

    // Case B: Modify label/group/baseValue/layerId on custom node, or customColor/customGroup/etc. in overrides, or weight of edge
    act(() => {
      // Modify label of custom node
      const customNodesMap = globalYDoc.getMap('customNodesMap') as Y.Map<OntologyNode>;
      const existing = customNodesMap.get(node.id)!;
      customNodesMap.set(node.id, { ...existing, label: 'Name Changed' });

      // Modify visual overrides (e.g. customColor)
      result.current.setNodeOverride('existing-node-id', { customColor: '#ff00ff' });
    });

    await act(async () => {
      await waitForHookUpdate();
    });

    const updatedNodesB = result.current.customNodes;
    const updatedEdgesB = result.current.customEdges;
    const updatedOverridesB = result.current.overrides;

    const hash3_nodes = calculateCustomNodesHash(updatedNodesB);
    const hash3_cust = calculateCustomizationHash(updatedOverridesB, updatedEdgesB);

    // Assert that hashes HAVE changed after property updates
    expect(hash3_nodes).not.toBe(hash2_nodes);
    expect(hash3_cust).not.toBe(hash2_cust);
  });
});
