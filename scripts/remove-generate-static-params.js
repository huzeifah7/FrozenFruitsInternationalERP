const fs = require('fs');
const path = require('path');

function walk(dir) {
  const results = [];
  fs.readdirSync(dir).forEach(f => {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) {
      results.push(...walk(p));
    } else if (f.endsWith('.tsx') || f.endsWith('.ts')) {
      results.push(p);
    }
  });
  return results;
}

const files = walk(path.join(process.cwd(), 'src', 'app'));
let modifiedCount = 0;

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  if (content.includes('generateStaticParams')) {
    // Replace the generateStaticParams block
    const cleaned = content.replace(/\n*export function generateStaticParams\(\) \{\n  return \[\{ [^}]* \}\];\n\}\n?/g, '');
    if (cleaned !== content) {
      fs.writeFileSync(file, cleaned, 'utf8');
      modifiedCount++;
    }
  }
});

console.log('Removed invalid generateStaticParams from files:', modifiedCount);
