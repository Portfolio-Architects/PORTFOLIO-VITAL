/**
 * Phase 8 Harness: Evaluator Agent
 * Evaluates generated code or payloads against Zod schemas and TypeScript constraints.
 */
import { z } from 'zod';
import { ADMINISTRATIVE_REDUNDANCY_MAP } from '@/lib/administrativeFormatter';

export async function evaluatePayload<T>(payload: unknown, schema: z.ZodSchema<T>): Promise<{ success: boolean; errors?: string; data?: T }> {
  const result = schema.safeParse(payload);
  if (!result.success) {
    // Loud Failure Signal - format for self-healing feedback
    const errorLines: string[] = [];
    for (let i = 0; i < result.error.issues.length; i++) {
      const err = result.error.issues[i];
      errorLines.push(`Field [${err.path.join('.')}] - ${err.message}`);
    }
    const formattedErrors = errorLines.join('\n');
    const resolutionSuggestion = `The payload structure is invalid. Errors:\n${formattedErrors}\nPlease ensure your JSON keys match the exact path and types expected by the schema.`;
    
    return {
      success: false,
      errors: resolutionSuggestion
    };
  }
  return { success: true, data: result.data };
}

/**
 * Phase 8/Rule M Harness: Administrative Official Document Evaluator
 * Validates text outputs against administrative communication standards (Rule M).
 */
export function evaluateAdministrativeText(text: string): { success: boolean; errors?: string } {
  if (!text) return { success: true };

  const violations: string[] = [];

  // Check for forbidden redundant terms
  for (const redundant of Object.keys(ADMINISTRATIVE_REDUNDANCY_MAP)) {
    if (text.includes(redundant)) {
      violations.push(`금지된 중첩어 발견: '${redundant}' -> '${ADMINISTRATIVE_REDUNDANCY_MAP[redundant]}' 표준 어휘로 대체 필요`);
    }
  }

  // Check for spoken style verb endings
  const spokenPatterns = [
    /하였습니다(?=[.\s,!?]|$)/,
    /했습니다(?=[.\s,!?]|$)/,
    /하겠습니다(?=[.\s,!?]|$)/,
    /인 것 같습니다(?=[.\s,!?]|$)/
  ];

  for (const pattern of spokenPatterns) {
    if (pattern.test(text)) {
      violations.push(`비표준 구어체 종결어미 발견: Rule M에 따라 개조식 명사형 종결어미(-함, -임, -됨, -추진 예정임)로 교정 필요`);
      break;
    }
  }

  if (violations.length > 0) {
    return {
      success: false,
      errors: `[Rule M 공문서 표준 위반 검출]:\n${violations.map(v => `- ${v}`).join('\n')}`
    };
  }

  return { success: true };
}

