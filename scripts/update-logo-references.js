const fs = require('fs');
const path = require('path');

function walk(dir) {
  const results = [];
  fs.readdirSync(dir).forEach(f => {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) {
      results.push(...walk(p));
    } else if (f.endsWith('.ts') || f.endsWith('.tsx') || f.endsWith('.js') || f.endsWith('.jsx')) {
      results.push(p);
    }
  });
  return results;
}

const files = walk(path.join(process.cwd(), 'src'));
let updatedFiles = 0;

files.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  if (content.includes('/EOLogo.png')) {
    const updated = content.replaceAll('/EOLogo.png', '/FFI_main.png');
    fs.writeFileSync(file, updated, 'utf8');
    updatedFiles++;
  }
});

console.log(`Updated logo reference in ${updatedFiles} files.`);
