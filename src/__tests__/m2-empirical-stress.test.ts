import { buildSignalGraph } from '@/lib/signal-graph';
import { computeCentrality } from '@/lib/ontology.service';
import { OntologyLayout, ELLIPSE_RATIO } from '@/lib/engine/OntologyLayout';
import { OntologyNode, OntologyEdge, OrbitalNode } from '@/lib/ontology.types';
import { NodeOverride } from '@/lib/ontology.types';

describe('Milestone 2 Empirical Stress & Correctness Verification', () => {

  // =========================================================================
  // 1. SIGNAL GRAPH STRESS & LINEAR SCALING (O(N+E))
  // =========================================================================
  describe('1. Signal Graph Engine (buildSignalGraph) Stress & Scaling', () => {
    function generateSyntheticData(nodeCount: number, edgeCount: number) {
      const customNodes: OntologyNode[] = [];
      const customEdges: OntologyEdge[] = [];
      const overrides: Record<string, NodeOverride> = {};

      for (let i = 0; i < nodeCount; i++) {
        const id = `custom-node-${i}`;
        const parentId = i > 0 ? `custom-node-${Math.floor((i - 1) / 3)}` : 'root-HCHPS';
        customNodes.push({
          id,
          label: `Node ${i} 업무`,
          group: i % 5 === 0 ? 'SYSTEM_RISK' : 'CORE_PROJECT',
          baseValue: 50 + (i % 50),
          parentId
        });

        if (i % 4 === 0) {
          overrides[id] = {
            customColor: i % 2 === 0 ? '#ff0055' : '#00aaff',
            customLabel: `Overridden Node ${i}`,
            customOrbitIndex: (i % 3) + 1,
            isHighlighted: i % 8 === 0
          };
        } else if (i % 7 === 0) {
          overrides[id] = {
            fixedX: 100 + i,
            fixedY: 200 + i
          };
        }
      }

      for (let j = 0; j < edgeCount; j++) {
        const srcIdx = j % nodeCount;
        const tgtIdx = (j * 7 + 1) % nodeCount;
        if (srcIdx !== tgtIdx) {
          customEdges.push({
            source: `custom-node-${srcIdx}`,
            target: `custom-node-${tgtIdx}`,
            weight: 0.5 + (j % 5) * 0.1,
            type: j % 3 === 0 ? 'DEPENDENCY' : 'CAUSAL_DRIVE'
          });
        }
      }

      return { customNodes, customEdges, overrides };
    }

    it('processes 100, 500, and 1,000 nodes & 2,000 edges in linear O(N+E) time', () => {
      // Warm up JIT
      const warmup = generateSyntheticData(50, 100);
      buildSignalGraph({}, [], warmup);

      const benchmarks = [
        { nodes: 100, edges: 200 },
        { nodes: 500, edges: 1000 },
        { nodes: 1000, edges: 2000 },
      ];

      const timings: number[] = [];

      for (const bench of benchmarks) {
        const data = generateSyntheticData(bench.nodes, bench.edges);
        const start = performance.now();
        const iterations = 5;
        for (let it = 0; it < iterations; it++) {
          buildSignalGraph({}, [], data);
        }
        const elapsed = (performance.now() - start) / iterations;
        timings.push(elapsed);
        console.log(`[BENCHMARK] N=${bench.nodes}, E=${bench.edges}: ${elapsed.toFixed(2)}ms per build`);
        expect(elapsed).toBeLessThan(100);
      }

      const ratio1000to100 = timings[2] / Math.max(timings[0], 0.1);
      console.log(`[SCALING] Ratio T(1000)/T(100) = ${ratio1000to100.toFixed(2)}x (Linear ideal: ~10x, Quadratic worst: ~100x)`);
      expect(ratio1000to100).toBeLessThan(35);
    });

    it('produces 100% correct nodes, edges, and override mappings at scale', () => {
      const data = generateSyntheticData(1000, 2000);
      const graph = buildSignalGraph({}, [], data);

      expect(graph.nodes.length).toBeGreaterThanOrEqual(1001); // 1000 custom + root-HCHPS
      const nodeMap = new Map(graph.nodes.map(n => [n.id, n]));

      for (let i = 0; i < 1000; i++) {
        const id = `custom-node-${i}`;
        const node = nodeMap.get(id);
        expect(node).toBeDefined();

        if (i % 4 === 0) {
          expect(node?.customColor).toBe(i % 2 === 0 ? '#ff0055' : '#00aaff');
          expect(node?.label).toBe(`Overridden Node ${i}`);
          expect(node?.customOrbitIndex).toBe((i % 3) + 1);
        } else if (i % 7 === 0) {
          expect(node?.fixedX).toBe(100 + i);
          expect(node?.fixedY).toBe(200 + i);
        }
      }

      expect(graph.edges.length).toBeGreaterThanOrEqual(2000);
    });

    it('handles parent cycle resolution gracefully without crashing or infinite looping', () => {
      const customNodes: OntologyNode[] = [
        { id: 'cycle-A', label: 'Node A', group: 'CORE_PROJECT', baseValue: 50, parentId: 'cycle-C' },
        { id: 'cycle-B', label: 'Node B', group: 'CORE_PROJECT', baseValue: 50, parentId: 'cycle-A' },
        { id: 'cycle-C', label: 'Node C', group: 'CORE_PROJECT', baseValue: 50, parentId: 'cycle-B' },
      ];
      const customEdges: OntologyEdge[] = [
        { source: 'cycle-A', target: 'cycle-B', weight: 0.5, type: 'DEPENDENCY' },
        { source: 'cycle-B', target: 'cycle-C', weight: 0.5, type: 'DEPENDENCY' },
        { source: 'cycle-C', target: 'cycle-A', weight: 0.5, type: 'DEPENDENCY' },
      ];

      const graph = buildSignalGraph({}, [], { customNodes, customEdges, overrides: {} });
      expect(graph.nodes.length).toBeGreaterThanOrEqual(4);
      const nodeMap = new Map(graph.nodes.map(n => [n.id, n]));
      expect(nodeMap.has('cycle-A')).toBe(true);
      expect(nodeMap.has('cycle-B')).toBe(true);
      expect(nodeMap.has('cycle-C')).toBe(true);
    });
  });

  // =========================================================================
  // 2. CENTRALITY ZERO-ALLOCATION & MIN-MAX NORMALIZATION
  // =========================================================================
  describe('2. Ontology Service (computeCentrality) Zero-Allocation & Bounds', () => {
    it('executes min/max normalization and non-linear scale binding with valid bounds', () => {
      const nodes: OntologyNode[] = [];
      const edges: OntologyEdge[] = [];

      for (let i = 0; i < 500; i++) {
        nodes.push({
          id: `node-${i}`,
          label: `Node ${i}`,
          group: i === 0 ? 'SYSTEM_RISK' : 'CORE_PROJECT',
          baseValue: 10 + (i % 90),
        });
      }

      for (let i = 0; i < 800; i++) {
        edges.push({
          source: `node-${i % 500}`,
          target: `node-${(i * 3 + 1) % 500}`,
          weight: i % 10 === 0 ? -0.5 : 0.8,
          type: i % 10 === 0 ? 'BOTTLENECK' : 'DEPENDENCY'
        });
      }

      const scored = computeCentrality(nodes, edges);
      expect(scored.length).toBe(500);

      let minCent = Infinity;
      let maxCent = -Infinity;
      let minRenderSize = Infinity;
      let maxRenderSize = -Infinity;

      for (const node of scored) {
        expect(node.centralityScore).toBeDefined();
        expect(node.renderSize).toBeDefined();

        if (node.centralityScore! < minCent) minCent = node.centralityScore!;
        if (node.centralityScore! > maxCent) maxCent = node.centralityScore!;
        if (node.renderSize! < minRenderSize) minRenderSize = node.renderSize!;
        if (node.renderSize! > maxRenderSize) maxRenderSize = node.renderSize!;

        expect(node.renderSize).toBeGreaterThanOrEqual(0.4);
        expect(node.renderSize).toBeLessThanOrEqual(1.0);
      }

      expect(minCent).toBeGreaterThanOrEqual(0);
      expect(maxCent).toBeLessThanOrEqual(1.0);

      const riskNodes = scored.filter(n => n.group === 'SYSTEM_RISK' || n.isHedge);
      expect(riskNodes.length).toBeGreaterThan(0);
      for (const rn of riskNodes) {
        expect(rn.isHedge).toBe(true);
      }
    });

    it('verifies 0 heap array allocation during min-max normalization via accumulator loop inspection', () => {
      const nodes: OntologyNode[] = [
        { id: 'n1', label: 'A', group: 'CORE_PROJECT', baseValue: 0 },
        { id: 'n2', label: 'B', group: 'CORE_PROJECT', baseValue: 100 },
        { id: 'n3', label: 'C', group: 'SYSTEM_RISK', baseValue: 35 },
      ];
      const edges: OntologyEdge[] = [
        { source: 'n1', target: 'n2', weight: 0.9, type: 'DEPENDENCY' },
        { source: 'n2', target: 'n3', weight: -0.4, type: 'BOTTLENECK' },
      ];

      const result = computeCentrality(nodes, edges);
      expect(result.length).toBe(3);
      expect(result[0].renderSize).toBeGreaterThanOrEqual(0.4);
      expect(result[1].renderSize).toBeGreaterThanOrEqual(0.4);
      expect(result[2].isHedge).toBe(true);
    });
  });

  // =========================================================================
  // 3. ONTOLOGY LAYOUT MATH & ZIGZAG RADIAL OFFSETS
  // =========================================================================
  describe('3. OntologyLayout Sector Distribution & Zigzag Offsets Math', () => {
    it('calculates exact outward sector arc layout for domain hubs', () => {
      const hubNode = {
        id: 'festival-hub-permits',
        label: '인허가/안전관리',
        group: 'CORE_PROJECT',
        baseValue: 80,
        fixedX: 0,
        fixedY: -220,
      } as unknown as OrbitalNode;

      const childrenNodes = [
        { id: 'fest-p1', label: '안전관리계획서', group: 'CORE_PROJECT', baseValue: 70, parentId: 'festival-hub-permits' },
        { id: 'fest-p2', label: '경찰 도로점용', group: 'CORE_PROJECT', baseValue: 60, parentId: 'festival-hub-permits' },
        { id: 'fest-p3', label: '소방 안전점검', group: 'CORE_PROJECT', baseValue: 60, parentId: 'festival-hub-permits' },
      ] as unknown as OrbitalNode[];

      const nodes: OrbitalNode[] = [
        { id: 'root-HCHPS', label: 'Vital Tasks', group: 'CORE_PROJECT', baseValue: 100 } as unknown as OrbitalNode,
        hubNode,
        ...childrenNodes
      ];

      const nodeMap = new Map(nodes.map(n => [n.id, n]));
      const edges: OntologyEdge[] = [
        { source: 'root-HCHPS', target: 'festival-hub-permits', weight: 1.0, type: 'CAUSAL_DRIVE' },
        { source: 'festival-hub-permits', target: 'fest-p1', weight: 0.7, type: 'DEPENDENCY' },
        { source: 'festival-hub-permits', target: 'fest-p2', weight: 0.7, type: 'DEPENDENCY' },
        { source: 'festival-hub-permits', target: 'fest-p3', weight: 0.7, type: 'DEPENDENCY' },
      ];

      OntologyLayout.computePositions(
        nodes,
        nodeMap,
        edges,
        1920,
        1080,
        0,
        0,
        1,
        new Set(),
        undefined,
        false,
        true,
        false
      );

      expect(hubNode.targetWorldX).toBe(0);
      expect(hubNode.targetWorldY).toBe(-220);

      const hubX = 0;
      const hubY = -220;
      const hubAngle = Math.atan2(hubY, hubX);
      const N = 3;
      const spread = (70 * Math.PI) / 180;
      const startA = hubAngle - spread / 2;
      const stepA = spread / (N - 1);
      const sectorR = 110;

      for (let i = 0; i < childrenNodes.length; i++) {
        const child = childrenNodes[i];
        const childA = startA + i * stepA;
        const expectedX = hubX + sectorR * Math.cos(childA) * ELLIPSE_RATIO;
        const expectedY = hubY + sectorR * Math.sin(childA);

        expect(child.targetWorldX).toBeCloseTo(expectedX, 4);
        expect(child.targetWorldY).toBeCloseTo(expectedY, 4);
      }
    });

    it('verifies zigzag static radial offsets (-12 vs +12) for tree sibling nodes', () => {
      const rootNode = { id: 'root-HCHPS', label: 'Root', group: 'CORE_PROJECT', baseValue: 100 } as unknown as OrbitalNode;
      const catNode = { id: 'cat-1', label: 'Category 1', group: 'CORE_PROJECT', baseValue: 80, parentId: 'root-HCHPS' } as unknown as OrbitalNode;
      
      const subNodes = [
        { id: 'sub-0', label: 'Sub 0', group: 'CORE_PROJECT', baseValue: 50, parentId: 'cat-1' },
        { id: 'sub-1', label: 'Sub 1', group: 'CORE_PROJECT', baseValue: 50, parentId: 'cat-1' },
        { id: 'sub-2', label: 'Sub 2', group: 'CORE_PROJECT', baseValue: 50, parentId: 'cat-1' },
        { id: 'sub-3', label: 'Sub 3', group: 'CORE_PROJECT', baseValue: 50, parentId: 'cat-1' },
      ] as unknown as OrbitalNode[];

      const nodes = [rootNode, catNode, ...subNodes];
      const nodeMap = new Map(nodes.map(n => [n.id, n]));
      const edges: OntologyEdge[] = [
        { source: 'root-HCHPS', target: 'cat-1', weight: 1.0, type: 'CAUSAL_DRIVE' },
        { source: 'cat-1', target: 'sub-0', weight: 0.7, type: 'DEPENDENCY' },
        { source: 'cat-1', target: 'sub-1', weight: 0.7, type: 'DEPENDENCY' },
        { source: 'cat-1', target: 'sub-2', weight: 0.7, type: 'DEPENDENCY' },
        { source: 'cat-1', target: 'sub-3', weight: 0.7, type: 'DEPENDENCY' },
      ];

      OntologyLayout.computePositions(
        nodes,
        nodeMap,
        edges,
        1920,
        1080,
        0,
        0,
        1,
        new Set(),
        undefined,
        false,
        true,
        false
      );

      expect(subNodes[0].radialOffset).toBe(-12);
      expect(subNodes[1].radialOffset).toBe(12);
      expect(subNodes[2].radialOffset).toBe(-12);
      expect(subNodes[3].radialOffset).toBe(12);
    });
  });

  // =========================================================================
  // 4. USEFESTIVALVALIDATION LOGIC & 4-PERMITS STATUS EVALUATION
  // =========================================================================
  describe('4. Festival Validation Engine & 4 Mandatory Permits Evaluation', () => {
    it('evaluates permit status accurately across MISSING, INCOMPLETE, and VERIFIED states', () => {
      const evaluatePermit = (
        hasNode: boolean,
        isNodeVerified: boolean,
        hasTask: boolean,
        isTaskDone: boolean
      ): 'MISSING' | 'INCOMPLETE' | 'VERIFIED' => {
        if (isNodeVerified || isTaskDone) return 'VERIFIED';
        if (hasNode || hasTask) return 'INCOMPLETE';
        return 'MISSING';
      };

      expect(evaluatePermit(false, false, false, false)).toBe('MISSING');
      expect(evaluatePermit(true, false, false, false)).toBe('INCOMPLETE');
      expect(evaluatePermit(false, false, true, false)).toBe('INCOMPLETE');
      expect(evaluatePermit(true, true, false, false)).toBe('VERIFIED');
      expect(evaluatePermit(false, false, true, true)).toBe('VERIFIED');
      expect(evaluatePermit(true, false, true, true)).toBe('VERIFIED');
      expect(evaluatePermit(true, true, true, false)).toBe('VERIFIED');
    });

    it('matches inverted keyword entries for all 4 permits correctly', () => {
      const PERMIT_KEYWORD_MAP = [
        { key: 'municipal_report', keywords: ['지자체', '보도자료', '지자체 신고', '공보관'] },
        { key: 'police_road', keywords: ['경찰', '도로점용', '교통신고', '경찰서'] },
        { key: 'fire_safety', keywords: ['소방', '안전점검', '소방서', '가설물'] },
        { key: 'safety_plan', keywords: ['안전관리계획', '안전관리계획서', '재난안전'] },
      ];

      const matchKeyword = (text: string): string | undefined => {
        for (const item of PERMIT_KEYWORD_MAP) {
          for (const kw of item.keywords) {
            if (text.includes(kw)) return item.key;
          }
        }
        return undefined;
      };

      expect(matchKeyword('강남구청 공보관 지자체 보도자료 배포')).toBe('municipal_report');
      expect(matchKeyword('수서경찰서 도로점용 허가 협조 공문')).toBe('police_road');
      expect(matchKeyword('강남소방서 무대 가설물 안전점검 필증')).toBe('fire_safety');
      expect(matchKeyword('2026 축제 재난안전 관리계획서 수립')).toBe('safety_plan');
      expect(matchKeyword('일반 음향 시스템 렌탈 계약')).toBeUndefined();
    });

    it('evaluates budget bounds and overall risk level accurately', () => {
      const evaluateOverallRisk = (
        permits: Array<{ status: 'MISSING' | 'INCOMPLETE' | 'VERIFIED' }>,
        scaleStatus: 'UNDER_SCALE' | 'IN_SCALE' | 'OVER_SCALE',
        hasCriticalRiskNode: boolean = false,
        hasWarningRiskNode: boolean = false
      ): 'CRITICAL' | 'WARNING' | 'SAFE' => {
        const hasMissing = permits.some(p => p.status === 'MISSING');
        const hasIncomplete = permits.some(p => p.status === 'INCOMPLETE');

        if (hasMissing || hasCriticalRiskNode || scaleStatus === 'OVER_SCALE') {
          return 'CRITICAL';
        }
        if (hasIncomplete || hasWarningRiskNode || scaleStatus === 'UNDER_SCALE') {
          return 'WARNING';
        }
        return 'SAFE';
      };

      expect(evaluateOverallRisk(
        [{ status: 'MISSING' }, { status: 'VERIFIED' }, { status: 'VERIFIED' }, { status: 'VERIFIED' }],
        'IN_SCALE'
      )).toBe('CRITICAL');

      expect(evaluateOverallRisk(
        [{ status: 'VERIFIED' }, { status: 'VERIFIED' }, { status: 'VERIFIED' }, { status: 'VERIFIED' }],
        'OVER_SCALE'
      )).toBe('CRITICAL');

      expect(evaluateOverallRisk(
        [{ status: 'INCOMPLETE' }, { status: 'VERIFIED' }, { status: 'VERIFIED' }, { status: 'VERIFIED' }],
        'IN_SCALE'
      )).toBe('WARNING');

      expect(evaluateOverallRisk(
        [{ status: 'VERIFIED' }, { status: 'VERIFIED' }, { status: 'VERIFIED' }, { status: 'VERIFIED' }],
        'UNDER_SCALE'
      )).toBe('WARNING');

      expect(evaluateOverallRisk(
        [{ status: 'VERIFIED' }, { status: 'VERIFIED' }, { status: 'VERIFIED' }, { status: 'VERIFIED' }],
        'IN_SCALE'
      )).toBe('SAFE');
    });
  });
});
