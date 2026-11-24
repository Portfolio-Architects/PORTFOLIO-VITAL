#!/usr/bin/env node
/**
 * VLDS UI Copy Design Harness (AST Static Gatekeeper)
 *
 * Scans src/components/**\/*.tsx via TypeScript Compiler API and enforces:
 * 1. Plain-Word Naming (bans inflated AI/buzzword terms like '쇼케이스', '인텔리전스', '워크스페이스')
 * 2. Concise Titles (<SectionHeader title>, <h1>~<h4>: <=18 chars, <=3 words, no redundant English gloss)
 * 3. Zero-Verbosity UI Copy (bans explanatory/imperative prose endings like '~합니다', '~하세요', '~없습니다')
 *
 * Inline escape hatch (for literal legal/document quotations only):
 *   {/* vlds-ignore-next-line *\/}  or  // vlds-ignore-next-line
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ts = require('typescript');

const ROOT_DIR = path.resolve(__dirname, '..');
const DEFAULT_TARGET_DIR = path.join(ROOT_DIR, 'src', 'components');
const IGNORE_MARKER = 'vlds-ignore-next-line';

function loadVldsMicrocopySync() {
  const microcopyPath = path.resolve(__dirname, '../src/lib/vlds-microcopy.ts');
  const source = fs.readFileSync(microcopyPath, 'utf-8');
  const transpiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  });
  const mod = { exports: {} };
  const ctx = vm.createContext({
    module: mod,
    exports: mod.exports,
    require,
    console,
    process,
  });
  vm.runInContext(transpiled.outputText, ctx);
  return mod.exports;
}

const vlds = loadVldsMicrocopySync();

function collectTsxFiles(dir) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectTsxFiles(fullPath));
    } else if (entry.name.endsWith('.tsx')) {
      results.push(fullPath);
    }
  }
  return results;
}

function normalizeUiText(raw) {
  return String(raw || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function hasIgnoreCommentOnLineOrPrev(lines, lineNum1Based) {
  const curr = lines[lineNum1Based - 1] || '';
  const prev = lines[lineNum1Based - 2] || '';
  return curr.includes(IGNORE_MARKER) || prev.includes(IGNORE_MARKER);
}

function getStringLiteralValue(attrInitializer) {
  if (!attrInitializer) return null;
  if (ts.isStringLiteral(attrInitializer) || ts.isNoSubstitutionTemplateLiteral(attrInitializer)) {
    return attrInitializer.text;
  }
  if (ts.isJsxExpression(attrInitializer) && attrInitializer.expression) {
    const expr = attrInitializer.expression;
    if (ts.isStringLiteral(expr) || ts.isNoSubstitutionTemplateLiteral(expr)) {
      return expr.text;
    }
  }
  return null;
}

/**
 * Checks general UI text (JsxText, JsxExpression rendered strings, placeholder, aria-label, tooltip title)
 * for banned prose endings, inline prose sentences, legacy jargon, inflated buzzwords, and redundant English glosses.
 */
function checkGeneralUiCopy(text, options = {}) {
  const violations = [];
  if (vlds.FORBIDDEN_PROSE_ENDINGS_RE.test(text) || vlds.FORBIDDEN_INLINE_PROSE_RE.test(text)) {
    violations.push('서술형 문장 종결어미 사용 금지 (명사구·수치 종결 필수)');
  }
  for (const jargon of vlds.FORBIDDEN_LEGACY_JARGON) {
    if (text.includes(jargon)) {
      violations.push(`금지 레거시·수식어 포함: "${jargon}"`);
    }
  }
  for (const term of vlds.FORBIDDEN_INFLATED_UI_TERMS) {
    if (text.includes(term)) {
      const replacement = vlds.INFLATED_UI_REPLACEMENTS[term];
      violations.push(`과장·추상 UI 용어 금지: "${term}" → 권장: ${replacement}`);
    }
  }
  if (options.checkEnglishGloss && /[가-힣]/.test(text) && vlds.REDUNDANT_ENGLISH_GLOSS_RE.test(text)) {
    violations.push('중복 영문 병기 금지 (한글 명사구 단독 표기)');
  }
  return violations;
}

/**
 * Extracts rendered string literals from JSX child expressions (e.g. ternary/logical branches),
 * deliberately skipping condition operands, call arguments, and attribute expressions.
 */
function collectRenderedExprLiterals(expr, out = []) {
  if (!expr) return out;
  if (ts.isStringLiteral(expr) || ts.isNoSubstitutionTemplateLiteral(expr)) {
    out.push({ node: expr, text: expr.text });
    return out;
  }
  if (ts.isParenthesizedExpression(expr)) {
    return collectRenderedExprLiterals(expr.expression, out);
  }
  if (ts.isConditionalExpression(expr)) {
    collectRenderedExprLiterals(expr.whenTrue, out);
    collectRenderedExprLiterals(expr.whenFalse, out);
    return out;
  }
  if (ts.isBinaryExpression(expr)) {
    const op = expr.operatorToken.kind;
    if (
      op === ts.SyntaxKind.AmpersandAmpersandToken ||
      op === ts.SyntaxKind.BarBarToken ||
      op === ts.SyntaxKind.QuestionQuestionToken
    ) {
      collectRenderedExprLiterals(expr.right, out);
    }
    return out;
  }
  return out;
}

/**
 * Extracts direct static text from a heading element (including single-level <span> wrappers)
 * only when the heading does not contain dynamic JSX expressions.
 */
function extractStaticHeadingText(headingNode) {
  let hasDynamic = false;
  const parts = [];
  function walkChildren(children) {
    for (const ch of children) {
      if (ts.isJsxText(ch)) {
        const t = normalizeUiText(ch.text);
        if (t) parts.push(t);
      } else if (ts.isJsxElement(ch)) {
        const childTag = ch.openingElement.tagName.getText();
        if (childTag === 'span') {
          walkChildren(ch.children);
        }
      } else if (ts.isJsxExpression(ch) && ch.expression) {
        hasDynamic = true;
      }
    }
  }
  walkChildren(headingNode.children);
  if (hasDynamic) return null;
  return normalizeUiText(parts.join(' '));
}

function auditUiCopySource(filePath, sourceText) {
  const sf = ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const lines = sourceText.split(/\r?\n/);
  const violations = [];
  let ignoredCount = 0;

  function recordIfViolated(pos, kind, rawText, reasons) {
    if (!reasons || reasons.length === 0) return;
    const line = sf.getLineAndCharacterOfPosition(pos).line + 1;
    if (hasIgnoreCommentOnLineOrPrev(lines, line)) {
      ignoredCount++;
      return;
    }
    violations.push({
      file: path.relative(ROOT_DIR, filePath).replace(/\\/g, '/'),
      line,
      kind,
      text: normalizeUiText(rawText),
      reasons,
    });
  }

  function visit(node) {
    // 1. <SectionHeader title="..." subtitle="..." />
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tagName = node.tagName.getText(sf);
      if (tagName === 'SectionHeader') {
        for (const prop of node.attributes.properties) {
          if (!ts.isJsxAttribute(prop)) continue;
          const propName = prop.name.text;
          if (propName !== 'title' && propName !== 'subtitle') continue;
          const val = getStringLiteralValue(prop.initializer);
          if (val === null) continue;
          const normalized = normalizeUiText(val);
          if (!normalized) continue;
          const audit = vlds.auditVldsCopy(normalized, propName);
          if (!audit.valid) {
            recordIfViolated(prop.getStart(sf), `SectionHeader.${propName}`, normalized, audit.violations);
          }
        }
        return; // Avoid double-reporting SectionHeader title/subtitle attributes
      }
    }

    // 2. <h1> ~ <h4> static headings (pure text or icon + <span> static text)
    if (ts.isJsxElement(node)) {
      const tagName = node.openingElement.tagName.getText(sf);
      if (/^h[1-4]$/.test(tagName)) {
        const headingText = extractStaticHeadingText(node);
        if (headingText && headingText.length >= 2) {
          const reasons = checkGeneralUiCopy(headingText, { checkEnglishGloss: true });
          const wc = vlds.countTitleWords(headingText);
          if (wc > vlds.VLDS_TITLE_MAX_WORDS && /[가-힣]/.test(headingText)) {
            reasons.push(
              `장황한 타이틀 어절 초과 (${wc}어절 > 상한 ${vlds.VLDS_TITLE_MAX_WORDS}어절 · 직관적 1~2어절 명사 권장)`
            );
          }
          recordIfViolated(node.openingElement.getStart(sf), `<${tagName}>`, headingText, reasons);
          // Visit attributes on opening element, skip re-auditing children to avoid duplicates
          ts.forEachChild(node.openingElement, visit);
          return;
        }
      }
    }

    // 3. JSX Attributes: placeholder, aria-label, title, label
    if (ts.isJsxAttribute(node)) {
      const propName = node.name.text;
      if (['placeholder', 'aria-label', 'title', 'label'].includes(propName)) {
        const val = getStringLiteralValue(node.initializer);
        if (val !== null) {
          const normalized = normalizeUiText(val);
          if (normalized.length >= 2) {
            const reasons = checkGeneralUiCopy(normalized);
            recordIfViolated(node.getStart(sf), `attr:${propName}`, normalized, reasons);
          }
        }
      }
      return; // Don't treat JSX attribute expressions as rendered JsxExpression text
    }

    // 4. General JsxText nodes
    if (ts.isJsxText(node)) {
      const normalized = normalizeUiText(node.text);
      if (normalized.length >= 2) {
        const reasons = checkGeneralUiCopy(normalized, { checkEnglishGloss: true });
        recordIfViolated(node.getStart(sf), 'JsxText', normalized, reasons);
      }
    }

    // 5. Rendered JsxExpression string literals (e.g., {cond ? '등록된 항목이 없습니다.' : ''})
    if (ts.isJsxExpression(node) && node.expression && !ts.isJsxAttribute(node.parent)) {
      const renderedLiterals = collectRenderedExprLiterals(node.expression);
      for (const item of renderedLiterals) {
        const normalized = normalizeUiText(item.text);
        if (normalized.length >= 2 && /[가-힣]/.test(normalized)) {
          const reasons = checkGeneralUiCopy(normalized, { checkEnglishGloss: true });
          recordIfViolated(item.node.getStart(sf), 'JsxExpr', normalized, reasons);
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sf);
  return { violations, ignoredCount };
}

function auditUiCopyDirectory(targetDir = DEFAULT_TARGET_DIR) {
  const files = collectTsxFiles(targetDir);
  const allViolations = [];
  let totalIgnored = 0;

  for (const file of files) {
    const sourceText = fs.readFileSync(file, 'utf-8');
    const { violations, ignoredCount } = auditUiCopySource(file, sourceText);
    allViolations.push(...violations);
    totalIgnored += ignoredCount;
  }

  return {
    passed: allViolations.length === 0,
    filesScanned: files.length,
    violationCount: allViolations.length,
    ignoredCount: totalIgnored,
    violations: allViolations,
  };
}

function main() {
  const targetArg = process.argv[2];
  const targetDir = targetArg ? path.resolve(process.cwd(), targetArg) : DEFAULT_TARGET_DIR;

  console.log('====================================================');
  console.log('🎨 VLDS UI Copy Design Harness: Auditing JSX Copy...');
  console.log('====================================================');

  const result = auditUiCopyDirectory(targetDir);
  if (result.passed) {
    console.log(
      `  ↳ ✅ [PASS] Scanned ${result.filesScanned} TSX component files. 0 UI copy violations found (explicit ignores: ${result.ignoredCount}).`
    );
    process.exit(0);
  }

  console.error(
    `  ↳ ❌ [HARNESS UI-COPY ERROR] Found ${result.violationCount} UI copy violation(s) across ${result.filesScanned} files:`
  );
  for (const v of result.violations) {
    console.error(`     - ${v.file}:${v.line} [${v.kind}] "${v.text}"`);
    for (const r of v.reasons) {
      console.error(`       ↳ ${r}`);
    }
  }
  process.exit(1);
}

if (require.main === module) {
  main();
}

module.exports = {
  auditUiCopySource,
  auditUiCopyDirectory,
  checkGeneralUiCopy,
  DEFAULT_TARGET_DIR,
};
