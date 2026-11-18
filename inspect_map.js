const fs = require('fs');

const file = fs.readFileSync('data/MAP_CUSTOMIZATION.json', 'utf8');
const data = JSON.parse(file);
const crypto = require('crypto');

// I can't decrypt it because it uses window.crypto and PBKDF2 with '0509'.
// BUT I can just read the data from hchps-backup.json!
const backupStr = require('./data/archive/hchps-backup.json')['hchps-map-customization'];
const backupData = JSON.parse(backupStr);

console.log('Keys:', Object.keys(backupData));
console.log('customNodes type:', typeof backupData.customNodes);
console.log('customNodes isArray:', Array.isArray(backupData.customNodes));
console.log('First custom node:', JSON.stringify(backupData.customNodes[0]).substring(0, 100));

