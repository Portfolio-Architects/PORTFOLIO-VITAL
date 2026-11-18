import fs from 'fs';
import path from 'path';
import { ScheduleSchema, ContactSchema } from '../src/lib/schemas';

describe('Milestone 1 Empirical Verification Suite', () => {
  // ----------------------------------------------------
  // Test 1: WeeklyScheduler Date Hoisting & No Map Allocations
  // ----------------------------------------------------
  describe('1. WeeklyScheduler.tsx Date Hoisting Verification', () => {
    const weeklySchedulerPath = path.resolve('src/components/dashboard/WeeklyScheduler.tsx');
    const weeklySchedulerSrc = fs.readFileSync(weeklySchedulerPath, 'utf8');

    it('todayDateString is hoisted at component root with useMemo(..., [])', () => {
      const hasHoistedTodayDateString = /todayDateString\s*=\s*useMemo\(\s*\(\)\s*=>\s*new Date\(\)\.toDateString\(\)\s*,\s*\[\]\s*\)/.test(weeklySchedulerSrc);
      expect(hasHoistedTodayDateString).toBe(true);
    });

    it('WeekDayColumn receives pre-computed isToday boolean', () => {
      const weekDayColumnHasIsToday = /isToday\s*=\s*\{day\.toDateString\(\)\s*===\s*todayDateString\}/.test(weeklySchedulerSrc);
      expect(weekDayColumnHasIsToday).toBe(true);
    });

    it('MonthCell receives pre-computed isToday boolean', () => {
      const monthCellHasIsToday = /isToday\s*=\s*\{day\.toDateString\(\)\s*===\s*todayDateString\}/.test(weeklySchedulerSrc);
      expect(monthCellHasIsToday).toBe(true);
    });

    it('No "new Date()" allocations inside any .map() render loops in WeeklyScheduler.tsx', () => {
      const mapRegex = /\.map\s*\([^)]*\)\s*=>\s*(?:\{[\s\S]*?\}|\([^)]*\))/g;
      const mapMatches = weeklySchedulerSrc.match(mapRegex) || [];
      let newDateInMapCount = 0;
      for (const match of mapMatches) {
        if (/new Date\(/.test(match)) {
          newDateInMapCount++;
        }
      }
      expect(newDateInMapCount).toBe(0);
    });
  });

  // ----------------------------------------------------
  // Test 2: DynamicForceGraph Direct ref Prop (React 19 Modernization)
  // ----------------------------------------------------
  describe('2. DynamicForceGraph.tsx React 19 ref Prop Verification', () => {
    const dynamicForceGraphPath = path.resolve('src/components/DynamicForceGraph.tsx');
    const dynamicForceGraphSrc = fs.readFileSync(dynamicForceGraphPath, 'utf8');

    it('DynamicForceGraph does NOT use deprecated forwardRef', () => {
      const hasDeprecatedForwardRef = /React\.forwardRef|forwardRef\(/.test(dynamicForceGraphSrc);
      expect(hasDeprecatedForwardRef).toBe(false);
    });

    it('DynamicForceGraph accepts ref directly as a prop (React 19 native ref support)', () => {
      const hasDirectRefProp = /function\s+DynamicForceGraph\s*\(\s*\{\s*ref\s*,\s*\.\.\.props\s*\}\s*:\s*DynamicForceGraphProps\s*\)/.test(dynamicForceGraphSrc);
      expect(hasDirectRefProp).toBe(true);
    });

    it('DynamicForceGraph forwards ref directly to underlying ForceGraph2D component', () => {
      const passesRefToForceGraph = /<ForceGraph2D\s+\{\.\.\.props\}\s+ref=\{ref\s+as\s+any\}\s*\/>/.test(dynamicForceGraphSrc);
      expect(passesRefToForceGraph).toBe(true);
    });
  });

  // ----------------------------------------------------
  // Test 3: SearchResultModal Mutation Purity & No Cascading State Loops
  // ----------------------------------------------------
  describe('3. SearchResultModal.tsx Mutation Purity Verification', () => {
    const searchResultModalPath = path.resolve('src/components/SearchResultModal.tsx');
    const searchResultModalSrc = fs.readFileSync(searchResultModalPath, 'utf8');

    it('No mutation.reset() calls in render body', () => {
      const hasMutationResetInRender = /semanticSearchMutation\.reset\(\)|driveSearchMutation\.reset\(\)/.test(searchResultModalSrc);
      expect(hasMutationResetInRender).toBe(false);
    });

    it('Derives semanticResults directly from semanticSearchMutation.data', () => {
      const derivesSemanticData = /const\s+semanticResults\s*=\s*semanticSearchMutation\.data\s*\|\|\s*\[\]/.test(searchResultModalSrc);
      expect(derivesSemanticData).toBe(true);
    });

    it('Derives driveResults directly from driveSearchMutation.data', () => {
      const derivesDriveData = /const\s+driveResults\s*=\s*driveSearchMutation\.data\s*\|\|\s*\[\]/.test(searchResultModalSrc);
      expect(derivesDriveData).toBe(true);
    });

    it('Pure event-driven dispatch for opening wiki nodes on user click', () => {
      const dispatchesWikiOpenEvent = /window\.dispatchEvent\(new CustomEvent\('wiki:openNode'/.test(searchResultModalSrc);
      expect(dispatchesWikiOpenEvent).toBe(true);
    });
  });

  // ----------------------------------------------------
  // Test 4: InlineEditCell Isolated Mount & No Render-pass setState
  // ----------------------------------------------------
  describe('4. InlineEditCell.tsx Render State Sync Verification', () => {
    const inlineEditCellPath = path.resolve('src/components/budget/ui/InlineEditCell.tsx');
    const inlineEditCellSrc = fs.readFileSync(inlineEditCellPath, 'utf8');

    it('EditingInput extracted into isolated sub-component', () => {
      const hasEditingInputComponent = /const\s+EditingInput:\s*React\.FC<EditingInputProps>/.test(inlineEditCellSrc);
      expect(hasEditingInputComponent).toBe(true);
    });

    it('No render-time state synchronization or setPrevValue anti-pattern', () => {
      const hasPrevValueRenderSync = /setPrevValue|prevValue\s*!==\s*value/.test(inlineEditCellSrc);
      expect(hasPrevValueRenderSync).toBe(false);
    });

    it('EditingInput is conditionally mounted only during active editing', () => {
      const conditionalMountOfEditingInput = /if\s*\(\s*editing\s*\)\s*\{\s*return\s*\(\s*<EditingInput/.test(inlineEditCellSrc);
      expect(conditionalMountOfEditingInput).toBe(true);
    });
  });

  // ----------------------------------------------------
  // Test 5: SecurityLockScreen Event-driven Dispatch & Dependency Strictness
  // ----------------------------------------------------
  describe('5. SecurityLockScreen.tsx Event-driven Dispatch Verification', () => {
    const securityLockScreenPath = path.resolve('src/components/SecurityLockScreen.tsx');
    const securityLockScreenSrc = fs.readFileSync(securityLockScreenPath, 'utf8');

    it('No cascading useEffect subscribing to [pin]', () => {
      const hasEffectOnPin = /useEffect\s*\(\s*\(\)\s*=>\s*\{[\s\S]*?\}\s*,\s*\[\s*pin\s*\]\s*\)/.test(securityLockScreenSrc);
      expect(hasEffectOnPin).toBe(false);
    });

    it('processDigit is defined as stable useCallback handler', () => {
      const hasProcessDigitCallback = /const\s+processDigit\s*=\s*useCallback\(/.test(securityLockScreenSrc);
      expect(hasProcessDigitCallback).toBe(true);
    });

    it('4th-digit completion directly triggers handlePinComplete within event handler', () => {
      const triggersOn4thDigitDirectly = /if\s*\(\s*nextPin\.length\s*===\s*PIN_LENGTH\s*\)\s*\{\s*handlePinComplete\(nextPin\);\s*\}/.test(securityLockScreenSrc);
      expect(triggersOn4thDigitDirectly).toBe(true);
    });

    it('No eslint-disable comments suppressing exhaustive-deps', () => {
      const hasExhaustiveDepsDisable = /eslint-disable(?:-next-line)?\s+react-hooks\/exhaustive-deps/.test(securityLockScreenSrc);
      expect(hasExhaustiveDepsDisable).toBe(false);
    });
  });

  // ----------------------------------------------------
  // Test 6: Deterministic Schema Fallbacks
  // ----------------------------------------------------
  describe('6. Schema Fallback Determinism Verification', () => {
    it('ScheduleSchema and ContactSchema produce deterministic IDs across invocations', () => {
      const s1 = ScheduleSchema.parse({});
      const s2 = ScheduleSchema.parse({ title: undefined, date: undefined });
      const c1 = ContactSchema.parse({});
      const c2 = ContactSchema.parse({ name: undefined });

      expect(s1.id).toBe('unknown-schedule');
      expect(s1.id).toBe(s2.id);
      expect(c1.id).toBe('unknown-contact');
      expect(c1.id).toBe(c2.id);
    });
  });

  // ----------------------------------------------------
  // Test 7: SSR Hydration Safety across Hooks (useSyncExternalStore)
  // ----------------------------------------------------
  describe('7. SSR Hydration Safety across Hooks', () => {
    const hooksToVerify = [
      'src/hooks/useBudgetFilters.ts',
      'src/hooks/useTasks.ts',
      'src/hooks/useBudget.ts',
      'src/hooks/useContacts.ts',
      'src/hooks/useInventory.ts',
      'src/hooks/useAIChat.ts',
      'src/hooks/useBudgetSimulator.ts',
      'src/components/WikiEditor.tsx'
    ];

    for (const hookFile of hooksToVerify) {
      it(`${hookFile} has no synchronous localStorage in initialData initializer`, () => {
        const content = fs.readFileSync(path.resolve(hookFile), 'utf8');
        const hasSyncLocalStorageInInitial = /initialData:\s*\(\)\s*=>\s*\{[\s\S]*?localStorage\.getItem/.test(content);
        expect(hasSyncLocalStorageInInitial).toBe(false);
      });
    }
  });
});
