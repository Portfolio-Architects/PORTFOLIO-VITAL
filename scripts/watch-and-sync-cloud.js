/**
 * 2026 양재천 건강 페스티벌 실시간 로컬 디스크 감시 및 Cloudflare 무인 듀얼 싱크 데몬
 * 
 * 기능:
 * 1. data/FESTIVAL_YANGJAE_2026.json 및 scripts/pages-template.html 파일 변경 감시
 * 2. 변경 발생 시 300ms 디바운스 후 자동으로:
 *    - node scripts/prepare-pages-output.js (정적 HTML 템플릿 및 fallback 동기화)
 *    - node scripts/sync-festival-to-cloud.js (Cloudflare KV 실시간 발행)
 * 3. 엑셀 동기화, 로컬 UI 편집, 파일 직접 수정 시 100% 무인 실시간 타 디바이스 반영 보장
 * 
 * 실행: node scripts/watch-and-sync-cloud.js
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const rootDir = path.join(__dirname, '..');
const targetFile = path.join(rootDir, 'data', 'FESTIVAL_YANGJAE_2026.json');
const templateFile = path.join(__dirname, 'pages-template.html');

let debounceTimer = null;
let isSyncing = false;
let pendingSync = false;

function formatTime() {
  return new Date().toLocaleTimeString('ko-KR', { hour12: false });
}

function runCommand(cmd) {
  return new Promise((resolve, reject) => {
    exec(cmd, { cwd: rootDir }, (err, stdout, stderr) => {
      if (err) {
        reject({ err, stdout, stderr });
      } else {
        resolve({ stdout, stderr });
      }
    });
  });
}

async function triggerDualSync(reason) {
  if (isSyncing) {
    pendingSync = true;
    return;
  }

  isSyncing = true;
  console.log(`\n🔄 [${formatTime()}] [Auto-Watcher] 변경 감지 (${reason}) -> Cloudflare 듀얼 동기화 시작...`);

  try {
    // 1. Prepare pages output
    const prepRes = await runCommand('node scripts/prepare-pages-output.js');
    if (prepRes.stdout) {
      const lines = prepRes.stdout.trim().split('\n').filter(l => l.includes('[OK]'));
      lines.forEach(l => console.log(`   ├─ ${l}`));
    }

    // 2. Sync to Cloudflare KV
    const syncRes = await runCommand('node scripts/sync-festival-to-cloud.js');
    if (syncRes.stdout) {
      const lines = syncRes.stdout.trim().split('\n').filter(l => l.includes('[PASS]') || l.includes('URL:'));
      lines.forEach(l => console.log(`   ├─ ${l}`));
    }

    console.log(`✅ [${formatTime()}] [Auto-Watcher] Cloudflare Pages & KV 실시간 동기화 완료!`);
  } catch (error) {
    console.error(`❌ [${formatTime()}] [Auto-Watcher] 동기화 중 오류 발생:`, error.err ? error.err.message : error);
    if (error.stdout) console.error(error.stdout);
    if (error.stderr) console.error(error.stderr);
  } finally {
    isSyncing = false;
    if (pendingSync) {
      pendingSync = false;
      setTimeout(() => triggerDualSync('Pending sync execution'), 100);
    }
  }
}

function scheduleSync(reason) {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }
  debounceTimer = setTimeout(() => {
    triggerDualSync(reason);
  }, 300);
}

function startWatcher() {
  console.log('================================================================');
  console.log('👀 [Yangjae Festival] Cloudflare Real-Time Dual-Sync Watcher');
  console.log('================================================================');
  console.log(`📁 감시 대상 1: ${path.relative(rootDir, targetFile)}`);
  console.log(`📁 감시 대상 2: ${path.relative(rootDir, templateFile)}`);
  console.log('⚡ 로컬 파일/엑셀/UI 수정 시 300ms 내 모바일 프론트엔드로 즉시 자동 전송됩니다.');
  console.log('🛑 중단하려면 Ctrl+C를 누르십시오.\n');

  // 시작 시 초기 1회 동기화 실행
  triggerDualSync('Initial Watcher Boot');

  // 1. FESTIVAL_YANGJAE_2026.json 감시
  if (fs.existsSync(targetFile)) {
    try {
      fs.watch(targetFile, (eventType) => {
        scheduleSync(`FESTIVAL_YANGJAE_2026.json (${eventType})`);
      });
    } catch (e) {
      console.warn('⚠️ targetFile fs.watch error:', e.message);
    }
  }

  // 2. scripts/pages-template.html 감시
  if (fs.existsSync(templateFile)) {
    try {
      fs.watch(templateFile, (eventType) => {
        scheduleSync(`pages-template.html (${eventType})`);
      });
    } catch (e) {
      console.warn('⚠️ templateFile fs.watch error:', e.message);
    }
  }
}

startWatcher();
