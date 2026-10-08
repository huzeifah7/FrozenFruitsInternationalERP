const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? 
      walkDir(dirPath, callback) : callback(path.join(dir, f));
  });
}

let replacedCount = 0;

walkDir('./src', function(filePath) {
  if (filePath.endsWith('.ts') || filePath.endsWith('.tsx')) {
    // Skip the override file itself
    if (filePath.includes('firestore-override.ts')) return;
    // Skip index.ts if we don't want to mess up root exports, but actually index.ts just re-exports from provider
    
    let content = fs.readFileSync(filePath, 'utf8');
    let original = content;
    
    // Replace standard imports
    content = content.replace(/from\s+['"]firebase\/firestore['"]/g, "from '@/firebase/firestore-override'");
    // Some might be imported from "@firebase/firestore" but mostly it's "firebase/firestore"
    
    if (content !== original) {
      fs.writeFileSync(filePath, content, 'utf8');
      replacedCount++;
      console.log('Updated', filePath);
    }
  }
});

console.log('Total files updated:', replacedCount);
