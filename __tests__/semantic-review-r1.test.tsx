// Set mock API key before importing any files to ensure module-level initialization reads it
process.env.GOOGLE_GEMINI_API_KEY = 'mock-key';

// Polyfill standard fetch globals in JSDOM environment before any imports
if (typeof global.Request === 'undefined') {
  global.Request = globalThis.Request;
}
if (typeof global.Response === 'undefined') {
  global.Response = globalThis.Response;
}
if (typeof global.Headers === 'undefined') {
  global.Headers = globalThis.Headers;
}

// Mock next/server to bypass Next.js server-side loading issues in JSDOM
jest.mock('next/server', () => {
  return {
    NextResponse: {
      json: jest.fn().mockImplementation((body, init) => {
        return {
          status: init?.status || 200,
          json: async () => body,
        };
      }),
    },
  };
});

import '@testing-library/jest-dom';
import { SemanticReviewModal } from '@/components/SemanticReviewModal';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

// Mock GoogleGenerativeAI
const mockGenerateContent = jest.fn();
jest.mock('@google/generative-ai', () => {
  return {
    GoogleGenerativeAI: jest.fn().mockImplementation(() => {
      return {
        getGenerativeModel: jest.fn().mockImplementation(() => {
          return {
            generateContent: mockGenerateContent,
          };
        }),
      };
    }),
  };
});

describe('AI Semantic Extraction & Review Modal (R1) Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('1. Extraction API response verification', () => {
    it('should limit nodes to at most 15 and prune dangling/self edges', async () => {
      // Dynamically import postProcessGraph from ontology-extractor engine
      const { postProcessGraph } = await import('@/lib/engine/ontology-extractor');

      // Mock Gemini response with 20 nodes and some dangling edges / self edges
      const mockNodes = Array.from({ length: 20 }, (_, i) => ({
        id: `node_${i}`,
        label: `노드_${i}의`, // label with Korean postposition (조사) "의"
        group: 'CORE_PROJECT',
        baseValue: 10 + i * 2, // baseValues from 10 to 48 (node_19 has 48, node_0 has 10)
        layerId: 2,
      }));

      const mockEdges = [
        // Valid edge between top 15 nodes (e.g. node_19 and node_18)
        { source: 'node_19', target: 'node_18', weight: 0.8, type: 'DEPENDENCY' },
        // Dangling edge (source node_0 is pruned because baseValue is low and not in top 15)
        { source: 'node_0', target: 'node_19', weight: 0.5, type: 'DEPENDENCY' },
        // Self edge (source === target)
        { source: 'node_19', target: 'node_19', weight: 0.9, type: 'DEPENDENCY' },
      ];

      const data = postProcessGraph(mockNodes, mockEdges);

      // Verify at most 15 nodes
      expect(data.nodes.length).toBeLessThanOrEqual(15);
      
      // Node IDs of the top 15 nodes should be node_5 to node_19
      const returnedNodeIds = data.nodes.map((n: any) => n.id);
      expect(returnedNodeIds).not.toContain('node_0');
      expect(returnedNodeIds).toContain('node_19');
      expect(returnedNodeIds).toContain('node_5');

      // Verify no dangling edges and no self references
      // The edge list should only contain the valid edge between top 15 nodes
      expect(data.edges.length).toBe(1);
      expect(data.edges[0]).toEqual({
        source: 'node_19',
        target: 'node_18',
        weight: 0.8,
        type: 'DEPENDENCY',
      });

      // Verify Korean labels are cleaned (removal of postposition '의')
      // "노드_19의" -> "노드_19"
      const node19 = data.nodes.find((n: any) => n.id === 'node_19');
      expect(node19.label).toBe('노드_19');
    });
  });

  describe('2. Duplicate labels and conflict warnings', () => {
    it('should generate warnings for duplicate labels and dangling/self edges in the modal', () => {
      const pendingNodes = [
        { id: 'node_1', label: '동일라벨', group: 'OTHER' as const, baseValue: 80, layerId: 3 as const },
        { id: 'node_2', label: '동일라벨', group: 'OTHER' as const, baseValue: 80, layerId: 3 as const },
        { id: 'existing_node', label: '기존노드', group: 'OTHER' as const, baseValue: 80, layerId: 3 as const },
      ];

      const pendingEdges = [
        // Self-referencing edge
        { source: 'node_1', target: 'node_1', weight: 0.5, type: 'DEPENDENCY' as const },
        // Dangling edge (target 'missing_node' is not in available node IDs)
        { source: 'node_1', target: 'missing_node', weight: 0.5, type: 'DEPENDENCY' as const },
      ];

      const existingNodeIds = new Set(['existing_node']);

      render(
        <SemanticReviewModal
          isOpen={true}
          onClose={jest.fn()}
          pendingNodes={pendingNodes}
          pendingEdges={pendingEdges}
          existingNodeIds={existingNodeIds}
          approveAndMerge={jest.fn()}
        />
      );

      // Verify that warnings are displayed
      const warningsHeader = screen.getByText(/데이터 무결성 검증 경고/i);
      expect(warningsHeader).toBeTruthy();

      // Warning 1: Node Name duplicate ('동일라벨')
      expect(screen.getByText(/노드 이름 중복: '동일라벨'이라는 이름의 노드가 검토 목록에 여러 개 포함되어 있습니다./i)).toBeTruthy();

      // Warning 2: Node ID duplicate ('existing_node' is in existingNodeIds)
      expect(screen.getByText(/노드 ID 중복: 'existing_node'\(표시명: 기존노드\)는 이미 마인드맵에 존재합니다. 병합 시 덮어써집니다./i)).toBeTruthy();

      // Warning 3: Self-referencing relationship
      expect(screen.getByText(/자기 참조 관계: '동일라벨 ➔ 동일라벨'는 스스로를 가리키는 관계입니다./i)).toBeTruthy();

      // Warning 4: Dangling edge
      expect(screen.getByText(/미연결 관계\(Dangling Edge\): '동일라벨 ➔ missing_node'의 도착 노드\('missing_node'\)가 맵에 존재하지 않고 검토 목록에도 누락되어 있습니다./i)).toBeTruthy();
    });
  });

  describe('3. Review Modal edit/delete before Yjs commit', () => {
    it('should edit and delete nodes/edges in local state before calling approveAndMerge', () => {
      const pendingNodes = [
        { id: 'node_1', label: '노드1', group: 'OTHER' as const, baseValue: 80, layerId: 3 as const },
        { id: 'node_2', label: '노드2', group: 'OTHER' as const, baseValue: 70, layerId: 3 as const },
      ];

      const pendingEdges = [
        { source: 'node_1', target: 'node_2', weight: 0.5, type: 'DEPENDENCY' as const },
      ];

      const mockApproveAndMerge = jest.fn();

      render(
        <SemanticReviewModal
          isOpen={true}
          onClose={jest.fn()}
          pendingNodes={pendingNodes}
          pendingEdges={pendingEdges}
          existingNodeIds={new Set()}
          approveAndMerge={mockApproveAndMerge}
        />
      );

      // Verify initial rendering of nodes
      const nodeInput1 = screen.getByDisplayValue('노드1');
      const nodeInput2 = screen.getByDisplayValue('노드2');
      expect(nodeInput1).toBeTruthy();
      expect(nodeInput2).toBeTruthy();

      // 1. Edit a node label
      fireEvent.change(nodeInput1, { target: { value: '수정된노드1' } });
      expect((nodeInput1 as HTMLInputElement).value).toBe('수정된노드1');

      // 2. Delete a node (should also remove associated edges)
      const deleteButtons = screen.getAllByTitle('노드 삭제');
      // Delete node_2
      fireEvent.click(deleteButtons[1]);

      // node_2 input should be gone
      expect(screen.queryByDisplayValue('노드2')).toBeNull();

      // 3. Confirm merge
      const mergeButton = screen.getByText('승인 후 마인드맵에 최종 병합');
      fireEvent.click(mergeButton);

      // Verify that approveAndMerge was called with updated nodes and pruned edges
      expect(mockApproveAndMerge).toHaveBeenCalledTimes(1);
      
      const approvedNodes = mockApproveAndMerge.mock.calls[0][0];
      const approvedEdges = mockApproveAndMerge.mock.calls[0][1];
      const skippedIds = mockApproveAndMerge.mock.calls[0][2];

      // node_1 (edited) should remain, node_2 should be deleted
      expect(approvedNodes).toHaveLength(1);
      expect(approvedNodes[0]).toEqual({
        id: 'node_1',
        label: '수정된노드1',
        group: 'OTHER',
        baseValue: 80,
        layerId: 3
      });

      // The edge source node_1 -> node_2 should be deleted since target node_2 was deleted
      expect(approvedEdges).toHaveLength(0);

      // skippedIds should contain node_2 and the deleted edge key 'node_1|||node_2'
      expect(skippedIds).toContain('node_2');
      expect(skippedIds).toContain('node_1|||node_2');
    });
  });
});
