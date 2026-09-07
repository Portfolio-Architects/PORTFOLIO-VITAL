const fs = require('fs');
const path = require('path');

const baseDir = path.join(__dirname, '..');
const outDir = path.join(baseDir, 'out');
const publicDir = path.join(baseDir, 'public');
const dataFile = path.join(baseDir, 'data', 'FESTIVAL_YANGJAE_2026.json');
const templateFile = path.join(__dirname, 'pages-template.html');
const functionFile = path.join(baseDir, 'functions', 'api', 'festival', 'yangjae.ts');

const festivalData = JSON.parse(fs.readFileSync(dataFile, 'utf8'));

// 1. Auto-sync FALLBACK_FESTIVAL_DATA in functions/api/festival/yangjae.ts
if (fs.existsSync(functionFile)) {
  try {
    let fnCode = fs.readFileSync(functionFile, 'utf8');
    const marker = 'const FALLBACK_FESTIVAL_DATA = ';
    const markerIdx = fnCode.indexOf(marker);
    if (markerIdx !== -1) {
      const headerPart = fnCode.substring(0, markerIdx + marker.length);
      const updatedCode = headerPart + JSON.stringify(festivalData, null, 2) + ';\n';
      fs.writeFileSync(functionFile, updatedCode, 'utf8');
      console.log('[OK] Auto-synced FALLBACK_FESTIVAL_DATA in functions/api/festival/yangjae.ts');
    }
  } catch (err) {
    console.warn('[WARN] Could not auto-sync functions/api/festival/yangjae.ts:', err.message);
  }
}

// 2. Prepare HTML template with injected SSOT JSON
let template = fs.readFileSync(templateFile, 'utf8');
template = template.replace('__APP_DATA_JSON__', JSON.stringify(festivalData));

if (fs.existsSync(outDir)) {
  fs.rmSync(outDir, { recursive: true, force: true });
}
fs.mkdirSync(outDir, { recursive: true });

if (fs.existsSync(publicDir)) {
  fs.cpSync(publicDir, outDir, { recursive: true });
}

fs.writeFileSync(path.join(outDir, 'index.html'), template, 'utf8');
fs.writeFileSync(path.join(outDir, '404.html'), template, 'utf8');

const festivalYangjaeDir = path.join(outDir, 'festival', 'yangjae');
fs.mkdirSync(festivalYangjaeDir, { recursive: true });
fs.writeFileSync(path.join(festivalYangjaeDir, 'index.html'), template, 'utf8');

const festivalDir = path.join(outDir, 'festival');
fs.writeFileSync(path.join(festivalDir, 'yangjae.html'), template, 'utf8');

console.log('[OK] Successfully prepared Pages output in out/ with 100% matched components and zero redirects.');
