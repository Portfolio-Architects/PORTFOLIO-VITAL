const fs = require('fs');
const path = require('path');

const excludeFiles = [
  'src/components/festival/YangjaeFestivalDashboard.tsx' // Rule S & test invariant: DO NOT touch festival nav
];

function getAllFiles(dir, files = []) {
  for (const item of fs.readdirSync(dir)) {
    const full = path.join(dir, item);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      if (item !== 'node_modules' && item !== '.next') {
        getAllFiles(full, files);
      }
    } else if (/\.(tsx?|jsx?)$/.test(item)) {
      files.push(full);
    }
  }
  return files;
}

function safeWriteFileSync(filePath, content) {
  let retries = 5;
  while (retries > 0) {
    try {
      fs.writeFileSync(filePath, content, 'utf8');
      return;
    } catch (err) {
      retries--;
      if (retries === 0) throw err;
      const start = Date.now();
      while (Date.now() - start < 150) {}
    }
  }
}

const componentFiles = getAllFiles(path.resolve(__dirname, '../src/components'))
  .filter(f => !excludeFiles.some(ex => f.endsWith(path.normalize(ex))));

let totalReplaced = 0;
const report = [];

for (const file of componentFiles) {
  let content = fs.readFileSync(file, 'utf8');
  if (!content.includes('transition-all')) continue;

  const lines = content.split('\n');
  let fileReplacements = 0;

  const newLines = lines.map((line, idx) => {
    if (!line.includes('transition-all')) return line;

    fileReplacements++;
    totalReplaced++;

    let newLine = line;

    // 1. Progress bars animating width
    if (line.includes('h-full') && (line.includes('rounded-full') || line.includes('progress') || line.includes('isVisible'))) {
      if (line.includes('transition-all duration-')) {
        newLine = line.replace('transition-all duration-', 'transition-[width] duration-');
      } else {
        newLine = line.replace('transition-all', 'transition-[width] duration-300');
      }
      report.push({ file: path.relative(process.cwd(), file), line: idx + 1, type: 'width', before: line.trim(), after: newLine.trim() });
      return newLine;
    }

    // 2. Elements with hover:scale or hover:-translate-y
    if (line.includes('hover:scale') || line.includes('hover:-translate') || line.includes('hover:translate')) {
      if (line.includes('transition-all duration-')) {
        newLine = line.replace('transition-all duration-', 'transition-transform duration-');
      } else {
        newLine = line.replace('transition-all', 'transition-transform duration-150');
      }
      report.push({ file: path.relative(process.cwd(), file), line: idx + 1, type: 'transform', before: line.trim(), after: newLine.trim() });
      return newLine;
    }

    // 3. General buttons, inputs, tabs, cards (colors, backgrounds, borders)
    if (line.includes('transition-all duration-')) {
      newLine = line.replace('transition-all duration-', 'transition-colors duration-');
    } else {
      newLine = line.replace('transition-all', 'transition-colors duration-150');
    }
    report.push({ file: path.relative(process.cwd(), file), line: idx + 1, type: 'colors', before: line.trim(), after: newLine.trim() });
    return newLine;
  });

  safeWriteFileSync(file, newLines.join('\n'));
  console.log(`Replaced ${fileReplacements} transition-all in ${path.relative(process.cwd(), file)}`);
}

console.log(`\nTotal transition-all replacements executed: ${totalReplaced}`);
console.log(`Report summary: ${report.length} lines modified`);
