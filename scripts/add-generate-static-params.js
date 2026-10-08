const fs = require('fs');
const path = require('path');

function getParamsFromPath(filePath) {
  const matches = filePath.match(/\[([a-zA-Z0-9_]+)\]/g);
  if (!matches) return [];
  return Array.from(new Set(matches.map(m => m.replace(/\[|\]/g, ''))));
}

function walk(dir) {
  const results = [];
  fs.readdirSync(dir).forEach(f => {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) {
      results.push(...walk(p));
    } else if (f === 'page.tsx' && p.includes('[')) {
      results.push(p);
    }
  });
  return results;
}

const files = walk(path.join(process.cwd(), 'src', 'app'));
console.log('Found dynamic page files:', files.length);

let modifiedCount = 0;
files.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  if (content.includes('generateStaticParams')) {
    console.log('Already has generateStaticParams:', file);
    return;
  }
  const params = getParamsFromPath(file);
  if (params.length === 0) return;

  const paramObjStr = params.map(p => `${p}: '1'`).join(', ');
  const codeToAdd = `\n\nexport function generateStaticParams() {\n  return [{ ${paramObjStr} }];\n}\n`;

  fs.writeFileSync(file, content + codeToAdd, 'utf8');
  modifiedCount++;
});

console.log('Added generateStaticParams to files:', modifiedCount);
