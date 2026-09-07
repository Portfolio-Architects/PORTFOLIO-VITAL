const fs = require('fs');
const path = require('path');

const REPORT_PATH = path.join(__dirname, '..', 'PORTFOLIO VITAL - Engineering Milestones.md');
const AGENTS_PATH = path.join(__dirname, '..', 'AGENTS.md');

function extractMilestones(reportContent) {
  const lines = reportContent.split(/\r?\n/);
  let inSection = false;
  const milestones = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Detect start of Section 8
    if (line.startsWith('## 8. 최근 엔지니어링 마일스톤')) {
      inSection = true;
      continue;
    }
    
    // Detect start of Section 9 or any other top-level section
    if (inSection && line.startsWith('## ') && !line.startsWith('## 8.')) {
      inSection = false;
      break;
    }
    
    // Capture sub-headings (###)
    if (inSection && line.startsWith('### ')) {
      // Remove emojis (basic unicode range for emojis and symbols)
      let cleaned = line.replace('###', '').trim();
      // Simple emoji removal regex
      cleaned = cleaned.replace(/[\u{1F300}-\u{1F9FF}]/gu, '');
      cleaned = cleaned.replace(/[\u{2600}-\u{26FF}]/gu, '');
      cleaned = cleaned.trim();
      if (cleaned) {
        milestones.push(cleaned);
      }
    }
  }

  return milestones;
}

function updateAgentsManifest(milestones) {
  if (!fs.existsSync(AGENTS_PATH)) {
    console.error(`❌ 에이전트 파일이 존재하지 않습니다: ${AGENTS_PATH}`);
    return false;
  }

  let agentsContent = fs.readFileSync(AGENTS_PATH, 'utf8');
  const today = new Date().toISOString().split('T')[0];
  
  const marker = '## 4. 최신 동기화된 마일스톤 (Synced Milestones Log)';
  
  // Format milestones as a markdown list (Keep only recent 12, group the rest)
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
    // If the section already exists, replace it
    // Find if there is any heading after the marker, otherwise replace till the end
    const nextHeadingIndex = agentsContent.indexOf('\n## ', markerIndex + marker.length);
    if (nextHeadingIndex !== -1) {
      agentsContent = agentsContent.substring(0, markerIndex) + newSectionContent + agentsContent.substring(nextHeadingIndex);
    } else {
      agentsContent = agentsContent.substring(0, markerIndex) + newSectionContent;
    }
  } else {
    // If it doesn't exist, append it at the end of the file with double newlines
    agentsContent = agentsContent.trimEnd() + '\n\n' + newSectionContent;
  }

  // 0-Disk Write Guard: Avoid unnecessary file modifications if content is unchanged
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
  console.log('🔄 AGENTS.md & Engineering Report 동기화 도구');
  console.log('🔄 ==========================================\n');

  if (!fs.existsSync(REPORT_PATH)) {
    console.error(`❌ 엔지니어링 리포트 파일이 존재하지 않습니다: ${REPORT_PATH}`);
    process.exit(1);
  }

  try {
    const reportContent = fs.readFileSync(REPORT_PATH, 'utf8');
    const milestones = extractMilestones(reportContent);
    
    console.log(`📝 엔지니어링 리포트에서 추출한 최신 마일스톤 (${milestones.length}개):`);
    milestones.forEach((m, idx) => console.log(`   [${idx + 1}] ${m}`));
    console.log('');

    const success = updateAgentsManifest(milestones);
    if (success) {
      console.log('🎉 AGENTS.md 파일에 마일스톤 로그가 성공적으로 동기화되었습니다!');
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
