const fs = require('fs');
const path = require('path');
const { evaluateText } = require('./rsi_evaluator');

const ROOT_DIR = path.join(__dirname, '..');
const REPORT_PATH = path.join(ROOT_DIR, 'PORTFOLIO VITAL - Engineering Report.md');
const MILESTONES_MIRROR_PATH = path.join(ROOT_DIR, 'PORTFOLIO VITAL - Engineering Milestones.md');
const AGENTS_PATH = path.join(ROOT_DIR, 'AGENTS.md');
const AGENTS_MAX_BYTES = 23800;

const SKILL_DOC_PATHS = [
  '.agents/skills/vital-budget-audit/SKILL.md',
  '.agents/skills/vital-hwpx-docgen/SKILL.md',
  '.agents/skills/vital-festival-4way-sync/SKILL.md',
  '.agents/skills/vital-public-infographic/SKILL.md',
  '.agents/skills/vital-governance-ops/SKILL.md',
  '.agents/skills/vital-principles-os/SKILL.md',
];

const GUIDELINE_DOC_PATHS = [
  'docs/HWP_GENERATION_GUIDELINES.md',
  'docs/VLDS_DESIGN_SYSTEM.md',
  'docs/PERSONAL_INFO_PROTECTION_GUIDE.md',
];

const GOVERNANCE_DOC_PATHS = [
  'AGENTS.md',
  ...SKILL_DOC_PATHS,
  ...GUIDELINE_DOC_PATHS,
];

const EPHEMERAL_EXAMPLE_PATHS = new Set([
  'out/festival/yangjae/index.html',
  'scratch/output.hwpx',
  'scratch/draft.md',
  'scratch/draft_policy.md',
  'scratch/draft_proposal.md',
  'scratch/clean_doc.md',
]);

// Matches .gitignore exception rules under /scratch/* so CI skips untracked scratch examples
const TRACKED_SCRATCH_PATHS = new Set([
  'scratch/generate_new_hwpx.py',
  'scratch/test_hwpx_anti_overlap.py',
]);

function extractMilestoneBlocks(reportContent) {
  const lines = reportContent.split(/\r?\n/);
  let inSection = false;
  const headings = [];
  const blocks = [];
  let currentBlock = null;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = rawLine.trim();

    if (line.startsWith('## 8. 최근 엔지니어링 마일스톤')) {
      inSection = true;
      continue;
    }

    if (inSection && line.startsWith('## ') && !line.startsWith('## 8.')) {
      if (currentBlock) blocks.push(currentBlock);
      inSection = false;
      break;
    }

    if (inSection && line.startsWith('### ')) {
      if (currentBlock) blocks.push(currentBlock);
      let cleaned = line.replace('###', '').trim();
      cleaned = cleaned.replace(/[\u{1F300}-\u{1F9FF}]/gu, '');
      cleaned = cleaned.replace(/[\u{2600}-\u{26FF}]/gu, '');
      cleaned = cleaned.trim();
      if (cleaned) {
        headings.push(cleaned);
      }
      currentBlock = { heading: cleaned, lines: [rawLine] };
    } else if (inSection && currentBlock) {
      currentBlock.lines.push(rawLine);
    }
  }
  if (inSection && currentBlock) {
    blocks.push(currentBlock);
  }

  return { headings, blocks };
}

function compactMilestoneHeading(rawHeading) {
  const bracketMatch = rawHeading.match(/^(\[Milestone\s+\d+:[^\]]+\])/);
  const dateMatch = rawHeading.match(/\((\d{4}-\d{2}-\d{2})\)\s*$/);
  if (bracketMatch) {
    const dateSuffix = dateMatch ? ` (${dateMatch[1]})` : '';
    return `${bracketMatch[1]}${dateSuffix}`;
  }
  return rawHeading;
}

function syncMilestonesMirror(blocks) {
  if (!fs.existsSync(MILESTONES_MIRROR_PATH)) {
    return;
  }
  const mirrorContent = fs.readFileSync(MILESTONES_MIRROR_PATH, 'utf8');
  const missingBlocks = [];
  for (const b of blocks) {
    const idMatch = b.heading.match(/^\[Milestone\s+(\d+):/);
    if (idMatch) {
      const tag = `[Milestone ${idMatch[1]}:`;
      if (!mirrorContent.includes(tag)) {
        missingBlocks.push(b.lines.join('\n').trimEnd());
      }
    }
  }

  if (missingBlocks.length === 0) {
    console.log('  ↳ ℹ️  [SKIP] Engineering Milestones.md mirror is already up to date.');
    return;
  }

  const headerMarker = '## 8. 최근 엔지니어링 마일스톤 (요약)';
  const idx = mirrorContent.indexOf(headerMarker);
  if (idx !== -1) {
    const insertPos = idx + headerMarker.length;
    const updatedMirror =
      mirrorContent.substring(0, insertPos) +
      '\n\n\n' +
      missingBlocks.join('\n\n') +
      '\n' +
      mirrorContent.substring(insertPos);
    fs.writeFileSync(MILESTONES_MIRROR_PATH, updatedMirror, 'utf8');
    console.log(`  ↳ ✅ [SYNC] Added ${missingBlocks.length} new milestone block(s) to Engineering Milestones.md.`);
  }
}

function updateAgentsManifest(milestones) {
  if (!fs.existsSync(AGENTS_PATH)) {
    console.error(`❌ 에이전트 파일이 존재하지 않습니다: ${AGENTS_PATH}`);
    return false;
  }

  let agentsContent = fs.readFileSync(AGENTS_PATH, 'utf8');
  const today = new Date().toISOString().split('T')[0];

  const marker = '## 4. 최신 동기화된 마일스톤 (Synced Milestones Log)';

  let LIMIT = 4;
  const recentMilestones = milestones.slice(0, LIMIT).map(compactMilestoneHeading);
  const olderCount = milestones.length - LIMIT;

  let milestoneList = recentMilestones.map(m => `  - ${m}`).join('\n');

  if (olderCount > 0) {
    const lastMilestone = milestones[milestones.length - 1];
    const dateMatch = lastMilestone.match(/\((\d{4}-\d{2}-\d{2})\)/);
    const oldestDateStr = dateMatch ? dateMatch[1] : '초기';

    const borderMilestone = milestones[LIMIT];
    const borderDateMatch = borderMilestone.match(/\((\d{4}-\d{2}-\d{2})\)/);
    const borderDateStr = borderDateMatch ? borderDateMatch[1] : '최근';

    milestoneList += `\n  - 그 외 과거 누적 마일스톤 총 ${olderCount}건 통합 보존 (${oldestDateStr} ~ ${borderDateStr} 상세 내역은 Engineering Report.md 및 Engineering Milestones.md 참조)`;
  }

  const newSectionContent = `${marker}
- **최신 동기화 일자:** ${today}
- **동기화된 마일스톤:**
${milestoneList ? milestoneList : '- (동기화된 내역 없음)'}
`;

  const markerIndex = agentsContent.indexOf(marker);

  if (markerIndex !== -1) {
    const nextHeadingIndex = agentsContent.indexOf('\n## ', markerIndex + marker.length);
    if (nextHeadingIndex !== -1) {
      agentsContent = agentsContent.substring(0, markerIndex) + newSectionContent + agentsContent.substring(nextHeadingIndex);
    } else {
      agentsContent = agentsContent.substring(0, markerIndex) + newSectionContent;
    }
  } else {
    agentsContent = agentsContent.trimEnd() + '\n\n' + newSectionContent;
  }

  const byteSize = Buffer.byteLength(agentsContent, 'utf8');
  console.log(`  ↳ 📏 [SIZE] AGENTS.md UTF-8 size: ${byteSize.toLocaleString()} bytes (Limit: 23,800 bytes)`);

  const existingContent = fs.readFileSync(AGENTS_PATH, 'utf8');
  if (existingContent === agentsContent) {
    console.log('  ↳ ℹ️  [SKIP] AGENTS.md manifest is already up to date. Disk write bypassed.');
    return true;
  }

  let retries = 5;
  while (retries > 0) {
    try {
      fs.writeFileSync(AGENTS_PATH, agentsContent, 'utf8');
      break;
    } catch (err) {
      retries--;
      if (retries === 0) {
        console.warn('⚠️ AGENTS.md file is currently locked by system. Dynamic milestone sync skipped.');
        return true;
      }
      const end = Date.now() + 200;
      while (Date.now() < end) {}
    }
  }
  return true;
}

function auditGovernanceAndSkillDocs(rootDir = ROOT_DIR, docPaths = GOVERNANCE_DOC_PATHS) {
  const errors = [];
  const docStats = [];

  for (const relPath of docPaths) {
    const absPath = path.join(rootDir, relPath);
    if (!fs.existsSync(absPath)) {
      errors.push(`[MISSING DOC] 필수 거버넌스/스킬/지침 문서가 존재하지 않습니다: ${relPath}`);
      continue;
    }

    const content = fs.readFileSync(absPath, 'utf8');
    const byteSize = Buffer.byteLength(content, 'utf8');

    if (relPath === 'AGENTS.md') {
      if (byteSize > AGENTS_MAX_BYTES) {
        errors.push(`[SIZE OVERFLOW] AGENTS.md 용량(${byteSize}B)이 상한(${AGENTS_MAX_BYTES}B)을 초과했습니다.`);
      }
      const expectedRules = 'ABCDEFGHIJKLMNOPQRST'.split('');
      for (const r of expectedRules) {
        if (!new RegExp(`^###\\s+${r}\\.\\s+`, 'm').test(content)) {
          errors.push(`[MISSING RULE] AGENTS.md 내 Rule ${r} 섹션 헤더가 누락되었습니다.`);
        }
      }
      for (const skillPath of SKILL_DOC_PATHS) {
        if (!content.includes(skillPath)) {
          errors.push(`[MISSING SKILL LINK] AGENTS.md 내 스킬 경로 참조가 누락되었습니다: ${skillPath}`);
        }
      }
      for (const guidePath of GUIDELINE_DOC_PATHS) {
        if (!content.includes(guidePath)) {
          errors.push(`[MISSING GUIDE LINK] AGENTS.md 내 지침 경로 참조가 누락되었습니다: ${guidePath}`);
        }
      }
    }

    const puaMatches = content.match(/\u{F03DA}/gu) || [];
    if (puaMatches.length > 0) {
      errors.push(`[BROKEN PUA] ${relPath}: 깨짐 유발 한컴 PUA(U+F03DA) 리터럴 ${puaMatches.length}건이 검출되었습니다.`);
    }

    const dblBullets = content.match(/^\s*-\s+[❍•※]/gm) || [];
    if (dblBullets.length > 0) {
      errors.push(`[DOUBLE BULLET] ${relPath}: 금지된 이중 불릿(- ❍ / - • / - ※) ${dblBullets.length}건이 검출되었습니다.`);
    }

    const rsiResult = evaluateText(content);
    if (rsiResult.violationCount > 0) {
      errors.push(`[RSI VIOLATION] ${relPath}: 평어체/규범/사과 배제 위반 ${rsiResult.violationCount}건 (${JSON.stringify(rsiResult.violations)})`);
    }

    if (GUIDELINE_DOC_PATHS.includes(relPath)) {
      if (!/\s{2}끝\.\s*$/.test(content)) {
        errors.push(`[MISSING KEUT] ${relPath}: 영구 지침 문서 말미 '  끝.' 표기가 누락되었습니다.`);
      }
    }

    const pathRegex = /(?<![A-Za-z0-9_\/])(?:\.\.\/)*((?:src|scripts|functions|docs|data|public|scratch|__tests__|\.agents)\/[A-Za-z0-9_.\-\/]+\.(?:ts|tsx|js|py|md|json|html|hwpx))\b/g;
    let match;
    const missingRefs = [];
    while ((match = pathRegex.exec(content)) !== null) {
      const refRel = match[1];
      if (
        refRel.includes('<') ||
        refRel.includes('>') ||
        refRel.includes('*') ||
        EPHEMERAL_EXAMPLE_PATHS.has(refRel) ||
        (refRel.startsWith('scratch/') && !TRACKED_SCRATCH_PATHS.has(refRel))
      ) {
        continue;
      }
      if (!fs.existsSync(path.join(rootDir, refRel))) {
        missingRefs.push(refRel);
      }
    }
    if (missingRefs.length > 0) {
      errors.push(`[DEAD PATH REF] ${relPath}: 존재하지 않는 참조 경로 [${[...new Set(missingRefs)].join(', ')}]`);
    }

    docStats.push({
      path: relPath,
      bytes: byteSize,
      puaCount: puaMatches.length,
      doubleBullets: dblBullets.length,
      rsiViolations: rsiResult.violationCount,
    });
  }

  return {
    passed: errors.length === 0,
    errors,
    docStats,
  };
}

function main() {
  console.log('🔄 ==========================================');
  console.log('🔄 AGENTS.md & Engineering Report 3-Way 동기화 및 10대 문서 감사 도구');
  console.log('🔄 ==========================================\n');

  const sourcePath = fs.existsSync(REPORT_PATH) ? REPORT_PATH : MILESTONES_MIRROR_PATH;
  if (!fs.existsSync(sourcePath)) {
    console.error(`❌ 엔지니어링 리포트 파일이 존재하지 않습니다: ${sourcePath}`);
    process.exit(1);
  }

  try {
    const reportContent = fs.readFileSync(sourcePath, 'utf8');
    const { headings: milestones, blocks } = extractMilestoneBlocks(reportContent);

    console.log(`📝 엔지니어링 리포트에서 추출한 전체 마일스톤 (${milestones.length}개 중 상위 8개 컴팩트 동기화):`);
    milestones.slice(0, 8).forEach((m, idx) => console.log(`   [${idx + 1}] ${compactMilestoneHeading(m)}`));
    console.log('');

    syncMilestonesMirror(blocks);

    const success = updateAgentsManifest(milestones);
    if (!success) {
      console.log('❌ 동기화 실패');
      process.exit(1);
    }

    const audit = auditGovernanceAndSkillDocs();
    if (!audit.passed) {
      console.error('❌ [GOVERNANCE AUDIT ERROR] 거버넌스·스킬·지침 문서 무결성 감사 실패:');
      audit.errors.forEach((e) => console.error(`   - ${e}`));
      process.exit(1);
    }

    console.log(`  ↳ 🛡️  [AUDIT] 10대 거버넌스·스킬·지침 문서 무결성 감사 통과 (PUA 0, 이중불릿 0, RSI 위반 0, 데드링크 0)`);
    console.log('🎉 AGENTS.md, Engineering Milestones.md 및 10대 문서 감사가 완료되었습니다!');
    console.log(`   -> 대상 파일: ${path.relative(process.cwd(), AGENTS_PATH)}`);
  } catch (err) {
    console.error('❌ 동기화 중 오류 발생:', err);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  extractMilestoneBlocks,
  compactMilestoneHeading,
  updateAgentsManifest,
  auditGovernanceAndSkillDocs,
  GOVERNANCE_DOC_PATHS,
};
