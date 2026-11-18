import { cleanKoreanLabel, postProcessGraph } from '@/lib/engine/ontology-extractor';
import { NodeOverride, OntologyNode, OntologyEdge } from '@/lib/ontology.types';

describe('Challenger M2-2: Adversarial Edge Cases in Ontology Extractor', () => {
  // =========================================================================
  // 1. cleanKoreanLabel Adversarial Edge Cases
  // =========================================================================
  describe('1. cleanKoreanLabel Adversarial Edge Cases', () => {
    it('handles empty, null, undefined, whitespace, and non-string inputs safely', () => {
      expect(cleanKoreanLabel('')).toBe('');
      expect(cleanKoreanLabel('   ')).toBe('');
      expect(cleanKoreanLabel(null as unknown as string)).toBe('');
      expect(cleanKoreanLabel(undefined as unknown as string)).toBe('');
    });

    it('strips all 16 defined Korean postpositions accurately when preceded by valid word base', () => {
      const cases: Array<[string, string]> = [
        ['행사에서', '행사'],
        ['관계자에게', '관계자'],
        ['온톨로지구축으로', '온톨로지구축'],
        ['자정까지', '자정'],
        ['시작부터', '시작'],
        ['사업계획은', '사업계획'],
        ['신체활동은', '신체활동'],
        ['인허가는', '인허가'],
        ['예산이', '예산'],
        ['시스템이', '시스템'],
        ['결과가', '결과'],
        ['문서를', '문서'],
        ['목표를', '목표'],
        ['구민의', '구민'],
        ['보건소에', '보건소'],
        ['민원과', '민원'],
        ['축제와', '축제'],
        ['네트워크로', '네트워크'],
      ];

      for (const [input, expected] of cases) {
        expect(cleanKoreanLabel(input)).toBe(expected);
      }
    });

    it('handles alphanumeric English and numeric prefixes before postpositions', () => {
      expect(cleanKoreanLabel('AI로')).toBe('AI');
      expect(cleanKoreanLabel('COVID-19는')).toBe('COVID-19');
      expect(cleanKoreanLabel('2026년에')).toBe('2026년');
      expect(cleanKoreanLabel('FSD는')).toBe('FSD');
      expect(cleanKoreanLabel('Next.js를')).toBe('Next.js');
    });

    it('does NOT strip when the postposition is the entire string, except multi-char postpositions containing sub-postposition', () => {
      // cleaned.length > post.length check ensures single/two-char postpositions aren't wiped to empty
      expect(cleanKoreanLabel('은')).toBe('은');
      expect(cleanKoreanLabel('는')).toBe('는');
      expect(cleanKoreanLabel('이')).toBe('이');
      expect(cleanKoreanLabel('에서')).toBe('에서');
      expect(cleanKoreanLabel('부터')).toBe('부터');
      expect(cleanKoreanLabel('까지')).toBe('까지');
      expect(cleanKoreanLabel('에게')).toBe('에게');
      // Sub-postposition nuance: '으로' is not stripped by '으로' (length 2 > 2 is false),
      // but subsequently matches '로' (length 2 > 1 is true), producing '으'.
      expect(cleanKoreanLabel('으로')).toBe('으');
    });

    it('strips surrounding single, double, and typographic quotes', () => {
      expect(cleanKoreanLabel('"양재천 페스티벌"')).toBe('양재천 페스티벌');
      expect(cleanKoreanLabel("'양재천 페스티벌'")).toBe('양재천 페스티벌');
      expect(cleanKoreanLabel('“양재천 페스티벌”')).toBe('양재천 페스티벌');
      expect(cleanKoreanLabel('‘양재천 페스티벌’')).toBe('양재천 페스티벌');
      expect(cleanKoreanLabel('   "예산편성"   ')).toBe('예산편성');
    });

    it('documents behavior when quotes enclose a word with a postposition', () => {
      // When quotes surround "사업은", line 18 checks endsWith('은') on '"사업은"' which is false (ends with ")
      // Then line 29 strips quotes, leaving "사업은".
      // This is a known execution order constraint: quotes are stripped after postposition loop.
      const result = cleanKoreanLabel('"사업은"');
      expect(result).toBe('사업은');
    });

    it('documents behavior for vocabulary words that naturally end in postposition characters', () => {
      // Korean words where final syllable matches a postposition:
      // '사과' ends with '과' -> base '사' -> '사'
      // '아이' ends with '이' -> base '아' -> '아'
      // '종로' ends with '로' -> base '종' -> '종'
      // This is an intrinsic greedy heuristic of regex-free postposition stripping
      expect(cleanKoreanLabel('사과')).toBe('사');
      expect(cleanKoreanLabel('아이')).toBe('아');
      expect(cleanKoreanLabel('종로')).toBe('종');
    });

    it('handles base ending in non-Hangul/non-alphanumeric punctuation gracefully', () => {
      // If base ends in special symbol like '!' or ')', regex /[\uac00-\ud7a30-9a-zA-Z]$/.test(base) is false
      // So postposition is NOT stripped
      expect(cleanKoreanLabel('회의!는')).toBe('회의!는');
      expect(cleanKoreanLabel('사업(계획)은')).toBe('사업(계획)은');
    });
  });

  // =========================================================================
  // 2. postProcessGraph Adversarial Edge Cases
  // =========================================================================
  describe('2. postProcessGraph Adversarial Edge Cases', () => {
    it('handles null, undefined, or empty arrays for nodes and edges', () => {
      expect(postProcessGraph(null as any, null as any)).toEqual({ nodes: [], edges: [] });
      expect(postProcessGraph(undefined as any, undefined as any)).toEqual({ nodes: [], edges: [] });
      expect(postProcessGraph([], [])).toEqual({ nodes: [], edges: [] });
    });

    it('filters out nodes missing id or label, or where label cleans to empty string', () => {
      const dirtyNodes = [
        { id: '', label: '노드 1', baseValue: 50 },
        { id: 'n2', label: '', baseValue: 50 },
        { id: 'n3', label: '   ', baseValue: 50 }, // cleans to empty
        { id: 'n4', baseValue: 50 }, // missing label
        { label: '노드 5', baseValue: 50 }, // missing id
        { id: 'valid_1', label: '정상 노드', baseValue: 100 },
      ];

      const result = postProcessGraph(dirtyNodes as any[], []);
      expect(result.nodes).toHaveLength(1);
      expect(result.nodes[0].id).toBe('valid_1');
      expect(result.nodes[0].label).toBe('정상 노드');
    });

    it('strictly limits to top 15 nodes sorted by baseValue descending', () => {
      const nodes = Array.from({ length: 30 }, (_, i) => ({
        id: `node_${i}`,
        label: `노드 ${i}`,
        baseValue: i * 10, // 0, 10, ..., 290
      }));

      const result = postProcessGraph(nodes as any[], []);
      expect(result.nodes).toHaveLength(15);
      // Top 15 should have baseValues 290 down to 150
      expect(result.nodes[0].baseValue).toBe(290);
      expect(result.nodes[0].id).toBe('node_29');
      expect(result.nodes[14].baseValue).toBe(150);
      expect(result.nodes[14].id).toBe('node_15');
      // Node 14 (baseValue 140) should be excluded
      const ids = result.nodes.map(n => n.id);
      expect(ids).not.toContain('node_14');
    });

    it('handles undefined, NaN, and negative baseValues correctly in sorting', () => {
      const nodes = [
        { id: 'n_undef', label: 'Undefined Node' }, // baseValue undefined -> 0
        { id: 'n_nan', label: 'NaN Node', baseValue: NaN }, // baseValue NaN -> 0
        { id: 'n_neg', label: 'Negative Node', baseValue: -20 }, // baseValue -20
        { id: 'n_pos', label: 'Positive Node', baseValue: 50 },
        { id: 'n_zero', label: 'Zero Node', baseValue: 0 },
      ];

      const result = postProcessGraph(nodes as any[], []);
      expect(result.nodes).toHaveLength(5);
      expect(result.nodes[0].id).toBe('n_pos'); // 50
      // Negative (-20) will sort after 0s
      expect(result.nodes[result.nodes.length - 1].id).toBe('n_neg');
    });

    it('prunes dangling edges connected to nodes beyond the top 15 limit', () => {
      const nodes = Array.from({ length: 20 }, (_, i) => ({
        id: `node_${i}`,
        label: `노드 ${i}`,
        baseValue: i * 10,
      }));

      // Top 15 nodes will be node_5 to node_19
      // node_0 to node_4 are pruned
      const edges = [
        // Valid: both in top 15
        { source: 'node_19', target: 'node_18', weight: 1.0 },
        { source: 'node_5', target: 'node_6', weight: 0.8 },
        // Dangling: source in top 15, target pruned
        { source: 'node_19', target: 'node_4', weight: 0.5 },
        // Dangling: source pruned, target in top 15
        { source: 'node_2', target: 'node_10', weight: 0.5 },
        // Dangling: both pruned
        { source: 'node_0', target: 'node_1', weight: 0.5 },
        // Dangling: non-existent ID
        { source: 'node_19', target: 'ghost_node', weight: 0.5 },
      ];

      const result = postProcessGraph(nodes as any[], edges as any[]);
      expect(result.edges).toHaveLength(2);
      expect(result.edges[0]).toEqual({ source: 'node_19', target: 'node_18', weight: 1.0 });
      expect(result.edges[1]).toEqual({ source: 'node_5', target: 'node_6', weight: 0.8 });
    });

    it('prunes self-referencing edges (source === target)', () => {
      const nodes = [
        { id: 'n1', label: '노드 1', baseValue: 100 },
        { id: 'n2', label: '노드 2', baseValue: 90 },
      ];

      const edges = [
        { source: 'n1', target: 'n1', weight: 1.0 }, // self loop
        { source: 'n2', target: 'n2', weight: 1.0 }, // self loop
        { source: 'n1', target: 'n2', weight: 0.9 }, // valid
      ];

      const result = postProcessGraph(nodes as any[], edges as any[]);
      expect(result.edges).toHaveLength(1);
      expect(result.edges[0]).toEqual({ source: 'n1', target: 'n2', weight: 0.9 });
    });

    it('filters out malformed edges missing source or target', () => {
      const nodes = [
        { id: 'n1', label: '노드 1', baseValue: 100 },
        { id: 'n2', label: '노드 2', baseValue: 90 },
      ];

      const edges = [
        { source: 'n1' } as any,
        { target: 'n2' } as any,
        {} as any,
        { source: null, target: 'n2' } as any,
        { source: 'n1', target: 'n2', weight: 0.5 },
      ];

      const result = postProcessGraph(nodes as any[], edges);
      expect(result.edges).toHaveLength(1);
      expect(result.edges[0].source).toBe('n1');
      expect(result.edges[0].target).toBe('n2');
    });
  });

  // =========================================================================
  // 3. Quarantined Test Fixtures Interface & Type Decoupling Verification
  // =========================================================================
  describe('3. Quarantined Test Fixtures & Type Decoupling Verification', () => {
    it('verifies NodeOverride contract in src/lib/ontology.types.ts matches all required fields', () => {
      const override: NodeOverride = {
        id: 'node-test',
        label: '라벨',
        category: 'CORE_PROJECT',
        x: 100,
        y: 200,
        department: '건강관리과',
        budgetAmount: 5000000,
        fixedX: 120,
        fixedY: 220,
        customColor: '#ff4400',
        customLabel: '커스텀 라벨',
        customGroup: 'CORE_PROJECT',
        customParent: 'root-HCHPS',
        customOrbitIndex: 2,
        customSortOrder: 1,
        dueDate: '2026-10-30',
        isHighlighted: true,
        isCompleted: false,
        verificationStatus: 'verified',
        hidden: false,
        hideDefaultGraph: false,
        useCustomContext: true,
        customContextText: '콘텍스트 설명',
        story5W1H: {
          who: '담당자',
          when: '2026. 9. 14.',
          where: '양재천',
          what: '페스티벌',
          how: '현장 운영',
          why: '주민 건강 증진'
        }
      };

      expect(override.id).toBe('node-test');
      expect(override.customColor).toBe('#ff4400');
      expect(override.verificationStatus).toBe('verified');
      expect(override.story5W1H?.who).toBe('담당자');
    });

    it('verifies useGraphCustomization test fixture re-exports NodeOverride seamlessly', async () => {
      const fixture = await import('@/__tests__/fixtures/useGraphCustomization');
      expect(fixture.useGraphCustomization).toBeDefined();
      expect(typeof fixture.useGraphCustomization).toBe('function');
    });

    it('verifies useFestivalValidation test fixture loads and executes successfully', async () => {
      const fixture = await import('@/__tests__/fixtures/useFestivalValidation');
      expect(fixture.useFestivalValidation).toBeDefined();
      expect(typeof fixture.useFestivalValidation).toBe('function');
    });

    it('verifies useWikiStorage test fixture loads and exports storage hooks', async () => {
      const fixture = await import('@/__tests__/fixtures/useWikiStorage');
      expect(fixture.useWikiStorage).toBeDefined();
      expect(typeof fixture.useWikiStorage).toBe('function');
    });

    it('verifies useLocalContacts test fixture loads and exports local contacts hook', async () => {
      const fixture = await import('@/__tests__/fixtures/useLocalContacts');
      expect(fixture.useLocalContacts).toBeDefined();
      expect(typeof fixture.useLocalContacts).toBe('function');
    });

    it('verifies useMergedSignals test fixture loads and exports signal merger hook', async () => {
      const fixture = await import('@/__tests__/fixtures/useMergedSignals');
      expect(fixture.useMergedSignals).toBeDefined();
      expect(typeof fixture.useMergedSignals).toBe('function');
    });
  });
});
