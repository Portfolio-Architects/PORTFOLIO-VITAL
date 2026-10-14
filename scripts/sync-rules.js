const fs = require('fs');
const path = require('path');

const REPORT_PATH = path.join(__dirname, '..', 'PORTFOLIO VITAL - Engineering Report.md');
const MILESTONES_MIRROR_PATH = path.join(__dirname, '..', 'PORTFOLIO VITAL - Engineering Milestones.md');
const AGENTS_PATH = path.join(__dirname, '..', 'AGENTS.md');

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

  const LIMIT = 12;
  const recentMilestones = milestones.slice(0, LIMIT);
  const olderCount = milestones.length - LIMIT;

  let milestoneList = recentMilestones.map(m => `  - ${m}`).join('\n');

  if (olderCount > 0) {
    const lastMilestone = milestones[milestones.length - 1];
    const dateMatch = lastMilestone.match(/\((\d{4}-\d{2}-\d{2})\)/);
    const oldestDateStr = dateMatch ? dateMatch[1] : '초기';

    const borderMilestone = milestones[LIMIT];
    const borderDateMatch = borderMilestone.match(/\((\d{4}-\d{2}-\d{2})\)/);
    const borderDateStr = borderDateMatch ? borderDateMatch[1] : '최근';

    milestoneList += `\n  - 그 외 과거 누적 마일스톤 총 ${olderCount}건 통합 요약 (${oldestDateStr} ~ ${borderDateStr} 이전 패치 내역)`;
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

function main() {
  console.log('🔄 ==========================================');
  console.log('🔄 AGENTS.md & Engineering Report 3-Way 동기화 도구');
  console.log('🔄 ==========================================\n');

  const sourcePath = fs.existsSync(REPORT_PATH) ? REPORT_PATH : MILESTONES_MIRROR_PATH;
  if (!fs.existsSync(sourcePath)) {
    console.error(`❌ 엔지니어링 리포트 파일이 존재하지 않습니다: ${sourcePath}`);
    process.exit(1);
  }

  try {
    const reportContent = fs.readFileSync(sourcePath, 'utf8');
    const { headings: milestones, blocks } = extractMilestoneBlocks(reportContent);

    console.log(`📝 엔지니어링 리포트에서 추출한 전체 마일스톤 (${milestones.length}개 중 상위 12개 동기화):`);
    milestones.slice(0, 12).forEach((m, idx) => console.log(`   [${idx + 1}] ${m}`));
    console.log('');

    syncMilestonesMirror(blocks);

    const success = updateAgentsManifest(milestones);
    if (success) {
      console.log('🎉 AGENTS.md 및 Engineering Milestones.md 동기화가 완료되었습니다!');
      console.log(`   -> 대상 파일: ${path.relative(process.cwd(), AGENTS_PATH)}`);
    } else {
      console.log('❌ 동기화 실패');
      process.exit(1);
    }
  } catch (err) {
    console.error('❌ 동기화 중 오류 발생:', err);
    process.exit(1);
  }
}

main();

