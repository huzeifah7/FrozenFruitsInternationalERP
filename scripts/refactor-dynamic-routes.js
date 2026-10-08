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
console.log('Total dynamic page files:', files.length);

let refactoredCount = 0;

files.forEach(file => {
  const dir = path.dirname(file);
  const clientFilePath = path.join(dir, 'client.tsx');
  let content = fs.readFileSync(file, 'utf8');

  // Check if file uses client directive
  const isClient = content.startsWith("'use client'") || 
                   content.startsWith('"use client"') || 
                   content.includes("\n'use client'") || 
                   content.includes('\n"use client"');

  if (isClient) {
    // Strip out any generateStaticParams if we added it to page.tsx earlier
    const genStaticIndex = content.indexOf('export function generateStaticParams');
    let clientContent = content;
    if (genStaticIndex !== -1) {
      clientContent = content.substring(0, genStaticIndex).trimEnd() + '\n';
    }

    // Write client.tsx
    fs.writeFileSync(clientFilePath, clientContent, 'utf8');

    // Create server page.tsx wrapper with generateStaticParams
    const params = getParamsFromPath(file);
    const paramObjStr = params.map(p => `${p}: '1'`).join(', ');

    const serverPageContent = `import ClientPage from './client';

export function generateStaticParams() {
  return [{ ${paramObjStr} }];
}

export default function Page() {
  return <ClientPage />;
}
`;
    fs.writeFileSync(file, serverPageContent, 'utf8');
    refactoredCount++;
  } else {
    // Not a client component page, ensure generateStaticParams is present
    if (!content.includes('generateStaticParams')) {
      const params = getParamsFromPath(file);
      const paramObjStr = params.map(p => `${p}: '1'`).join(', ');
      const codeToAdd = `\n\nexport function generateStaticParams() {\n  return [{ ${paramObjStr} }];\n}\n`;
      fs.writeFileSync(file, content + codeToAdd, 'utf8');
      refactoredCount++;
    }
  }
});

console.log(`Successfully refactored ${refactoredCount} dynamic route pages.`);
