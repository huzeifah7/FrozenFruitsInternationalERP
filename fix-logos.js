const fs = require('fs');
const path = require('path');

const libDir = path.join(__dirname, 'src', 'lib');
const files = fs.readdirSync(libDir).filter(f => f.endsWith('.ts') || f.endsWith('.tsx'));

for (const file of files) {
  const filePath = path.join(libDir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;

  // PDF fix
  // We want to match: doc.addImage(..., 40, 15
  // or 40, 20
  // or 22, 18
  // or 28, 12
  const pdfRegexes = [
    { search: /doc\.addImage\((logoData(?:Url)?)\s*,\s*'PNG',\s*(14|15|margin(?: \+ 3)?),\s*(10|15|currentY|py|margin \+ 5|y \+ 2),\s*(?:40|22|28),\s*(?:15|20|18|12)([^)]*)\)/g, replace: "doc.addImage($1, 'PNG', $2, $3, 34, 16$4)" },
    { search: /doc\.addImage\((logoData(?:Url)?)\s*,\s*'PNG',\s*(14|15),\s*(10|15|currentY),\s*40,\s*20([^)]*)\)/g, replace: "doc.addImage($1, 'PNG', $2, $3, 34, 16$4)" },
    { search: /doc\.addImage\((logoData(?:Url)?)\s*,\s*'PNG',\s*(14|15),\s*(10|15|currentY),\s*40,\s*15([^)]*)\)/g, replace: "doc.addImage($1, 'PNG', $2, $3, 34, 16$4)" }
  ];

  for (const regex of pdfRegexes) {
    if (regex.search.test(content)) {
      content = content.replace(regex.search, regex.replace);
      changed = true;
    }
  }

  // Also handle exact matches for some tricky ones
  const exactMatchesPDF = [
    { search: "doc.addImage(logoData, 'PNG', 15, 15, 40, 15)", replace: "doc.addImage(logoData, 'PNG', 15, 15, 34, 16)" },
    { search: "doc.addImage(logoDataUrl, 'PNG', 14, 10, 40, 20, '', 'FAST')", replace: "doc.addImage(logoDataUrl, 'PNG', 14, 10, 34, 16, '', 'FAST')" },
    { search: "doc.addImage(logoDataUrl, 'PNG', 14, currentY, 40, 15, '', 'FAST')", replace: "doc.addImage(logoDataUrl, 'PNG', 14, currentY, 34, 16, '', 'FAST')" },
    { search: "doc.addImage(logoDataUrl, 'PNG', 14, py, 40, 15, '', 'FAST')", replace: "doc.addImage(logoDataUrl, 'PNG', 14, py, 34, 16, '', 'FAST')" },
    { search: "doc.addImage(logoDataUrl, 'PNG', 14, currentY, 22, 18, '', 'FAST')", replace: "doc.addImage(logoDataUrl, 'PNG', 14, currentY, 34, 16, '', 'FAST')" },
    { search: "doc.addImage(logoDataUrl, 'PNG', margin, margin + 5, 28, 12)", replace: "doc.addImage(logoDataUrl, 'PNG', margin, margin + 5, 34, 16)" }
  ];

  for (const match of exactMatchesPDF) {
    if (content.includes(match.search)) {
      content = content.replace(match.search, match.replace);
      changed = true;
    }
  }

  // Excel fix
  // We want to match ext: { width: X, height: Y } and replace with appropriate ratio ~2.125
  const excelMatches = [
    { search: "ext: { width: 140, height: 60 }", replace: "ext: { width: 136, height: 64 }" },
    { search: "ext: { width: 150, height: 50 }", replace: "ext: { width: 136, height: 64 }" },
    { search: "ext: { width: 100, height: 50 }", replace: "ext: { width: 106, height: 50 }" },
    { search: "ext: { width: 120, height: 40 }", replace: "ext: { width: 106, height: 50 }" }
  ];

  for (const match of excelMatches) {
    if (content.includes(match.search)) {
      content = content.replace(new RegExp(match.search.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'g'), match.replace);
      changed = true;
    }
  }

  if (changed) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated ${file}`);
  }
}
