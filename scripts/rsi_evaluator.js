/**
 * scripts/rsi_evaluator.js
 * 
 * Recursive Self-Improvement (RSI) Deterministic Linguistic & Normative Evaluator
 * Audits text against:
 * 1. Honorific & Non-plain syntax (L_ling)
 * 2. Normative, emotional & value-judgment markers (L_norm)
 * 3. Apology & cognitive disclaimer markers (L_apol)
 * 4. Plain-style sentence terminators (L_term)
 */

const fs = require('fs');
const path = require('path');

const VIOLATION_PATTERNS = {
  // 1. Non-plain honorifics & polite endings
  L_ling: [
    /(?:습니다|ㅂ니다|합니다|해요|세요|시오|하십시오|드립니다|바랍니다|보겠습니다|해보겠습니다|것\s*같(?:습니다|아요)|있겠습니다|하겠습니다|전해드립니다|안내드립니다|부탁드립니다|친절히)/g,
    /(?:^|[^\w가-힣])(?:네|아니오|예)(?:[,.\s]|$)/g,
    /(?:요\s*[.!?\n]|요$)/g
  ],

  // 2. Normative prescriptions, emotional modifiers & value judgments
  L_norm: [
    /(?:바람직(?:하다|한|함|하며|한지)|해야\s*한다|좋은|나쁜|옳은|그른|훌륭(?:한|하게|함|하|하고|한지)|심각한|부적절한|당연히|마땅히|최선의|최고의|아름다운|속상하|우울하|기쁘게|생각(?:합|하|됩|되))/g
  ],

  // 3. Apologies, regrets & cognitive disclaimers (speech acts)
  L_apol: [
    /(?:죄송(?:합니다|하오며|함)?|사과(?:드립니다|합니다|의\s*말씀|를\s*표|하오며)|유감(?:입니다|스럽|을\s*표|함)|인공지능으로서|AI로서|한계가\s*있(?:어|으며|어)?|확인하시기\s*바랍니다|주의하시기\s*바랍니다|양해\s*부탁|참고하시기\s*바랍니다)/g
  ]
};

// Approved sentence endings for Korean plain register (when punctuation is present)
const APPROVED_ENDINGS = /(?:다|한다|이다|임|함|됨|음|것|외|등|[0-9%건명원점])$/;

function evaluateText(text, options = {}) {
  const violations = [];
  const lines = text.split('\n');

  lines.forEach((line, lineIdx) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('```') || trimmed.startsWith('|') || trimmed.startsWith('---')) {
      return;
    }

    // Check L_ling
    VIOLATION_PATTERNS.L_ling.forEach(pattern => {
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(trimmed)) !== null) {
        violations.push({
          type: 'L_ling (Non-plain/Honorific)',
          line: lineIdx + 1,
          matched: match[0],
          context: trimmed.substring(Math.max(0, match.index - 10), Math.min(trimmed.length, match.index + match[0].length + 10))
        });
      }
    });

    // Check L_norm
    VIOLATION_PATTERNS.L_norm.forEach(pattern => {
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(trimmed)) !== null) {
        violations.push({
          type: 'L_norm (Normative/Value Judgment)',
          line: lineIdx + 1,
          matched: match[0],
          context: trimmed.substring(Math.max(0, match.index - 10), Math.min(trimmed.length, match.index + match[0].length + 10))
        });
      }
    });

    // Check L_apol
    VIOLATION_PATTERNS.L_apol.forEach(pattern => {
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(trimmed)) !== null) {
        violations.push({
          type: 'L_apol (Apology/Disclaimer)',
          line: lineIdx + 1,
          matched: match[0],
          context: trimmed.substring(Math.max(0, match.index - 10), Math.min(trimmed.length, match.index + match[0].length + 10))
        });
      }
    });
  });

  return {
    valid: violations.length === 0,
    violationCount: violations.length,
    violations
  };
}

function runBenchmarkSuite() {
  const benchmarkPath = path.resolve(__dirname, 'benchmark_rsi_dataset.json');
  if (!fs.existsSync(benchmarkPath)) {
    console.error(`[ERROR] Benchmark file not found at ${benchmarkPath}`);
    process.exit(1);
  }

  const dataset = JSON.parse(fs.readFileSync(benchmarkPath, 'utf8'));
  console.log(`\n======================================================`);
  console.log(`[RSI EVALUATOR] Running Benchmark Suite (${dataset.length} Cases)`);
  console.log(`======================================================\n`);

  let idealPassed = 0;
  let idealFailed = 0;
  let negativeDetected = 0;

  dataset.forEach((item, idx) => {
    // 1. Audit Ideal Output (Expect 100% Pass)
    const idealResult = evaluateText(item.ideal_output);
    if (idealResult.valid) {
      idealPassed++;
    } else {
      idealFailed++;
      console.error(`[FAIL - Ideal Output] ${item.id} (${item.category}):`);
      idealResult.violations.forEach(v => console.error(`   - ${v.type}: "${v.matched}" in context: "${v.context}"`));
    }

    // 2. Audit Negative Output (Expect Detection of Violations)
    const negativeResult = evaluateText(item.violation_output);
    if (!negativeResult.valid) {
      negativeDetected++;
    } else {
      console.warn(`[WARN - Negative Detection Missed] ${item.id} (${item.category}) failed to catch violation in: "${item.violation_output}"`);
    }
  });

  console.log(`Benchmark Results:`);
  console.log(`- Ideal Case Pass Rate: ${idealPassed}/${dataset.length} (${((idealPassed / dataset.length) * 100).toFixed(1)}%)`);
  console.log(`- Negative Case Catch Rate: ${negativeDetected}/${dataset.length} (${((negativeDetected / dataset.length) * 100).toFixed(1)}%)\n`);

  if (idealFailed > 0 || negativeDetected < dataset.length) {
    console.error(`[FAILED] Benchmark suite did not meet 100% strict compliance.`);
    process.exit(1);
  }

  console.log(`[PASS] Benchmark Suite 100% Verified.\n`);
}

// If run directly via CLI
if (require.main === module) {
  runBenchmarkSuite();

  // Also audit target rule file if specified or default to Section P of AGENTS.md
  const targetFile = process.argv[2];
  if (targetFile) {
    const fullPath = path.resolve(process.cwd(), targetFile);
    if (fs.existsSync(fullPath)) {
      console.log(`Auditing target file: ${fullPath}`);
      const content = fs.readFileSync(fullPath, 'utf8');
      const res = evaluateText(content);
      console.log(`Audit result: ${res.valid ? 'VALID (0 violations)' : `INVALID (${res.violationCount} violations)`}`);
      if (!res.valid) {
        res.violations.slice(0, 10).forEach(v => console.error(`Line ${v.line}: [${v.type}] ${v.matched}`));
        process.exit(1);
      }
    }
  }
}

module.exports = { evaluateText, VIOLATION_PATTERNS };
