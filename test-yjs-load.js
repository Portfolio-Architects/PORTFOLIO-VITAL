const fs = require('fs');

const backupStr = require('./data/archive/hchps-backup.json')['hchps-map-customization'];
const cloudData = JSON.parse(backupStr);

console.log('cloudData.id:', cloudData.id);
console.log('cloudData.customNodes length:', cloudData.customNodes ? cloudData.customNodes.length : 'undefined');
console.log('Is Array?', Array.isArray(cloudData.customNodes));

// Simulate Yjs
const customNodesMap = new Map();
if (cloudData.customNodes) {
  cloudData.customNodes.forEach((n) => customNodesMap.set(n.id, n));
}

console.log('Yjs Map Size:', customNodesMap.size);

const outArray = Array.from(customNodesMap.values());
console.log('Array out length:', outArray.length);
