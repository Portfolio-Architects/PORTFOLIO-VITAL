import { renderHook, act, waitFor } from '@testing-library/react';
import { useGraphCustomization, NodeOverride } from '@/__tests__/fixtures/useGraphCustomization';
import { globalYDoc } from '@/hooks/useYjsStore';
import { OntologyNode, OntologyEdge } from '@/lib/ontology.types';
import * as Y from 'yjs';

// Mock Yjs network/storage dependencies to prevent connection errors in Node/JSDOM
jest.mock('y-partykit/provider', () => {
  return jest.fn().mockImplementation(() => ({
    destroy: jest.fn(),
  }));
});

jest.mock('y-indexeddb', () => {
  return {
    IndexeddbPersistence: jest.fn().mockImplementation(() => ({
      destroy: jest.fn(),
    })),
    storeState: jest.fn(),
  };
});

jest.mock('@/lib/sheets-api', () => ({
  readSheet: jest.fn().mockResolvedValue([]),
  replaceAll: jest.fn().mockResolvedValue(true),
}));

jest.mock('@/lib/crypto', () => ({
  getAuthToken: jest.fn().mockReturnValue('mock-token'),
}));

// Helper to calculate hashes exactly as in MindMap3D.tsx
function calculateHashes(overrides: Record<string, NodeOverride>, customNodes: OntologyNode[], customEdges: OntologyEdge[]) {
  const customizationHash = [
    ...Object.entries(overrides)
      .filter(([, ov]) => 
        ov.customParent !== undefined || 
        ov.customOrbitIndex !== undefined || 
        ov.customLabel !== undefined || 
        ov.customColor !== undefined ||
        ov.customGroup !== undefined
      )
      .map(([id, ov]) => `${id}:${ov.customParent}:${ov.customOrbitIndex}:${ov.customLabel}:${ov.customColor}:${ov.customGroup}`),
    ...customEdges.map(e => `${e.source}->${e.target}:${e.type}:${e.weight}`)
  ]
    .sort()
    .join('|');

  const customNodesHash = customNodes
    .map(n => `${n.id}:${n.label}:${n.group}:${n.baseValue}:${n.layerId}`)
    .sort()
    .join('|');

  return { customizationHash, customNodesHash };
}

describe('useGraphCustomization Hook M3 CRUD & Sync Verification', () => {
  beforeEach(() => {
    // Clear global Yjs document maps before each test to ensure test isolation
    globalYDoc.transact(() => {
      ['overrides', 'customNodesMap', 'customEdgesMap', 'deletedEdgesMap'].forEach(name => {
        const m = globalYDoc.getMap(name);
        Array.from(m.keys()).forEach(k => m.delete(k));
      });
    });
    
    jest.useFakeTimers();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('1. should store custom nodes in Yjs and reflect them in customNodes array', async () => {
    const { result } = renderHook(() => useGraphCustomization(true));

    // Wait for the async cloud loading to complete
    await act(async () => {
      jest.advanceTimersByTime(1);
    });
    await waitFor(() => {
      expect(result.current.isCloudLoaded).toBe(true);
    });

    let addedNode: OntologyNode;
    act(() => {
      addedNode = result.current.addCustomNode(
        '새로운 테스트 노드',
        150.0,
        250.0,
        '#ff0000',
        'OTHER',
        85,
        2
      );
    });

    // Verify stored directly in Yjs customNodesMap
    const yMap = globalYDoc.getMap('customNodesMap');
    const nodeInYjs = yMap.get(addedNode!.id) as OntologyNode;
    expect(nodeInYjs).toBeDefined();
    expect(nodeInYjs.label).toBe('새로운 테스트 노드');
    expect(nodeInYjs.fixedX).toBe(150.0);
    expect(nodeInYjs.fixedY).toBe(250.0);
    expect(nodeInYjs.customColor).toBe('#ff0000');
    expect(nodeInYjs.group).toBe('OTHER');
    expect(nodeInYjs.baseValue).toBe(85);
    expect(nodeInYjs.layerId).toBe(2);

    // Let the 16ms debounce sync react state
    act(() => {
      jest.advanceTimersByTime(20);
    });

    // Verify reflected in customNodes array
    const nodes = result.current.customNodes;
    expect(nodes).toHaveLength(1);
    expect(nodes[0]).toEqual(nodeInYjs);
  });

  it('2. should store custom edges in Yjs and reflect them in customEdges array', async () => {
    const { result } = renderHook(() => useGraphCustomization(true));

    await act(async () => {
      jest.advanceTimersByTime(1);
    });
    await waitFor(() => {
      expect(result.current.isCloudLoaded).toBe(true);
    });

    act(() => {
      result.current.addCustomEdge('node-a', 'node-b', 'DEPENDENCY', 1.8);
    });

    // Verify stored directly in Yjs customEdgesMap
    const yMap = globalYDoc.getMap('customEdgesMap');
    const edgeInYjs = yMap.get('node-a|||node-b') as OntologyEdge;
    expect(edgeInYjs).toBeDefined();
    expect(edgeInYjs.source).toBe('node-a');
    expect(edgeInYjs.target).toBe('node-b');
    expect(edgeInYjs.type).toBe('DEPENDENCY');
    expect(edgeInYjs.weight).toBe(1.8);

    // Let the 16ms debounce sync react state
    act(() => {
      jest.advanceTimersByTime(20);
    });

    // Verify reflected in customEdges array
    const edges = result.current.customEdges;
    expect(edges).toHaveLength(1);
    expect(edges[0]).toEqual(edgeInYjs);
  });

  it('3. should delete node from customNodesMap and clean up connected edges and overrides', async () => {
    const { result } = renderHook(() => useGraphCustomization(true));

    await act(async () => {
      jest.advanceTimersByTime(1);
    });
    await waitFor(() => {
      expect(result.current.isCloudLoaded).toBe(true);
    });

    let nodeA: OntologyNode;
    let nodeB: OntologyNode;
    act(() => {
      nodeA = result.current.addCustomNode('Node A', 10, 10, undefined, 'CORE_PROJECT', 100, 1);
      nodeB = result.current.addCustomNode('Node B', 20, 20, undefined, 'CORE_PROJECT', 90, 1);
      result.current.addCustomEdge(nodeA.id, nodeB.id, 'DEPENDENCY', 1.0);
      result.current.setNodeOverride(nodeA.id, { customColor: '#00ff00', fixedX: 100 });
    });

    act(() => {
      jest.advanceTimersByTime(20);
    });

    // Ensure they exist initially
    expect(globalYDoc.getMap('customNodesMap').has(nodeA!.id)).toBe(true);
    expect(globalYDoc.getMap('customEdgesMap').has(`${nodeA!.id}|||${nodeB!.id}`)).toBe(true);
    expect(globalYDoc.getMap('overrides').has(nodeA!.id)).toBe(true);

    // Act: Delete nodeA
    act(() => {
      result.current.deleteCustomNode(nodeA!.id);
    });

    act(() => {
      jest.advanceTimersByTime(20);
    });

    // Verify node deleted
    expect(globalYDoc.getMap('customNodesMap').has(nodeA!.id)).toBe(false);
    expect(result.current.customNodes.some(n => n.id === nodeA!.id)).toBe(false);

    // Verify connected edge deleted
    expect(globalYDoc.getMap('customEdgesMap').has(`${nodeA!.id}|||${nodeB!.id}`)).toBe(false);
    expect(result.current.customEdges.some(e => e.source === nodeA!.id || e.target === nodeA!.id)).toBe(false);

    // Verify overrides cleaned up
    expect(globalYDoc.getMap('overrides').has(nodeA!.id)).toBe(false);
  });

  it('4. should delete edge and set tombstone in deletedEdgesMap when unlinking', async () => {
    const { result } = renderHook(() => useGraphCustomization(true));

    await act(async () => {
      jest.advanceTimersByTime(1);
    });
    await waitFor(() => {
      expect(result.current.isCloudLoaded).toBe(true);
    });

    act(() => {
      result.current.addCustomEdge('node-x', 'node-y', 'DEPENDENCY', 2.0);
    });

    act(() => {
      jest.advanceTimersByTime(20);
    });

    // Ensure edge exists
    expect(globalYDoc.getMap('customEdgesMap').has('node-x|||node-y')).toBe(true);

    // Act: Delete custom edge
    act(() => {
      result.current.deleteCustomEdge('node-x', 'node-y');
    });

    act(() => {
      jest.advanceTimersByTime(20);
    });

    // Verify edge deleted
    expect(globalYDoc.getMap('customEdgesMap').has('node-x|||node-y')).toBe(false);
    expect(result.current.customEdges).toHaveLength(0);

    // Verify tombstone is set to prevent recovery during cloud synchronization
    expect(globalYDoc.getMap('deletedEdgesMap').get('node-x|||node-y')).toBe(true);
    expect(result.current.deletedEdges).toContain('node-x|||node-y');
  });

  it('5. should not change hashes when changing fixedX/fixedY coordinates, but should change when modifying structural fields', async () => {
    const { result } = renderHook(() => useGraphCustomization(true));

    await act(async () => {
      jest.advanceTimersByTime(1);
    });
    await waitFor(() => {
      expect(result.current.isCloudLoaded).toBe(true);
    });

    let node: OntologyNode;
    act(() => {
      node = result.current.addCustomNode('Perf Node', 100, 100, undefined, 'OTHER', 50, 3);
      result.current.addCustomEdge(node.id, 'target-node', 'DEPENDENCY', 1.0);
    });

    act(() => {
      jest.advanceTimersByTime(20);
    });

    const initialSnapshot = result.current;
    const initialHashes = calculateHashes(initialSnapshot.overrides, initialSnapshot.customNodes, initialSnapshot.customEdges);

    // Action A: Update node position coordinates (simulate dragging)
    act(() => {
      // 1. Update override fixedX/fixedY
      result.current.setNodeOverride(node!.id, { fixedX: 250, fixedY: 350 });
      // 2. Modify Yjs customNodesMap directly to simulate position update without modifying other props
      const customNodesMap = globalYDoc.getMap('customNodesMap') as Y.Map<OntologyNode>;
      const existing = customNodesMap.get(node!.id);
      if (existing) {
        customNodesMap.set(node!.id, { ...existing, fixedX: 250, fixedY: 350 });
      }
    });

    act(() => {
      jest.advanceTimersByTime(20);
    });

    const postCoordSnapshot = result.current;
    const postCoordHashes = calculateHashes(postCoordSnapshot.overrides, postCoordSnapshot.customNodes, postCoordSnapshot.customEdges);

    // Verify coordinates update DOES NOT affect any of the hashes (drag performance protection)
    expect(postCoordHashes.customizationHash).toBe(initialHashes.customizationHash);
    expect(postCoordHashes.customNodesHash).toBe(initialHashes.customNodesHash);

    // Action B: Modify label (structural change)
    act(() => {
      result.current.updateCustomNodeText(node!.id, 'Updated Label');
    });

    act(() => {
      jest.advanceTimersByTime(20);
    });

    const postLabelSnapshot = result.current;
    const postLabelHashes = calculateHashes(postLabelSnapshot.overrides, postLabelSnapshot.customNodes, postLabelSnapshot.customEdges);

    // Verify customNodesHash changed
    expect(postLabelHashes.customNodesHash).not.toBe(initialHashes.customNodesHash);

    // Action C: Modify edge weight (structural change)
    act(() => {
      // Directly modify the Yjs edge weight to simulate an update (since addCustomEdge has "not exists" guard)
      const customEdgesMap = globalYDoc.getMap('customEdgesMap') as Y.Map<OntologyEdge>;
      const existing = customEdgesMap.get(`${node!.id}|||target-node`);
      if (existing) {
        customEdgesMap.set(`${node!.id}|||target-node`, { ...existing, weight: 3.5 });
      }
    });

    act(() => {
      jest.advanceTimersByTime(20);
    });

    const postEdgeSnapshot = result.current;
    const postEdgeHashes = calculateHashes(postEdgeSnapshot.overrides, postEdgeSnapshot.customNodes, postEdgeSnapshot.customEdges);

    // Verify customizationHash changed
    expect(postEdgeHashes.customizationHash).not.toBe(initialHashes.customizationHash);
  });

  it('6. should clear hidden flag on overrides when adding a custom node whose name matches a tombstone override (ID or customLabel)', async () => {
    const { result } = renderHook(() => useGraphCustomization(true));

    await act(async () => {
      jest.advanceTimersByTime(1);
    });
    await waitFor(() => {
      expect(result.current.isCloudLoaded).toBe(true);
    });

    // 1. Setup a hidden override with key matching tag-${labelLower}
    globalYDoc.transact(() => {
      const overridesMap = globalYDoc.getMap('overrides');
      overridesMap.set('tag-testnode', { hidden: true, customLabel: 'TestNode' });
    });

    // 2. Add custom node with matching label
    act(() => {
      result.current.addCustomNode('TestNode', 10, 20);
    });

    // Let the Yjs transaction and react states synchronize
    act(() => {
      jest.advanceTimersByTime(20);
    });

    // 3. Verify that hidden is now null
    const overridesMap = globalYDoc.getMap('overrides');
    const ov = overridesMap.get('tag-testnode') as NodeOverride;
    expect(ov).toBeDefined();
    expect(ov.hidden).toBeNull();
  });

  it('7. should update weight and type on custom edge if edge (or reverse edge) already exists', async () => {
    const { result } = renderHook(() => useGraphCustomization(true));

    await act(async () => {
      jest.advanceTimersByTime(1);
    });
    await waitFor(() => {
      expect(result.current.isCloudLoaded).toBe(true);
    });

    // 1. Add edge
    act(() => {
      result.current.addCustomEdge('node-1', 'node-2', 'DEPENDENCY', 1.0);
    });

    act(() => {
      jest.advanceTimersByTime(20);
    });

    // 2. Try to add same edge again with different type/weight (should update)
    act(() => {
      result.current.addCustomEdge('node-1', 'node-2', 'COMPONENTS', 2.5);
    });

    act(() => {
      jest.advanceTimersByTime(20);
    });

    const edge = globalYDoc.getMap('customEdgesMap').get('node-1|||node-2') as OntologyEdge;
    expect(edge).toBeDefined();
    expect(edge.type).toBe('COMPONENTS');
    expect(edge.weight).toBe(2.5);

    // 3. Try to add reverse edge (node-2|||node-1) (should update the existing node-1|||node-2 edge instead of creating a new one)
    act(() => {
      result.current.addCustomEdge('node-2', 'node-1', 'FEEDBACK_LOOP', 3.0);
    });

    act(() => {
      jest.advanceTimersByTime(20);
    });

    const edgeUpdated = globalYDoc.getMap('customEdgesMap').get('node-1|||node-2') as OntologyEdge;
    expect(edgeUpdated).toBeDefined();
    expect(edgeUpdated.type).toBe('FEEDBACK_LOOP');
    expect(edgeUpdated.weight).toBe(3.0);
    expect(globalYDoc.getMap('customEdgesMap').has('node-2|||node-1')).toBe(false);
  });
});
