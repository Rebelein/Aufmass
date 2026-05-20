const fs = require('fs');
let content = fs.readFileSync('src/lib/csv-export.ts', 'utf8');
content = content.replace(/ick\(\);\n  document\.body\.removeChild\(link\);\n\};\n\nexport const downloadCsv = \(content: string, filename: string\) => \{\n  downloadFile\(content, filename, true\);\n\};\n/g, '');
fs.writeFileSync('src/lib/csv-export.ts', content);
