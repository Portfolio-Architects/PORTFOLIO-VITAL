/**
 * Ontology Graph Type Definitions
 * Layer 1: 업무 논리 도메인(Task/Work Logic Domain)의 과제 엔티티 간
 * 가중 의존성 네트워크 시각화를 위한 타입 정의
 */

// ============ Domain Groups ============

export type OntologyGroup =
  | 'CORE_PROJECT'
  | 'MACRO_RESEARCH'
  | 'DCF_MODELING'
  | 'DATA_PIPELINE'
  | 'INFRASTRUCTURE'
  | 'SYSTEM_RISK'
  | 'OTHER';

export const GROUP_COLORS: Record<OntologyGroup, string> = {
  CORE_PROJECT:   '#0055FF',  // 비비드 블루
  MACRO_RESEARCH: '#00CC44',  // 핫 그린
  DCF_MODELING:   '#8800FF',  // 일렉트릭 바이올렛
  DATA_PIPELINE:  '#FF6600',  // 브라이트 오렌지
  INFRASTRUCTURE: '#00BBDD',  // 딥 시안
  SYSTEM_RISK:    '#FF0044',  // 크림슨 레드
  OTHER:          '#888888',
};

export const GROUP_LABELS: Record<OntologyGroup, string> = {
  CORE_PROJECT:   '핵심 키워드',
  MACRO_RESEARCH: '주요 키워드',
  DCF_MODELING:   '반복 키워드',
  DATA_PIPELINE:  '일반 키워드',
  INFRASTRUCTURE: '기초 키워드',
  SYSTEM_RISK:    '주의 키워드',
  OTHER:          '기타',
};

// ============ Edge Types ============

export type EdgeType =
  | 'CAUSAL_DRIVE'
  | 'DEPENDENCY'
  | 'FEEDBACK_LOOP'
  | 'BOTTLENECK'
  | 'DECOUPLING'
  | 'ASSIGNEE'
  | 'BUDGET_SOURCE'
  | 'COMPONENTS';

export const EDGE_TYPE_DASH: Record<EdgeType, number[]> = {
  CAUSAL_DRIVE:  [],               // ──────── solid
  DEPENDENCY:    [8, 4],           // ── ── ── long dash
  FEEDBACK_LOOP: [3, 3],           // - - - -  short dash
  BOTTLENECK:    [2, 2],           // ········ dotted
  DECOUPLING:    [10, 3, 3, 3],    // ── · ── · dash-dot
  ASSIGNEE:      [5, 5],           // 담당자 지정 점선
  BUDGET_SOURCE: [1, 5],           // 예산 출처 촘촘한 도트
  COMPONENTS:    [],               // 구성 요소 solid
};

export const EDGE_TYPE_LABELS: Record<EdgeType, string> = {
  CAUSAL_DRIVE:  '인과 구동',
  DEPENDENCY:    '의존성',
  FEEDBACK_LOOP: '피드백 루프',
  BOTTLENECK:    '병목',
  DECOUPLING:    '디커플링',
  ASSIGNEE:      '담당자 지정',
  BUDGET_SOURCE: '예산 배정',
  COMPONENTS:    '구성 요소',
};

// ============ Node ============

export type OntologyLayerId = 0 | 1 | 2 | 3;

export const LAYER_LABELS: Record<OntologyLayerId, string> = {
  0: '인물 (Agent)',
  1: '예산/비품 (Resource)',
  2: '업무/회의 (Execution)',
  3: '위키/문서 (Knowledge)',
};

export type VerificationStatus = 'uncompleted' | 'in-progress' | 'verified' | 'risk-warning';

export interface OntologyNode {
  id: string;
  label: string;
  group: OntologyGroup;
  baseValue: number;           // 0-100, user-input importance
  parentId?: string;           // Optional parent ID for radial branch alignment
  layerId?: OntologyLayerId;   // 0: 인물, 1: 예산/비품, 2: 업무/회의, 3: 위키/문서
  meta?: Record<string, any>;  // Custom payload for specific nodes
  verificationStatus?: VerificationStatus; // Investigator verification status
  // === User Overrides ===
  fixedX?: number;             // User pinned X coordinate
  fixedY?: number;             // User pinned Y coordinate
  customColor?: string;        // User overridden color
  customLabel?: string;        // User overridden text
  customGroup?: OntologyGroup; // User overridden group
  customOrbitIndex?: number;   // User overridden orbit index
  customSortOrder?: number;    // User overridden sibling sort order
  dueDate?: string;            // User overridden deadline (YYYY-MM-DD)
  isHighlighted?: boolean;     // User custom fixed highlight/glow
  isCompleted?: boolean;       // User custom completed state (Archive)
  // === Runtime computed ===
  centralityScore?: number;    // Eigenvector-weighted centrality (0-1)
  renderSize?: number;         // blended size (0-1)
  netWeight?: number;          // sum of signed edge weights
  isHedge?: boolean;           // true if netWeight < 0
  riskFactor?: number;         // accumulated risk impact (0-1)
  effectiveLayer?: number;     // cached layer id for rendering and physics
  _cachedTextWidth?: Record<string, number>; // canvas layout rendering optimization cache
}

// ============ Node Override ============

export interface NodeOverride {
  id?: string;
  label?: string;
  category?: string;
  x?: number;
  y?: number;
  department?: string;
  budgetAmount?: number;
  fixedX?: number | null;
  fixedY?: number | null;
  customColor?: string | null;
  customLabel?: string | null;
  customGroup?: string | null;
  customParent?: string | null;
  customOrbitIndex?: number | null;
  customSortOrder?: number | null;
  dueDate?: string | null;
  isHighlighted?: boolean | null;
  isCompleted?: boolean | null;
  verificationStatus?: VerificationStatus | null;
  hidden?: boolean | null;
  hideDefaultGraph?: boolean | null;
  useCustomContext?: boolean | null;
  customContextText?: string | null;
  story5W1H?: {
    who?: string;
    when?: string;
    where?: string;
    what?: string;
    how?: string;
    why?: string;
    contact?: string;
    department?: string;
    title?: string;
  } | null;
}

// ============ Orbital Node (Runtime) ============

export interface OrbitalNode extends OntologyNode {
  orbitIndex: number;          // 0 = center, 1-N = orbits
  orbitAngle: number;          // current angle in radians
  orbitSpeed: number;          // rad/frame
  themeColor?: string;         // Computed Branch Theme Color for inheritance
  worldX?: number;             // Optional: Local World X tracking for radial physics layout
  worldY?: number;             // Optional: Local World Y tracking for radial physics layout
  targetWorldX?: number;       // Optional: Target X coordinate for LERP morphing animation
  targetWorldY?: number;       // Optional: Target Y coordinate for LERP morphing animation
  vx?: number;                 // Optional: Physics velocity X for force-directed solver
  vy?: number;                 // Optional: Physics velocity Y for force-directed solver
  cosSpeed?: number;           // Optional: Cached cos of orbit speed for Zero-Call physics
  sinSpeed?: number;           // Optional: Cached sin of orbit speed for Zero-Call physics
  orbitCos?: number;           // Optional: Cached cos of orbit angle for unit vector orbiting
  orbitSin?: number;           // Optional: Cached sin of orbit angle for unit vector orbiting
  renderX: number;             // canvas X
  renderY: number;             // canvas Y
  renderZ: number;             // depth (-1 to 1)
  connectionToCenter: number;  // connection weight to center node
  nodeRadius: number;          // pixel radius
  layoutHidden?: boolean;      // true if hidden by parent collapse or layer filter
  topoHidden?: boolean;        // true if hidden topologically by parent collapse
  degree?: number;             // 💡 연결된 엣지의 총 개수 (센트럴리티 비례 동적 중력 제어용)
  index?: number;              // 정수 기반 키 해싱 및 가비지 프리 물리 계산용 인덱스
  minAngle?: number;           // radial boundary constraint
  maxAngle?: number;           // radial boundary constraint
  radialOffset?: number;       // radial spacing distance adjustment
  perspectiveScale?: number;   // 3D Isometric depth perspective scaling factor
  _cachedWords?: string[];
  _cachedLines?: string[];
  _cachedInteractiveText?: string;
  _cachedLinesMaxWidth500?: number;
  _cachedLinesMaxWidth600?: number;
  _cachedTemplate?: HTMLCanvasElement;
  _cachedTemplateColor?: string;
  _cachedTemplateCluster?: boolean;
  _collisionW?: number;
  _collisionH?: number;
  _isCollisionFixed?: boolean;
  _renormFrame?: number;
  _themeColorId?: number;
  _themeColor?: string;
  _computedDotRadius?: number;
  _isLODDot?: boolean;
  _localZoom?: number;
}

// ============ Edge ============

export interface OntologyEdge {
  source: string;
  target: string;
  weight: number;              // -1.0 ~ 1.0
  type: EdgeType;
}

// ============ Graph ============

export interface OntologyGraph {
  nodes: OntologyNode[];
  edges: OntologyEdge[];
}
